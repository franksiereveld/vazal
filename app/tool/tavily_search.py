import os
from typing import Optional
from tavily import TavilyClient
from app.tool.base import BaseTool, ToolResult
from app.config import config
from app.logger import logger

class TavilySearch(BaseTool):
    name: str = "tavily_search"
    description: str = "Perform a high-quality web search using Tavily API. Optimized for AI agents to get factual, up-to-date information."
    parameters: dict = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query",
            },
            "search_depth": {
                "type": "string",
                "enum": ["basic", "advanced"],
                "description": "Search depth. 'basic' is faster, 'advanced' is deeper. Default: basic",
            },
            "include_answer": {
                "type": "boolean",
                "description": "Whether to include a short answer in the response. Default: False",
            }
        },
        "required": ["query"],
    }

    def execute(self, query: str, search_depth: str = "basic", include_answer: bool = False) -> ToolResult:
        api_key = os.environ.get("TAVILY_API_KEY")
        
        if config.search_config:
            # Priority 1: Specific Tavily Key
            if config.search_config.tavily_api_key:
                api_key = config.search_config.tavily_api_key
            # Priority 2: Generic API Key (if engine is Tavily)
            elif config.search_config.api_key and config.search_config.engine.lower() == "tavily":
                api_key = config.search_config.api_key
            
        if not api_key:
            return ToolResult(error="Tavily API Key not found. Please set TAVILY_API_KEY in env or config.")

        try:
            logger.info(f"🔎 Searching Tavily for: {query} (depth={search_depth})")
            client = TavilyClient(api_key=api_key)
            
            response = client.search(
                query=query,
                search_depth=search_depth,
                include_answer=include_answer,
                max_results=5
            )
            
            output = f"--- Tavily Search Results for '{query}' ---\n"
            
            if include_answer and response.get("answer"):
                output += f"💡 Answer: {response['answer']}\n\n"
                
            for i, result in enumerate(response.get("results", []), 1):
                output += f"{i}. {result['title']}\n"
                output += f"   URL: {result['url']}\n"
                output += f"   Content: {result['content'][:300]}...\n\n"
                
            return ToolResult(output=output)
            
        except Exception as e:
            logger.error(f"⚠️ Tavily Search Failed: {e}")
            return ToolResult(error=f"Tavily Search Failed: {str(e)}")
