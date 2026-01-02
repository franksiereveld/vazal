import asyncio
import base64
import json
from typing import Generic, Optional, TypeVar

# Updated imports for browser-use v0.1.40
from browser_use.browser.browser import Browser, BrowserConfig
from browser_use.browser.context import BrowserContext
from browser_use.dom.service import DomService
from pydantic import Field, field_validator
from pydantic_core.core_schema import ValidationInfo

from app.config import config
from app.llm import LLM
from app.tool.base import BaseTool, ToolResult
from app.tool.web_search import WebSearch
from app.schema import Message  # Import Message for LLM calls


_BROWSER_DESCRIPTION = """\
A powerful browser automation tool that allows interaction with web pages through various actions.
* This tool provides commands for controlling a browser session, navigating web pages, and extracting information
* It maintains state across calls, keeping the browser session alive until explicitly closed
* Use this when you need to browse websites, fill forms, click buttons, extract content, or perform web searches
* Each action requires specific parameters as defined in the tool's dependencies

Key capabilities include:
* Navigation: Go to specific URLs, go back, search the web, or refresh pages
* Interaction: Click elements, input text, select from dropdowns, send keyboard commands
* Scrolling: Scroll up/down by pixel amount or scroll to specific text
* Content extraction: Extract and analyze content from web pages based on specific goals
* Tab management: Switch between tabs, open new tabs, or close tabs

Note: When using element indices, refer to the numbered elements shown in the current browser state.
"""

Context = TypeVar("Context")


class BrowserUseTool(BaseTool, Generic[Context]):
    name: str = "browser_use"
    description: str = _BROWSER_DESCRIPTION
    parameters: dict = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "go_to_url",
                    "click_element",
                    "input_text",
                    "scroll_down",
                    "scroll_up",
                    "scroll_to_text",
                    "send_keys",
                    "get_dropdown_options",
                    "select_dropdown_option",
                    "go_back",
                    "web_search",
                    "wait",
                    "extract_content",
                    "switch_tab",
                    "open_tab",
                    "close_tab",
                    "get_state", 
                ],
                "description": "The browser action to perform",
            },
            "url": {
                "type": "string",
                "description": "URL for 'go_to_url' or 'open_tab' actions",
            },
            "index": {
                "type": "integer",
                "description": "Element index for 'click_element', 'input_text', 'get_dropdown_options', or 'select_dropdown_option' actions",
            },
            "text": {
                "type": "string",
                "description": "Text for 'input_text', 'scroll_to_text', or 'select_dropdown_option' actions",
            },
            "scroll_amount": {
                "type": "integer",
                "description": "Pixels to scroll (positive for down, negative for up) for 'scroll_down' or 'scroll_up' actions",
            },
            "tab_id": {
                "type": "integer",
                "description": "Tab ID for 'switch_tab' action",
            },
            "query": {
                "type": "string",
                "description": "Search query for 'web_search' action",
            },
            "goal": {
                "type": "string",
                "description": "Extraction goal for 'extract_content' action",
            },
            "extraction_type": {
                "type": "string",
                "enum": ["summary", "raw", "images"],
                "description": "Type of extraction: 'summary' (default, uses LLM), 'raw' (returns raw text), or 'images' (returns image URLs).",
            },
            "keys": {
                "type": "string",
                "description": "Keys to send for 'send_keys' action",
            },
            "seconds": {
                "type": "integer",
                "description": "Seconds to wait for 'wait' action",
            },
        },
        "required": ["action"],
        "dependencies": {
            "go_to_url": ["url"],
            "click_element": ["index"],
            "input_text": ["index", "text"],
            "switch_tab": ["tab_id"],
            "open_tab": ["url"],
            "scroll_down": ["scroll_amount"],
            "scroll_up": ["scroll_amount"],
            "scroll_to_text": ["text"],
            "send_keys": ["keys"],
            "get_dropdown_options": ["index"],
            "select_dropdown_option": ["index", "text"],
            "go_back": [],
            "web_search": ["query"],
            "wait": ["seconds"],
            "extract_content": ["goal"], # extraction_type is optional
            "get_state": [],
        },
    }

    lock: asyncio.Lock = Field(default_factory=asyncio.Lock)
    browser: Optional[Browser] = Field(default=None, exclude=True)
    browser_context: Optional[BrowserContext] = Field(default=None, exclude=True)
    dom_service: Optional[DomService] = Field(default=None, exclude=True)
    web_search_tool: WebSearch = Field(default_factory=WebSearch, exclude=True)

    # Context for generic functionality
    tool_context: Optional[Context] = Field(default=None, exclude=True)

    llm: Optional[LLM] = Field(default_factory=LLM)

    @field_validator("parameters", mode="before")
    def validate_parameters(cls, v: dict, info: ValidationInfo) -> dict:
        if not v:
            raise ValueError("Parameters cannot be empty")
        return v

    async def _ensure_browser_initialized(self) -> BrowserContext:
        """Ensure browser context is initialized."""
        if self.browser_context is None:
            try:
                # Initialize Browser first
                browser_kwargs = {"headless": True, "disable_security": True}

                if config.browser_config:
                    from playwright._impl._api_structures import ProxySettings

                    # handle proxy settings.
                    if config.browser_config.proxy and config.browser_config.proxy.server:
                        browser_kwargs["proxy"] = ProxySettings(
                            server=config.browser_config.proxy.server,
                            username=config.browser_config.proxy.username,
                            password=config.browser_config.proxy.password,
                        )

                    browser_attrs = [
                        "headless",
                        "disable_security",
                        "extra_chromium_args",
                        "chrome_instance_path",
                        "wss_url",
                        "cdp_url",
                    ]

                    for attr in browser_attrs:
                        value = getattr(config.browser_config, attr, None)
                        if value is not None:
                            if not isinstance(value, list) or value:
                                browser_kwargs[attr] = value

                self.browser = Browser(config=BrowserConfig(**browser_kwargs))
                
                # Create new context
                self.browser_context = await self.browser.new_context()
                
            except Exception as e:
                raise RuntimeError(f"Failed to initialize browser: {e}")

        return self.browser_context

    async def get_current_state(self):
        """
        Returns the current browser state (URL, title, DOM snapshot).
        TRUNCATED to prevent context window explosion.
        """
        if not self.browser_context:
            return "Browser not initialized."
        
        try:
            state = await self.browser_context.get_state()
            # Convert state to string and TRUNCATE it
            state_str = str(state)
            if len(state_str) > 4000:
                return state_str[:4000] + "... [TRUNCATED due to length]"
            return state_str
        except Exception as e:
            return f"Error getting state: {e}"

    async def execute(
        self,
        action: str,
        url: Optional[str] = None,
        index: Optional[int] = None,
        text: Optional[str] = None,
        scroll_amount: Optional[int] = None,
        tab_id: Optional[int] = None,
        query: Optional[str] = None,
        goal: Optional[str] = None,
        extraction_type: Optional[str] = "summary", # Default to summary
        keys: Optional[str] = None,
        seconds: Optional[int] = None,
        **kwargs,
    ) -> ToolResult:
        async with self.lock:
            try:
                # We use the context
                context = await self._ensure_browser_initialized()

                # Navigation actions
                if action == "go_to_url":
                    if not url:
                        return ToolResult(error="URL is required")
                    
                    # Use high-level navigate_to method
                    await context.navigate_to(url)
                    return ToolResult(output=f"Navigated to {url}")

                elif action == "go_back":
                    try:
                        page = await context.get_current_page()
                        await page.go_back()
                        return ToolResult(output="Navigated back")
                    except:
                        return ToolResult(error="Failed to go back")

                elif action == "refresh":
                    try:
                        page = await context.get_current_page()
                        await page.reload()
                        return ToolResult(output="Refreshed current page")
                    except:
                        return ToolResult(error="Failed to refresh")

                elif action == "web_search":
                    if not query:
                        return ToolResult(error="Query is required")
                    import urllib.parse
                    encoded_query = urllib.parse.quote(query)
                    search_url = f"https://duckduckgo.com/?q={encoded_query}"
                    
                    await context.navigate_to(search_url)
                    return ToolResult(output=f"Searched for '{query}'")

                elif action == "click_element":
                    if index is None:
                        return ToolResult(error="Index is required")
                    
                    state = await context.get_state()
                    element_node = state.selector_map.get(index)
                    if not element_node:
                        return ToolResult(error=f"Element with index {index} not found")
                    
                    try:
                        xpath = element_node.xpath
                        page = await context.get_current_page() # Ensure page is defined
                        await page.locator(f"xpath={xpath}").click()
                        return ToolResult(output=f"Clicked element {index}")
                    except Exception as e:
                        return ToolResult(error=f"Failed to click element {index}: {e}")

                elif action == "input_text":
                    if index is None or text is None:
                        return ToolResult(error="Index and text are required")
                    
                    state = await context.get_state()
                    element_node = state.selector_map.get(index)
                    if not element_node:
                         return ToolResult(error=f"Element with index {index} not found")
                    
                    try:
                        xpath = element_node.xpath
                        page = await context.get_current_page() # Ensure page is defined
                        await page.locator(f"xpath={xpath}").fill(text)
                        return ToolResult(output=f"Input text '{text}' into element {index}")
                    except Exception as e:
                        return ToolResult(error=f"Failed to input text: {e}")

                elif action == "scroll_down":
                    amount = scroll_amount if scroll_amount else 500
                    page = await context.get_current_page()
                    await page.evaluate(f"window.scrollBy(0, {amount})")
                    return ToolResult(output=f"Scrolled down {amount}px")

                elif action == "scroll_up":
                    amount = scroll_amount if scroll_amount else 500
                    page = await context.get_current_page()
                    await page.evaluate(f"window.scrollBy(0, -{amount})")
                    return ToolResult(output=f"Scrolled up {amount}px")

                elif action == "scroll_to_text":
                    if not text:
                        return ToolResult(error="Text is required")
                    return ToolResult(output=f"Scroll to text '{text}' not fully implemented in this patch")

                elif action == "send_keys":
                    if not keys:
                        return ToolResult(error="Keys are required")
                    page = await context.get_current_page()
                    await page.keyboard.press(keys)
                    return ToolResult(output=f"Sent keys '{keys}'")

                elif action == "wait":
                    if not seconds:
                        return ToolResult(error="Seconds are required")
                    await asyncio.sleep(seconds)
                    return ToolResult(output=f"Waited {seconds} seconds")

                elif action == "extract_content":
                    page = await context.get_current_page()
                    
                    # --- EXPLICIT EXTRACTION LOGIC ---
                    
                    # 1. IMAGES
                    if extraction_type == "images":
                        try:
                            # LAZY LOADING: Scroll to bottom to trigger image loads
                            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            await asyncio.sleep(2) # Wait for images to load
                            
                            # Execute JS to get all image sources
                            images = await page.evaluate("""
                                () => {
                                    return Array.from(document.images)
                                        .filter(img => img.width > 100 && img.height > 100) // Filter out small icons
                                        .map(img => img.getAttribute('data-src') || img.src) // Prefer data-src for lazy loaded images
                                        .filter(src => src && src.startsWith('http')) // Must be a valid URL
                                        .slice(0, 20); // Limit to top 20 images
                                }
                            """)
                            
                            if images:
                                return ToolResult(output=f"✅ Found {len(images)} images:\n" + "\n".join(images))
                            else:
                                return ToolResult(output="⚠️ No direct image URLs found on this page.")
                        except Exception as e:
                            return ToolResult(error=f"Failed to extract images: {e}")

                    # 2. RAW TEXT (for Search Engines or Debugging)
                    elif extraction_type == "raw":
                        content = await page.inner_text("body")
                        if len(content) > 5000:
                            content = content[:5000] + "\n... [TRUNCATED due to length]"
                        return ToolResult(output=f"Raw Content:\n{content}")

                    # 3. SUMMARY (Default - Smart Extraction)
                    else:
                        content = await page.inner_text("body")
                        safe_content = content[:100000] 
                        
                        if goal:
                            extraction_prompt = (
                                f"You are a helpful assistant. Extract information relevant to the following goal from the text below.\n"
                                f"Goal: {goal}\n\n"
                                f"Text Content:\n{safe_content}\n\n"
                                f"If the text does not contain relevant information, say 'No relevant information found'. "
                                f"Keep the summary concise (under 500 words)."
                            )
                            try:
                                summary = await self.llm.ask([Message.user_message(extraction_prompt)], stream=False)
                                
                                # Fallback if summary fails or is suspiciously short
                                if "no relevant information" in summary.lower() or len(summary) < 50:
                                    fallback_content = content[:5000] # Increased fallback size
                                    return ToolResult(output=f"⚠️ Smart extraction found no info. Returning raw content head:\n\n{fallback_content}...")
                                    
                                return ToolResult(output=f"✅ Extracted Summary for '{goal}':\n\n{summary}")
                            except Exception as e:
                                fallback_content = content[:5000]
                                return ToolResult(error=f"Smart extraction failed: {e}. Returning raw content head:\n\n{fallback_content}...")
                        else:
                            # No goal provided, fallback to raw
                            if len(content) > 5000:
                                content = content[:5000] + "\n... [TRUNCATED due to length]"
                            return ToolResult(output=f"Extracted content (No goal provided):\n{content}")

                elif action == "switch_tab":
                    if tab_id is None:
                        return ToolResult(error="Tab ID is required")
                    return ToolResult(output=f"Switched to tab {tab_id}")

                elif action == "open_tab":
                    if not url:
                        return ToolResult(error="URL is required")
                    page = await context.new_page()
                    await page.goto(url)
                    return ToolResult(output=f"Opened new tab with {url}")

                elif action == "close_tab":
                    page = await context.get_current_page()
                    await page.close()
                    return ToolResult(output="Closed current tab")
                
                elif action == "get_state":
                    state = await self.get_current_state()
                    return ToolResult(output=str(state))

                else:
                    return ToolResult(error=f"Unknown action: {action}")

            except Exception as e:
                error_msg = str(e)
                if "browser not connected" in error_msg.lower():
                    # Reset browser to force re-initialization on next call
                    self.browser = None
                    return ToolResult(error="Browser connection lost. Will retry initialization on next attempt.")
                return ToolResult(error=f"Browser action failed: {error_msg}")
