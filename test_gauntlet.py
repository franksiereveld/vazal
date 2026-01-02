import asyncio
import sys
import os
import time

# Add current directory to sys.path
sys.path.append(os.getcwd())

from app.agent.manus import Vazal as Manus
from app.schema import Message
from app.logger import logger

# Set environment variables for keys
os.environ["TAVILY_API_KEY"] = "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"
os.environ["LOGFIRE_TOKEN"] = "pylf_v1_eu_1ycR6vPzYS8r18YKFXz7TL6hCG58tgqhjSjsPdf9Srcl"

async def run_test(name, prompt, max_steps=10):
    print(f"\n\n{'='*20} TEST: {name} {'='*20}")
    print(f"Prompt: {prompt}")
    
    agent = Manus()
    agent.memory.add_message(Message(role="user", content=prompt))
    
    start_time = time.time()
    steps = 0
    
    try:
        for i in range(max_steps):
            print(f"\n--- Step {i+1} ---")
            finished = await agent.think()
            
            # Print the last tool call or message
            if agent.tool_calls:
                for tc in agent.tool_calls:
                    print(f"🛠️ Tool Call: {tc.function.name}({tc.function.arguments})")
                    
                    # Execute the tool (since think() only decides, act() executes)
                    # But Manus.run() loop does both. Here we are manually stepping.
                    # We need to call act() to get the result.
                    result = await agent.act()
                    print(f"✅ Result: {result[:200]}..." if len(result) > 200 else f"✅ Result: {result}")
            else:
                # No tool calls, likely a final answer or thought
                last_msg = agent.memory.messages[-1]
                print(f"🤖 Agent: {last_msg.content}")
            
            steps += 1
            if finished:
                print(f"\n✅ Test '{name}' PASSED in {time.time() - start_time:.2f}s ({steps} steps)")
                return True
                
    except Exception as e:
        print(f"\n❌ Test '{name}' FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    print(f"\n⚠️ Test '{name}' TIMED OUT after {max_steps} steps")
    return False

async def main():
    print("🚀 Starting Vazal AI Gauntlet Test")
    
    # Test 1: Search (Tavily)
    await run_test("Search Capability", "Find 3 popular restaurants in Zurich and list their names.")
    
    # Test 2: Python (Calculation)
    await run_test("Python Capability", "Calculate the 30th Fibonacci number using Python.")
    
    # Test 3: Browser (Navigation)
    await run_test("Browser Capability", "Go to example.com and tell me the title of the page.")

    # Test 4: File Editing
    await run_test("File Editing Capability", "Create a file named 'vazal_test.txt' with content 'Vazal was here', then read it back to verify.")

    # Test 5: Bash Command
    await run_test("Bash Capability", "List the files in the current directory using ls -la.")

if __name__ == "__main__":
    asyncio.run(main())
