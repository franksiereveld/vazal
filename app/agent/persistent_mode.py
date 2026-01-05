"""
Persistent mode for Vazal - keeps agent warm between requests
"""
import sys
import json
import asyncio
from typing import Optional

async def run_persistent_mode():
    """
    Initialize agent once and process multiple requests via stdin/stdout
    """
    # Import here to avoid circular dependencies
    from app.agent.vazal import Vazal
    from app.schema import Message
    
    print("🤖 Vazal is waking up...", flush=True)
    
    # Initialize agent ONCE
    agent = Vazal()
    print("✅ Ready!", flush=True)
    
    try:
        
        # Event loop - process requests from stdin
        while True:
            try:
                # Read JSON from stdin
                line = sys.stdin.readline()
                if not line:
                    # EOF reached, exit gracefully
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                # Parse request
                try:
                    request = json.loads(line)
                except json.JSONDecodeError as e:
                    print(f"[Vazal Error] Invalid JSON: {e}", file=sys.stderr, flush=True)
                    continue
                
                prompt = request.get("prompt", "")
                if not prompt:
                    print("[Vazal Error] No prompt provided", file=sys.stderr, flush=True)
                    continue
                
                print(f"🚀 Starting Task: \"{prompt}\"", flush=True)
                
                # Classify intent (chat vs task) - inline logic from main.py
                context_str = ""
                if agent.memory.messages:
                    recent = agent.memory.messages[-3:]
                    for m in recent:
                        role = "User" if m.role == "user" else "Assistant" if m.role == "assistant" else "System"
                        content = m.content if m.content else "[Tool Call/Result]"
                        context_str += f"{role}: {content}\n"
                
                classifier_prompt = (
                    f"Analyze this user prompt in context:\n"
                    f"--- CONTEXT START ---\n{context_str}--- CONTEXT END ---\n\n"
                    f"User Prompt: '{prompt}'\n\n"
                    "Is this a simple CHAT greeting/question (e.g. 'hi', 'how are you') "
                    "OR a TASK/CORRECTION requiring action (e.g. 'find X', 'fix that', 'it is missing pictures')?\n"
                    "CRITICAL: If the user is correcting a previous task (e.g. 'you forgot X', 'try again'), classify as TASK.\n"
                    "Output format:\n"
                    "TYPE: [CHAT or TASK]\n"
                    "RESPONSE: [If CHAT, write the response here. If TASK, write the task description]"
                )
                
                classification = await agent.llm.ask([Message.user_message(classifier_prompt)], stream=False)
                print(f"✨ Vazal's thoughts: {classification}", flush=True)
                
                # Process based on intent
                if "TYPE: CHAT" in classification:
                    # Extract the chat response
                    parts = classification.split("RESPONSE:")
                    response = parts[1].strip() if len(parts) > 1 else classification
                else:
                    # Full agent execution with tools
                    response = await agent.run(prompt)
                
                # Extract final answer
                final_answer = extract_final_answer(response)
                
                # Send result back
                print(f"🤖 Vazal: {final_answer}", flush=True)
                
            except KeyboardInterrupt:
                print("\n[Vazal] Interrupted by user", flush=True)
                break
            except Exception as e:
                print(f"[Vazal Error] {type(e).__name__}: {str(e)}", file=sys.stderr, flush=True)
                # Continue processing next request even if this one failed
                continue
                
    finally:
        # Cleanup
        print("🔄 Shutting down Vazal...", flush=True)
        # No explicit cleanup needed - Vazal handles it internally
        print("👋 Goodbye!", flush=True)


def extract_final_answer(response) -> str:
    """
    Extract the final answer from agent response
    """
    if isinstance(response, str):
        return response
    
    # If response is a dict with 'answer' or 'result' key
    if isinstance(response, dict):
        if 'answer' in response:
            return response['answer']
        if 'result' in response:
            return response['result']
        if 'content' in response:
            return response['content']
    
    # If response has a final_answer attribute
    if hasattr(response, 'final_answer'):
        return response.final_answer
    
    # If response has a content attribute
    if hasattr(response, 'content'):
        return response.content
    
    # Fallback to string representation
    return str(response)


if __name__ == "__main__":
    # Allow running this module directly for testing
    asyncio.run(run_persistent_mode())
