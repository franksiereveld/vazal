#!/usr/bin/env python3
"""
Wrapper script to run Vazal AI in an isolated environment.
Supports multiple modes: classify, plan, execute
"""
import sys
import os
import asyncio
import argparse
import json

# Ensure we're using a fresh event loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Parse arguments
parser = argparse.ArgumentParser()
parser.add_argument("prompt", help="The user prompt")
parser.add_argument("--mode", choices=["classify", "plan", "execute"], default="execute")
args = parser.parse_args()

prompt = args.prompt
mode = args.mode

# Change to Vazal directory
vazal_path = os.environ.get('VAZAL_PATH', os.path.expanduser('~/OpenManus'))
os.chdir(vazal_path)

# Import Vazal after changing directory
sys.path.insert(0, vazal_path)

try:
    from app.agent.vazal import Vazal
    from app.schema import Message
    
    async def classify_intent(agent, prompt: str) -> dict:
        """Classify if the prompt is CHAT or TASK"""
        classifier_prompt = (
            f"Analyze this user prompt:\n"
            f"User Prompt: '{prompt}'\n\n"
            "Is this a simple CHAT greeting/question (e.g. 'hi', 'hello', 'how are you', 'what is 2+2', 'thanks') "
            "OR a TASK requiring action (e.g. 'find X', 'create a presentation', 'research Y', 'make a file')?\n\n"
            "CHAT examples: greetings, simple math, definitions, casual questions, thanks, goodbye\n"
            "TASK examples: research, create files, browse web, complex analysis, make presentations\n\n"
            "Output ONLY valid JSON:\n"
            '{"type": "CHAT", "response": "Your friendly response here"}\n'
            'OR\n'
            '{"type": "TASK", "description": "Brief task description"}'
        )
        result = await agent.llm.ask([Message.user_message(classifier_prompt)], stream=False)
        
        # Parse JSON from response
        try:
            # Clean up potential markdown code blocks
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()
            return json.loads(result)
        except json.JSONDecodeError:
            # Fallback parsing
            if "CHAT" in result.upper():
                return {"type": "CHAT", "response": "Hello! How can I help you today?"}
            return {"type": "TASK", "description": prompt}
    
    async def generate_plan(agent, prompt: str) -> dict:
        """Generate execution plan for a task"""
        plan_prompt = (
            f"You are an expert planner. The user wants to: '{prompt}'\n"
            "Create a concise, high-level plan (3-5 bullet points) to achieve this.\n"
            "Focus on the key steps (e.g., 'Search for X', 'Download images', 'Create PPT').\n"
            "Do NOT include internal details like 'call tool X'. Keep it user-friendly.\n\n"
            "Output ONLY valid JSON:\n"
            '{"plan": ["Step 1", "Step 2", "Step 3"], "estimated_time": "30 seconds"}'
        )
        result = await agent.llm.ask([Message.user_message(plan_prompt)], stream=False)
        
        try:
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()
            return json.loads(result)
        except json.JSONDecodeError:
            return {
                "plan": ["Analyze the request", "Execute the task", "Return results"],
                "estimated_time": "30 seconds"
            }
    
    async def execute_task(agent, prompt: str) -> str:
        """Execute the full agent task"""
        await agent.run(prompt)
        
        # Extract final answer
        final_answer = "✅ Task Completed."
        
        if agent.memory.messages:
            for msg in reversed(agent.memory.messages):
                if msg.role == "assistant":
                    # Check for terminate output
                    if msg.tool_calls:
                        for tc in msg.tool_calls:
                            if tc.function.name == "terminate":
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
        
        return final_answer
    
    async def main():
        agent = Vazal()
        
        try:
            if mode == "classify":
                result = await classify_intent(agent, prompt)
                print(json.dumps(result))
                
            elif mode == "plan":
                result = await generate_plan(agent, prompt)
                print(json.dumps(result))
                
            elif mode == "execute":
                result = await execute_task(agent, prompt)
                print(f"🤖 Vazal: {result}")
                
        finally:
            await agent.cleanup()
    
    asyncio.run(main())
    
except Exception as e:
    print(f"Error running Vazal: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
