# Getting Started with Vazal AI

## Prerequisites
*   Python 3.10+
*   Pip (Python Package Manager)
*   **API Keys:**
    *   OpenAI API Key (for the brain)
    *   Tavily API Key (for search)

## Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-repo/vazal-ai.git
    cd vazal-ai
    ```

2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    pip install tavily-python  # Required for high-quality search
    ```

3.  **Configure the Agent:**
    Copy the example config and edit it:
    ```bash
    cp config/config.example.toml config/config.toml
    ```
    
    Open `config/config.toml` and add your keys:
    ```toml
    [llm]
    model = "gpt-4o"
    api_key = "sk-..."

    [search]
    engine = "Tavily"
    ```

4.  **Set Environment Variables (Optional but Recommended):**
    ```bash
    export TAVILY_API_KEY="tvly-..."
    export OPENAI_API_KEY="sk-..."
    ```

## Running the Agent

### Interactive Mode
To chat with Vazal AI in the terminal:
```bash
python main.py
```

### Programmatic Use
You can import Vazal into your own Python scripts:

```python
import asyncio
from app.agent.manus import Manus
from app.schema import Message

async def main():
    agent = Manus()
    prompt = "Find the top 3 AI news stories today."
    
    agent.memory.add_message(Message(role="user", content=prompt))
    
    while True:
        finished = await agent.think()
        if finished:
            break
        await agent.act()

if __name__ == "__main__":
    asyncio.run(main())
```

## Troubleshooting

*   **"Authentication Failed":** Check your API keys in `config.toml`.
*   **"BrowserSession API mismatch":** Ensure you have the latest `browser-use` package and are using the patched `browser_use_tool.py`.
*   **"No results found":** Verify your Tavily key is active and the `search.engine` is set to "Tavily" in config.
