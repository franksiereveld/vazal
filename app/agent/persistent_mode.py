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
    from app.agent.classify_intent import classify_intent
    
    print("🤖 Vazal is waking up...", flush=True)
    
    # Initialize agent ONCE
    agent = Vazal()
    
    try:
        await agent.__aenter__()  # Initialize browser, database, etc.
        print("✅ Ready!", flush=True)
        
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
                
                # Classify intent (chat vs task)
                intent = await classify_intent(prompt, agent.memory)
                print(f"✨ Vazal's thoughts: Classified as {intent}", flush=True)
                
                # Process based on intent
                if intent == "CHAT":
                    # Quick chat response using LLM directly
                    response = await agent.chat_response(prompt)
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
        await agent.__aexit__(None, None, None)
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
