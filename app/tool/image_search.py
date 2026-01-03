from duckduckgo_search import DDGS
from app.tool.base import BaseTool, ToolResult

class ImageSearchTool(BaseTool):
    name: str = "image_search"
    description: str = "Search for images using DuckDuckGo. Returns a list of valid image URLs."
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

    async def execute(self, query: str, max_results: int = 5) -> ToolResult:
        try:
            # Use 'us-en' region for better results
            # DDGS().images returns a list of dicts with 'image', 'title', 'url', etc.
            results = DDGS().images(
                query, 
                region="us-en", 
                safesearch="off", 
                max_results=max_results
            )
            
            if not results:
                return ToolResult(output="No images found.")

            # Extract URLs
            image_urls = []
            formatted = f"--- Image Search Results for '{query}' ---\n"
            
            for i, r in enumerate(results, 1):
                url = r.get('image')
                if url:
                    image_urls.append(url)
                    formatted += f"{i}. {url}\n"
            
            if not image_urls:
                return ToolResult(output="No valid image URLs found.")
                
            return ToolResult(output=formatted)

        except Exception as e:
            return ToolResult(error=f"Image search failed: {e}")
