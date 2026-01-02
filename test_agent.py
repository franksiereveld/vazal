import asyncio
import sys
import os

# Add current directory to sys.path
sys.path.append(os.getcwd())

from app.agent.manus import Manus
from app.logger import logger

async def main():
    print("=== Starting Agent Test: Find Restaurants in Zurich ===")
    
    agent = Manus()
    
    # Simulate a user request
    prompt = "Find 3 popular restaurants in Zurich and list their names."
    
    print(f"User: {prompt}")
    print("Agent is thinking...")
    
    try:
        # We manually inject the prompt into the agent's memory or run loop
        # Since Manus.run() is an interactive loop, we might need to call think() directly
        # or use a method that accepts a single prompt.
        
        # Looking at manus.py, it inherits from ToolCallAgent.
        # Usually there is a run() method.
        
        # Let's try to use the agent's memory to add the user message
        from app.schema import Message
        
        agent.memory.add_message(Message(role="user", content=prompt))
        
        # Run the agent loop for a few steps
        for i in range(5):
            print(f"--- Step {i+1} ---")
            finished = await agent.think()
            if finished:
                print("Agent finished!")
                break
                
    except Exception as e:
        print(f"❌ Agent crashed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
