import os
import requests
from duckduckgo_search import DDGS
from app.tool.base import BaseTool, ToolResult
from app.config import config

class ImageSearchTool(BaseTool):
    name: str = "image_search"
    description: str = "Search for images using DuckDuckGo and Pexels (if key present). Returns a list of valid image URLs."
    parameters: dict = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The image search query",
            },
            "max_results": {
                "type": "integer",
                "description": "Number of images to return (default: 5)",
            }
        },
        "required": ["query"],
    }

    def _search_tavily(self, query: str, max_results: int) -> list:
        """Search Tavily API for images."""
        api_key = None
        if config.search_config:
            api_key = config.search_config.tavily_api_key or config.search_config.api_key
        
        if not api_key:
            api_key = os.environ.get("TAVILY_API_KEY")
            
        if not api_key:
            return []
            
        try:
            from tavily import TavilyClient
            print(f"🔎 Searching Tavily Images for: {query}")
            client = TavilyClient(api_key=api_key)
            response = client.search(query, search_depth="basic", include_images=True, max_results=max_results)
            images = response.get('images', [])
            # Handle case where images are just a list of URL strings
            if images and isinstance(images[0], str):
                return images
            # Handle case where images are dictionaries (e.g. {'url': '...'})
            return [img.get('url', img) if isinstance(img, dict) else img for img in images]
        except Exception as e:
            print(f"⚠️ Tavily Image Search Failed: {e}")
            return []

    def _search_pexels(self, query: str, max_results: int) -> list:
        """Search Pexels API for high-quality stock photos."""
        # Check config first, then env var
        api_key = None
        if config.search_config:
            api_key = config.search_config.pexels_api_key
        if not api_key:
            api_key = os.environ.get("PEXELS_API_KEY")
            
        if not api_key:
            print("ℹ️ Pexels API Key not found in config or env.")
            return []
        
        try:
            print(f"🔎 Searching Pexels for: {query}")
            headers = {"Authorization": api_key}
            url = f"https://api.pexels.com/v1/search?query={query}&per_page={max_results}"
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                # Prefer 'large2x' or 'large' for quality
                return [photo['src']['large2x'] for photo in data.get('photos', [])]
            else:
                print(f"⚠️ Pexels API Error: {response.status_code}")
                return []
        except Exception as e:
            print(f"⚠️ Pexels Search Failed: {e}")
            return []



    async def execute(self, query: str, max_results: int = 5) -> ToolResult:
        all_urls = []
        sources_used = []

        # 1. Try Pexels (Best Quality)
        pexels_urls = self._search_pexels(query, max_results)
        if pexels_urls:
            all_urls.extend(pexels_urls)
            sources_used.append("Pexels")



        # 2. Try Tavily (Reliable Fallback)
        tavily_urls = self._search_tavily(query, max_results)
        if tavily_urls:
            all_urls.extend(tavily_urls)
            sources_used.append("Tavily")

        if not all_urls:
            return ToolResult(output="No images found from any source (Pexels, Bing, DuckDuckGo).")

        # Format Output
        formatted = f"--- Image Search Results for '{query}' ---\n"
        formatted += f"Sources Used: {', '.join(sources_used)}\n\n"
        
        # Deduplicate while preserving order
        seen = set()
        unique_urls = []
        for url in all_urls:
            if url not in seen:
                unique_urls.append(url)
                seen.add(url)

        for i, url in enumerate(unique_urls[:max_results*2], 1): # Return more results since we combined sources
            formatted += f"{i}. {url}\n"
        
        return ToolResult(output=formatted)
