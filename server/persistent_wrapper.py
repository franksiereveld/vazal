#!/usr/bin/env python3
"""
Persistent Vazal Wrapper

Stays running and handles requests via stdin/stdout JSON protocol.
This avoids cold start delays for subsequent requests.

Protocol:
- Input (stdin): JSON lines with { prompt, mode, requestId }
- Output (stdout): JSON lines with { requestId, result } or { requestId, error }
- Ready signal: { type: "ready" }
"""
import sys
import os
import asyncio
import json
import logging

# Redirect ALL logging to stderr
logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
for name in ['chromadb', 'sentence_transformers', 'browser_use', 'httpx', 'urllib3', 'openai']:
    logging.getLogger(name).setLevel(logging.ERROR)

# Change to Vazal directory
vazal_path = os.environ.get('VAZAL_PATH', os.path.expanduser('~/OpenManus'))
os.chdir(vazal_path)
sys.path.insert(0, vazal_path)

# Capture stdout during imports
original_stdout = sys.stdout
sys.stdout = sys.stderr

from app.agent.vazal import Vazal
from app.schema import Message

sys.stdout = original_stdout

# Global agent instance (kept warm)
agent = None

def output(data: dict):
    """Send JSON response to stdout"""
    print(json.dumps(data), flush=True)

async def classify_intent(prompt: str) -> dict:
    """Classify if prompt is CHAT or TASK"""
    classifier_prompt = (
        f"Analyze: '{prompt}'\n\n"
        "Is this CHAT (greeting, simple question, thanks) or TASK (research, create files, complex work)?\n\n"
        "Output ONLY JSON:\n"
        '{"type": "CHAT", "response": "friendly response"} OR {"type": "TASK", "description": "brief"}'
    )
    
    sys.stdout = sys.stderr
    result = await agent.llm.ask([Message.user_message(classifier_prompt)], stream=False)
    sys.stdout = original_stdout
    
    try:
        # Extract JSON
        result = result.strip()
        if "```" in result:
            result = result.split("```")[1].split("```")[0].strip()
            if result.startswith("json"):
                result = result[4:].strip()
        
        start = result.find('{')
        end = result.rfind('}') + 1
        if start >= 0 and end > start:
            result = result[start:end]
        
        return json.loads(result)
    except:
        # Fallback
        upper = prompt.upper()
        if any(g in upper for g in ['HI', 'HELLO', 'HEY', 'THANKS', 'THANK YOU', 'BYE', 'GOODBYE']):
            return {"type": "CHAT", "response": "Hello! How can I help you today?"}
        return {"type": "TASK", "description": prompt}

async def generate_plan(prompt: str) -> dict:
    """Generate execution plan"""
    plan_prompt = (
        f"Create a 3-5 step plan for: '{prompt}'\n"
        "Output ONLY JSON: {\"plan\": [\"step1\", \"step2\"], \"estimated_time\": \"30 seconds\"}"
    )
    
    sys.stdout = sys.stderr
    result = await agent.llm.ask([Message.user_message(plan_prompt)], stream=False)
    sys.stdout = original_stdout
    
    try:
        result = result.strip()
        if "```" in result:
            result = result.split("```")[1].split("```")[0].strip()
            if result.startswith("json"):
                result = result[4:].strip()
        
        start = result.find('{')
        end = result.rfind('}') + 1
        if start >= 0 and end > start:
            result = result[start:end]
        
        return json.loads(result)
    except:
        return {"plan": ["Analyze request", "Execute task", "Return results"], "estimated_time": "30 seconds"}

async def execute_task(prompt: str, request_id: str) -> str:
    """Execute full agent task with activity streaming"""
    
    def send_activity(message: str, step: int = 0, total: int = 0):
        """Send activity update to UI"""
        output({
            "type": "activity",
            "requestId": request_id,
            "message": message,
            "step": step,
            "total": total
        })
    
    # Track tool calls for activity updates
    original_tool_call = None
    step_count = 0
    
    # Wrap agent to capture tool calls
    class ActivityTracker:
        def __init__(self, agent):
            self.agent = agent
            self.step = 0
            
        async def track_execution(self):
            # Send initial activity
            send_activity("Starting task execution...", 0, 5)
            
            sys.stdout = sys.stderr
            await self.agent.run(prompt)
            sys.stdout = original_stdout
    
    tracker = ActivityTracker(agent)
    
    # Send activity updates during execution
    send_activity("Analyzing request...", 1, 5)
    
    sys.stdout = sys.stderr
    await agent.run(prompt)
    sys.stdout = original_stdout
    
    send_activity("Processing complete", 5, 5)
    
    # Extract result
    final = "Task completed."
    if agent.memory.messages:
        for msg in reversed(agent.memory.messages):
            if msg.role == "assistant":
                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        if tc.function.name == "terminate":
                            try:
                                args = json.loads(tc.function.arguments)
                                if args.get("output"):
                                    final = args["output"]
                                    break
                            except:
                                pass
                if msg.content and final == "Task completed.":
                    final = msg.content
                    break
    
    # Reset agent memory for next task
    agent.memory.messages = []
    
    return final

async def handle_request(data: dict):
    """Handle a single request"""
    request_id = data.get("requestId", "unknown")
    mode = data.get("mode", "execute")
    prompt = data.get("prompt", "")
    
    try:
        if mode == "classify":
            result = await classify_intent(prompt)
            output({"requestId": request_id, "result": result})
        elif mode == "plan":
            result = await generate_plan(prompt)
            output({"requestId": request_id, "result": result})
        elif mode == "execute":
            result = await execute_task(prompt, request_id)
            output({"requestId": request_id, "result": result})
        else:
            output({"requestId": request_id, "error": f"Unknown mode: {mode}"})
    except Exception as e:
        output({"requestId": request_id, "error": str(e)})

async def main():
    global agent
    
    # Initialize agent (this is the slow part - only done once)
    print("Initializing Vazal...", file=sys.stderr)
    sys.stdout = sys.stderr
    agent = Vazal()
    sys.stdout = original_stdout
    print("Vazal ready!", file=sys.stderr)
    
    # Signal ready
    output({"type": "ready"})
    
    # Read requests from stdin
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)
    
    while True:
        try:
            line = await reader.readline()
            if not line:
                break
            
            line = line.decode().strip()
            if not line:
                continue
            
            data = json.loads(line)
            await handle_request(data)
            
        except json.JSONDecodeError as e:
            print(f"Invalid JSON: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        sys.exit(1)
