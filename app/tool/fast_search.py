import os
from app.tool.base import BaseTool
from app.config import config
from app.logger import logger

class FastSearch(BaseTool):
    """
    A lightning-fast search tool that supports multiple engines (Tavily, DuckDuckGo).
    Use this for general information, facts, and lists.
    """
    name: str = "fast_search"
    description: str = "Search the web instantly. Returns top results with snippets."
    parameters: dict = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query",
            },
            "max_results": {
                "type": "integer",
                "description": "Number of results to return (default: 5)",
            }
        },
        "required": ["query"],
    }

    async def execute(self, query: str, max_results: int = 5) -> str:
        engine = "DuckDuckGo"
        if config.search_config and config.search_config.engine:
            engine = config.search_config.engine

        logger.info(f"Using search engine: {engine}")

        try:
            if engine.lower() == "tavily":
                return await self._search_tavily(query, max_results)
            else:
                return await self._search_ddg(query, max_results)
        except Exception as e:
            logger.error(f"Search failed with {engine}: {e}")
            # Fallback to DDG if Tavily fails
            if engine.lower() != "duckduckgo":
                logger.info("Falling back to DuckDuckGo...")
                return await self._search_ddg(query, max_results)
            return f"Search failed: {e}"

    async def _search_tavily(self, query: str, max_results: int) -> str:
        try:
            from tavily import TavilyClient
            api_key = config.search_config.api_key if config.search_config and config.search_config.api_key else os.environ.get("TAVILY_API_KEY")
            if not api_key:
                raise ValueError("TAVILY_API_KEY not found in config or environment")
            
            client = TavilyClient(api_key=api_key)
            # Tavily python client is synchronous, but fast enough. 
            # For true async, we'd use a thread executor or aiohttp, but let's keep it simple for now.
            response = client.search(query=query, max_results=max_results)
            
            results = response.get("results", [])
            if not results:
                return "No results found."

            formatted = f"--- Tavily Search Results for '{query}' ---\n"
            for i, r in enumerate(results, 1):
                formatted += f"{i}. {r['title']}\n   {r['content']}\n   URL: {r['url']}\n\n"
            return formatted
        except ImportError:
            raise ImportError("tavily-python package not installed. Run `pip install tavily-python`")

    async def _search_ddg(self, query: str, max_results: int) -> str:
        try:
            from duckduckgo_search import DDGS
            results = DDGS().text(query, max_results=max_results)
            if not results:
                return "No results found."

            formatted = f"--- DuckDuckGo Search Results for '{query}' ---\n"
            for i, r in enumerate(results, 1):
                formatted += f"{i}. {r['title']}\n   {r['body']}\n   URL: {r['href']}\n\n"
            return formatted
        except Exception as e:
            return f"DuckDuckGo Search failed: {e}"
