import asyncio
import os
import sys
from dotenv import load_dotenv

# Load secrets from .env
load_dotenv()

# Add current directory to path
sys.path.append(os.getcwd())

# Import the new class directly
try:
    from app.tool.search.tavily_search import TavilySearchEngine
except ImportError:
    print("❌ Could not import TavilySearchEngine. Did you create app/tool/search/tavily_search.py?")
    sys.exit(1)

async def main():
    print("🚀 Starting Local Tavily Search Test...")

    # Check API Key
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        print("❌ Error: TAVILY_API_KEY not found in .env file!")
        return
    print(f"✅ Found API Key: {api_key[:5]}...{api_key[-3:]}")

    # Initialize Engine
    try:
        engine = TavilySearchEngine()
    except Exception as e:
        print(f"❌ Error initializing engine: {e}")
        return

    # Run Search
    query = "What is the current stock price of Apple?"
    print(f"\n🔎 Searching for: '{query}'")

    try:
        results = await engine.search(query, num_results=2)

        if results:
            print("\n✅ Search Success! Received results from Tavily:")
            for i, res in enumerate(results):
                print(f"\n--- Result {i+1} ---")
                print(f"Title:   {res.title}")
                print(f"URL:     {res.url}")
                print(f"Snippet: {res.snippet[:150]}...")
                print(f"Source:  {res.source}")
        else:
            print("\n⚠️ Search returned 0 results (but no error).")

    except Exception as e:
        print(f"\n❌ Search Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
