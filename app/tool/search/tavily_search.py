import os
from typing import List, Optional, Any

from pydantic import PrivateAttr
from app.logger import logger
from app.tool.search.base import SearchItem, WebSearchEngine
from tavily import TavilyClient


class TavilySearchEngine(WebSearchEngine):
    """
    Tavily search engine implementation.
    """
    # Define private attributes for Pydantic
    _api_key: Optional[str] = PrivateAttr(default=None)
    _client: Optional[Any] = PrivateAttr(default=None)

    def __init__(self, **data):
        super().__init__(**data)
        self._api_key = os.environ.get("TAVILY_API_KEY")
        if not self._api_key:
            logger.warning("TAVILY_API_KEY not found in environment variables")
        else:
            self._client = TavilyClient(api_key=self._api_key)

    async def search(
        self, query: str, num_results: int = 5, **kwargs
    ) -> List[SearchItem]:
        """
        Perform a search using Tavily API.
        """
        if not self._api_key:
            logger.error("Cannot search: TAVILY_API_KEY is missing")
            return []

        try:
            # Ensure client is initialized
            if self._client is None and self._api_key:
                self._client = TavilyClient(api_key=self._api_key)

            # Tavily supports 'search_depth' ("basic" or "advanced")
            # and 'include_answer' (boolean)
            response = self._client.search(
                query=query,
                search_depth="basic",
                max_results=num_results,
                include_answer=True,
            )

            results = []

            # Add the direct answer if available
            if response.get("answer"):
                results.append(
                    SearchItem(
                        title="Tavily AI Answer",
                        url="https://tavily.com",
                        snippet=response["answer"],
                        source="tavily_answer",
                     )
                )

            # Process search results
            for result in response.get("results", []):
                item = SearchItem(
                    title=result.get("title", ""),
                    url=result.get("url", ""),
                    snippet=result.get("content", ""),
                    source="tavily",
                )
                results.append(item)

            return results

        except Exception as e:
            logger.error(f"Tavily search failed: {e}")
            return []
