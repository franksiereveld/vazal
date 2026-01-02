# Vazal.ai Codebase Documentation

This document provides a comprehensive overview of the Vazal.ai (formerly OpenManus) codebase structure and key files.

## Root Directory

- **main.py**: The main entry point for the Vazal agent. Handles CLI arguments, initializes the `Vazal` agent, and runs the interactive loop.
- **sandbox_main.py**: Entry point for running the agent in a sandboxed environment (e.g., Daytona).
- **run_flow.py**: Script to run the agent within a defined flow (e.g., planning flow).
- **run_mcp_server.py**: Script to launch the Vazal MCP (Model Context Protocol) server.
- **setup.py**: Package installation script with metadata and dependencies.
- **config/config.toml**: Main configuration file for API keys, model settings, and tool options.
- **VAZAL_SYSTEM_DESIGN.md**: High-level system architecture documentation.

## Core Agent Logic (`app/agent/`)

- **manus.py**: Defines the `Vazal` class (formerly `Manus`), the main agent orchestration class. It manages tool execution, memory, and the think-act loop.
- **sandbox_agent.py**: Defines `SandboxVazal`, a specialized version of the agent for sandboxed environments.
- **toolcall.py**: Base class for agents that use tool calling capabilities of LLMs.
- **base.py**: Abstract base class for all agents.
- **memory/lessons.py**: Manages the agent's learning mechanism (saving and retrieving lessons).

## Tools (`app/tool/`)

- **base.py**: Base class for all tools.
- **fast_search.py**: Implements fast web search using APIs like Tavily or DuckDuckGo.
- **browser_use_tool.py**: Integrates `browser-use` for full browser automation (navigation, interaction).
- **python_execute.py**: Allows the agent to execute Python code in a safe environment.
- **str_replace_editor.py**: Tool for editing text files using string replacement.
- **terminate.py**: Tool to signal task completion.
- **crawl4ai.py**: Web crawler tool for extracting clean markdown from websites.
- **mcp.py**: Client implementation for connecting to MCP servers.

## Configuration & Prompts (`app/`)

- **config.py**: Loads and validates configuration from `config.toml`.
- **prompt/manus.py**: Contains the system prompts and next-step prompts for the Vazal agent.
- **schema.py**: Defines Pydantic models for messages, tool calls, and other data structures.
- **logger.py**: Configures the `loguru` logger for console and file output.

## Protocol (`protocol/`)

- **a2a/**: Implementation of the Agent-to-Agent protocol, allowing Vazal to communicate with other agents or platforms.
  - **app/agent.py**: Adapter class `A2AVazal` for the protocol.
  - **app/main.py**: Server entry point for the A2A service.

## Tests

- **test_agent.py**: Simple test script for basic agent functionality.
- **test_gauntlet.py**: Comprehensive test suite covering search, python, browser, and file editing capabilities.
- **verify_current.py**: Script to verify imports and basic initialization after refactoring.

## Key Changes from OpenManus

1.  **Renaming**: All classes and references changed from `Manus`/`OpenManus` to `Vazal`.
2.  **Search**: Integrated Tavily as a premium search provider in `fast_search.py`.
3.  **Browser**: Updated `browser_use_tool.py` to use the latest `browser-use` API (`BrowserSession`).
4.  **Configuration**: Standardized on `config.toml` for all settings.
