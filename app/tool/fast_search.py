from duckduckgo_search import DDGS
from app.tool.base import BaseTool

class FastSearch(BaseTool):
    """
    A lightning-fast search tool using DuckDuckGo API.
    Use this for general information, facts, and lists.
    Use 'browser_use' only if you need to login or click buttons.
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
        try:
            results = DDGS().text(query, max_results=max_results)
            if not results:
                return "No results found."

            formatted = f"--- Fast Search Results for '{query}' ---\n"
            for i, r in enumerate(results, 1):
                formatted += f"{i}. {r['title']}\n   {r['body']}\n   URL: {r['href']}\n\n"
            return formatted
        except Exception as e:
            return f"FAST SEARCH FAILED ({e}). PLEASE USE 'browser_use' TOOL INSTEAD."

