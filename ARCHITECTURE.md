# Vazal AI System Reference
*(Built on OpenManus Foundation)*

## 1. System Overview
Vazal AI is an autonomous agent framework designed to solve complex tasks through a loop of **Observation**, **Thought**, and **Action**. It is built on the OpenManus foundation but significantly enhanced with robust tool integrations (Tavily, Playwright), improved configuration management, and a rebranded identity.

The system operates by:
1.  **Receiving a Goal:** User inputs a request (e.g., "Research X").
2.  **Planning:** The Agent (Vazal) analyzes the request using an LLM.
3.  **Tool Selection:** The Agent selects the best tool (Search, Browser, Python, etc.).
4.  **Execution:** The tool performs the action and returns an observation.
5.  **Iteration:** The Agent reflects on the observation and decides the next step.

---

## 2. Directory Structure & Module Reference

### `app/agent/` (The Brain)
Contains the core logic for the agent's thought process and lifecycle.
*   **`manus.py`**: **CORE FILE.** Defines the `Vazal` class (formerly Manus). It manages the main execution loop, memory injection, and tool orchestration.
*   **`toolcall.py`**: Implements the `ToolCallAgent` base class, handling the interaction with the LLM API (OpenAI/Anthropic) and parsing tool calls.
*   **`browser.py`**: Helper class (`BrowserContextHelper`) that manages the state of the headless browser and formats browser observations for the LLM.
*   **`sandbox_agent.py`**: Defines `SandboxVazal`, a variant of the agent designed to run in isolated environments (Daytona/Docker).

### `app/tool/` (The Hands)
Contains the implementation of all tools available to the agent.
*   **`base.py`**: Defines the `BaseTool` abstract class that all tools must inherit from. Enforces Pydantic validation.
*   **`tool_collection.py`**: A container class to manage and register multiple tools.
*   **`fast_search.py`**: **CRITICAL.** A unified search interface that supports **Tavily** (primary) and **DuckDuckGo** (fallback).
*   **`browser_use_tool.py`**: **CRITICAL.** Integrates the `browser-use` library (Playwright) to allow the agent to navigate websites, click elements, and extract text.
*   **`python_execute.py`**: A sandbox for executing Python code. Used for calculations, data analysis, and file manipulation.
*   **`str_replace_editor.py`**: A file system editor allowing the agent to `view`, `create`, and `str_replace` (edit) files.
*   **`bash.py`**: Executes shell commands. (Restricted in some configurations).
*   **`ask_human.py`**: Allows the agent to pause and ask the user for clarification.
*   **`terminate.py`**: The signal tool used by the agent to indicate the task is complete.
*   **`crawl4ai.py`**: (Currently Disabled) A deep-crawling tool for extracting full page content.
*   **`mcp.py`**: Implements the Model Context Protocol (MCP) to connect with external tool servers.

### `app/memory/` (The Memory)
*   **`memory.py`**: Manages the list of messages (User, Assistant, Tool) that form the context window.
*   **`lessons.py`**: `LessonManager` retrieves relevant "lessons" (past learnings) to inject into the system prompt, allowing the agent to improve over time.

### `app/prompt/` (The Personality)
*   **`manus.py`**: Contains the **System Prompt** ("You are Vazal...") and **Next Step Prompt** that guide the agent's behavior and identity.

### `app/config.py` & `config/` (The Configuration)
*   **`app/config.py`**: Loads settings from `config.toml` and environment variables. Defines Pydantic models for configuration validation.
*   **`config/config.toml`**: **USER CONFIG.** The main file where you set API keys (`openai_api_key`, `tavily_api_key`), select models (`gpt-4o`), and configure search engines.

### `app/logger.py` (The Logs)
*   **`logger.py`**: Configures `loguru` to output structured logs to the console and files. Essential for debugging agent thoughts.

### `app/sandbox/` (The Environment)
*   **`core/`**: Manages the execution environment (Docker/Daytona) for the `SandboxVazal` agent.
*   **`server.py`**: An MCP server implementation that exposes the agent as a service.

---

## 3. Key Workflows

### A. The Search Workflow
1.  Agent calls `fast_search(query="...")`.
2.  `app/tool/fast_search.py` checks `config.search.engine`.
3.  If "Tavily": Calls `TavilyClient.search()`.
4.  If "DuckDuckGo": Calls `DDGS().text()`.
5.  Returns formatted text results to the Agent.

### B. The Browser Workflow
1.  Agent calls `browser_use(action="navigate", url="...")`.
2.  `app/tool/browser_use_tool.py` uses `BrowserSession` to control Playwright.
3.  The browser loads the page (headless).
4.  The tool returns a summary of the page content (accessibility tree) to the Agent.

### C. The Coding Workflow
1.  Agent calls `python_execute(code="...")`.
2.  `app/tool/python_execute.py` runs the code in a subprocess.
3.  Standard output (stdout) and errors (stderr) are captured.
4.  Returns the output to the Agent.

---

## 4. Configuration Guide

To configure Vazal, edit `config/config.toml`:

```toml
[llm]
model = "gpt-4o"
base_url = "https://api.openai.com/v1"
api_key = "sk-..."

[search]
engine = "Tavily"  # Options: "Tavily", "DuckDuckGo"
api_key = "tvly-..."

[browser]
headless = true
```

## 5. Extending Vazal
*   **Add a Tool:** Create a new file in `app/tool/`, inherit from `BaseTool`, and add it to `available_tools` in `app/agent/manus.py`.
*   **Change Behavior:** Edit the system prompt in `app/prompt/manus.py`.
