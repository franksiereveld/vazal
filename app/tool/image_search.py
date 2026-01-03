import os
import requests
from duckduckgo_search import DDGS
from app.tool.base import BaseTool, ToolResult
from app.config import config

class ImageSearchTool(BaseTool):
    name: str = "image_search"
    description: str = "Search for images using DuckDuckGo, Pexels (if key present), and Bing (if key present). Returns a list of valid image URLs."
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

    def _search_pexels(self, query: str, max_results: int) -> list:
        """Search Pexels API for high-quality stock photos."""
        # Check config first, then env var
        api_key = None
        if config.search_config:
            api_key = config.search_config.pexels_api_key
        if not api_key:
            api_key = os.environ.get("PEXELS_API_KEY")
            
        if not api_key:
            return []
        
        try:
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

    def _search_bing(self, query: str, max_results: int) -> list:
        """Search Bing Image Search API."""
        # Check config first, then env var
        api_key = None
        if config.search_config:
            api_key = config.search_config.bing_api_key
        if not api_key:
            api_key = os.environ.get("BING_API_KEY")

        if not api_key:
            return []
        
        try:
            headers = {"Ocp-Apim-Subscription-Key": api_key}
            url = f"https://api.bing.microsoft.com/v7.0/images/search?q={query}&count={max_results}"
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                return [img['contentUrl'] for img in data.get('value', [])]
            else:
                print(f"⚠️ Bing API Error: {response.status_code}")
                return []
        except Exception as e:
            print(f"⚠️ Bing Search Failed: {e}")
            return []

    async def execute(self, query: str, max_results: int = 5) -> ToolResult:
        all_urls = []
        sources_used = []

        # 1. Try Pexels (Best Quality)
        pexels_urls = self._search_pexels(query, max_results)
        if pexels_urls:
            all_urls.extend(pexels_urls)
            sources_used.append("Pexels")

        # 2. Try Bing (Good for News/Events)
        bing_urls = self._search_bing(query, max_results)
        if bing_urls:
            all_urls.extend(bing_urls)
            sources_used.append("Bing")

        # 3. Try DuckDuckGo (Fallback / No Key)
        # Always run this to ensure we have results if keys are missing/invalid
        try:
            ddg_results = DDGS().images(
                query, 
                region="us-en", 
                safesearch="off", 
                max_results=max_results
            )
            if ddg_results:
                ddg_urls = [r.get('image') for r in ddg_results if r.get('image')]
                all_urls.extend(ddg_urls)
                sources_used.append("DuckDuckGo")
        except Exception as e:
            print(f"⚠️ DuckDuckGo Search Failed: {e}")

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
