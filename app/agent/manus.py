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
    "3. 'browser_use': Use for complex web tasks OR as a fallback for search.\n"
    "   - ACTION: 'go_to_url' -> Visit specific pages.\n"
    "4. 'block_editor': POWERFUL editor. Use 'read' to see line numbers, then 'insert'/'delete'/'replace'.\n"
    "   - PREFER 'block_editor' over 'str_replace_editor' for code edits.\n"
    "5. 'terminate': Call this when DONE. \n"
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

