#!/usr/bin/env python3
"""
Wrapper script to run Vazal AI in an isolated environment.
This prevents event loop conflicts when called from Node.js.
"""
import sys
import os
import asyncio

# Ensure we're using a fresh event loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Get the prompt from command line
if len(sys.argv) < 2:
    print("Error: No prompt provided", file=sys.stderr)
    sys.exit(1)

prompt = sys.argv[1]

# Change to Vazal directory
vazal_path = os.environ.get('VAZAL_PATH', '/Users/I048134/OpenManus')
os.chdir(vazal_path)

# Import Vazal after changing directory
sys.path.insert(0, vazal_path)

try:
    from app.agent.vazal import Vazal
    from app.prompt.manus import NEXT_STEP_PROMPT, SYSTEM_PROMPT
    from app.schema import Message
    
    async def run_vazal():
        """Run Vazal with the given prompt"""
        # Create agent instance
        agent = Vazal(
            system_prompt=SYSTEM_PROMPT,
            next_step_prompt=NEXT_STEP_PROMPT,
        )
        
        try:
            # Run the agent
            await agent.run(prompt)
            
            # Extract final answer
            final_answer = "✅ Task Completed."
            
            if agent.memory.messages:
                # Look for the last meaningful assistant message
                for msg in reversed(agent.memory.messages):
                    if msg.role == "assistant":
                        # Check for terminate output
                        if msg.tool_calls:
                            for tc in msg.tool_calls:
                                if tc.function.name == "terminate":
                                    import json
                                    try:
                                        args = json.loads(tc.function.arguments)
                                        if args.get("output"):
                                            final_answer = args.get("output")
                                            break
                                    except:
                                        pass
                        
                        # Use message content if available
                        if msg.content and final_answer == "✅ Task Completed.":
                            final_answer = msg.content
                            break
            
            # Print final answer (this is what gets captured)
            print(f"🤖 Vazal: {final_answer}")
            
        finally:
            await agent.cleanup()
    
    # Run with a fresh event loop
    asyncio.run(run_vazal())
    
except Exception as e:
    print(f"Error running Vazal: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
