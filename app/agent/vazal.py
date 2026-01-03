from typing import Dict, List, Optional

from pydantic import Field, model_validator

from app.agent.browser import BrowserContextHelper
from app.agent.toolcall import ToolCallAgent
from app.config import config
from app.logger import logger
from app.tool import Terminate, ToolCollection
from app.tool.ask_human import AskHuman
from app.tool.browser_use_tool import BrowserUseTool
from app.tool.mcp import MCPClients, MCPClientTool
from app.tool.python_execute import PythonExecute
from app.tool.str_replace_editor import StrReplaceEditor
from app.tool.block_editor import BlockEditor
from app.tool.ppt_creator import PPTCreatorTool  # Updated Import
from app.tool.generate_image import GenerateImageTool
from app.tool.image_search import ImageSearchTool
from app.tool.fast_search import FastSearch
from app.memory.lessons import LessonManager

# --- PROMPTS DEFINED GLOBALLY ---
# NOTE: We use double braces {{ }} for JSON examples so Python doesn't confuse them with variables.
SYSTEM_PROMPT = (
    "You are Vazal, an autonomous AI agent. "
    "Your goal is to SOLVE tasks by taking ACTION, not just chatting.\n\n"

    "AVAILABLE TOOLS:\n"
    "1. 'fast_search': USE THIS FIRST for facts. \n"
    "   - WARNING: If 'fast_search' fails or is rate-limited, STOP using it.\n"
    "   - SWITCH IMMEDIATELY to 'browser_use' to search Google/Bing directly.\n"
    "2. 'python_execute': Run Python code for calculations, data analysis, or CREATING FILES.\n"
    "3. 'browser_use': Use for finding IMAGES or navigating specific sites.\n"
    "   - PREFER 'fast_search' for text/facts. Only use 'browser_use' for text if 'fast_search' fails.\n"
    "   - ACTION: 'go_to_url' -> Visit specific pages.\n"
    "4. 'block_editor': POWERFUL editor. Use 'read' to see line numbers, then 'insert'/'delete'/'replace'.\n"
    "   - PREFER 'block_editor' over 'str_replace_editor' for code edits.\n"
    "5. 'ppt_creator': Create PowerPoint presentations (.pptx).\n"
    "   - Input: filename, slides (title, content, images, table), and optional template.\n"
    "   - CRITICAL: When creating slides, content MUST be detailed and informative.\n"
    "     - DO NOT use generic placeholders like 'Overview of X'.\n"
    "     - DO provide actual facts, figures, names, and descriptions in the bullet points.\n"
    "     - Each slide MUST have 3-5 detailed bullet points.\n"
    "     - If you don't have the details, SEARCH for them first.\n"
    "   - IMAGES: You can provide a URL (http/https) directly, and the tool will download it.\n"
    "     - EVERY slide should have a UNIQUE image.\n"
    "     - IMAGE SOURCING RULES (STRICT):\n"
    "       1. ALWAYS use 'image_search' FIRST to find REAL PHOTOGRAPHS.\n"
    "       2. ONLY use 'generate_image' if 'image_search' fails completely or the user explicitly asks for 'AI art' or 'illustrations'.\n"
    "       3. Users prefer REAL photos of people, places, and events.\n"
    "     - CRITICAL: DO NOT use 'source.unsplash.com' or fake URLs. They WILL FAIL.\n"
    "     - YOU MUST SEARCH for images first.\n"
    "   - PRESENTATION GUIDELINES (HARDCODED):\n"
    "     When creating presentations; generally create titles for each slide, that follow the earlier proposed flow or narrative.\n"
    "     Always start with an executive summary and/or table of contents / agenda that introduces the flow.\n"
    "     The titles should make a clear point that supports this flow of the presentation (step by step).\n"
    "     Always summarize with conclusions and/or next steps at the end.\n"
    "     This guidance can be overridden by the user.\n"
    "6. 'image_search': Search for images using DuckDuckGo.\n"
    "   - Use this to find real image URLs for presentations.\n"
    "   - Input: query (e.g., 'surfing hawaii').\n"
    "7. 'generate_image': Generate custom images using DALL-E 3.\n"
    "   - Use this if you cannot find good images via search.\n"
    "   - Input: prompt (detailed description).\n"
    "8. 'terminate': Call this when DONE. \n"
    "   - IMPORTANT: This tool takes NO arguments (or only 'status').\n"
    "   - BEFORE calling terminate, you MUST print/say the final answer to the user.\n\n"

    "CORE DIRECTIVES:\n"
    "1. ACTION OVER SPEECH: If a request requires data, use 'browser_use' or 'fast_search'.\n"
    "2. NO EXCUSES: Never say 'I cannot browse'. USE THE TOOLS.\n"
    "3. STEP-BY-STEP: Search -> Extract -> Answer.\n\n"

    "The initial directory is: {directory}"
)

NEXT_STEP_PROMPT = """
Review the previous tool output.
- If the task is complete, STATE the final answer clearly, and THEN use `terminate`.
- If `fast_search` failed, try `browser_use` with a search engine URL (e.g. google.com).
- DO NOT just summarize without finishing the job.
"""

class Vazal(ToolCallAgent):
    """A versatile general-purpose agent that uses tools to solve tasks."""

    name: str = "Vazal"
    description: str = "A versatile agent that can use tools to solve various tasks."

    system_prompt: str = SYSTEM_PROMPT.format(directory=config.workspace_root)
    next_step_prompt: str = NEXT_STEP_PROMPT

    # Define available tools
    available_tools: ToolCollection = Field(
        default_factory=lambda: ToolCollection(
            PythonExecute(),
            FastSearch(),
            BrowserUseTool(),
            BlockEditor(),
            PPTCreatorTool(),  # Updated Instantiation
            GenerateImageTool(),
            ImageSearchTool(),
            StrReplaceEditor(),
            AskHuman(),
            Terminate(),
        )
    )

    # Memory Management
    memory_manager: LessonManager = Field(default_factory=LessonManager)

    # Internal state
    _initialized: bool = False

    @model_validator(mode="after")
    def initialize_helper(self) -> "Vazal":
        """Initialize basic components synchronously."""
        self.browser_context_helper = BrowserContextHelper(self)
        return self

    async def initialize_mcp_servers(self):
        """Initialize MCP servers if configured."""
        # FIX: Use config.mcp_config instead of config.mcp
        if config.mcp_config and config.mcp_config.servers:
            logger.info(f"🔌 Connecting to {len(config.mcp_config.servers)} MCP servers...")
            mcp_clients = MCPClients(config.mcp_config.servers)
            await mcp_clients.connect()

            # Add MCP tools to available tools
            mcp_tools = await mcp_clients.get_tools()
            for tool in mcp_tools:
                self.available_tools.add_tool(MCPClientTool(tool))

            logger.info(f"✅ Added {len(mcp_tools)} MCP tools")

    async def disconnect_mcp_server(self):
        """Disconnect from MCP servers."""
        # Logic to disconnect if needed
        pass

    async def cleanup(self):
        """Cleanup resources."""
        await super().cleanup()
        # Clean up MCP servers only if we were initialized
        if self._initialized:
            await self.disconnect_mcp_server()
            self._initialized = False

    async def think(self) -> bool:
        """Process current state and decide next actions with appropriate context."""
        if not self._initialized:
            await self.initialize_mcp_servers()
            self._initialized = True

        # --- MEMORY INJECTION ---
        # 1. Get lessons
        lessons = self.memory_manager.get_relevant_lessons()

        # 2. Backup original system prompt
        original_system_prompt = self.system_prompt

        # 3. Inject lessons into system prompt
        self.system_prompt = original_system_prompt + lessons
        # ------------------------

        original_prompt = self.next_step_prompt
        recent_messages = self.memory.messages[-3:] if self.memory.messages else []
        browser_in_use = any(
            tc.function.name == BrowserUseTool().name
            for msg in recent_messages
            if msg.tool_calls
            for tc in msg.tool_calls
        )

        if browser_in_use:
            self.next_step_prompt = (
                await self.browser_context_helper.format_next_step_prompt()
            )

        result = await super().think()

        # --- RESTORE PROMPTS ---
        self.next_step_prompt = original_prompt
        self.system_prompt = original_system_prompt
        # -----------------------

        return result
