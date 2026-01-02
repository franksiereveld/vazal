import argparse
import asyncio
import sys
import os
import subprocess
# from rich.console import Console
# from rich.status import Status
from loguru import logger

from app.agent.manus import Vazal
from app.prompt.manus import NEXT_STEP_PROMPT, SYSTEM_PROMPT
from app.schema import Message

# --- LOGGING SETUP ---
logger.remove()
# 1. Console: Only show ERRORS (Clean UI)
logger.add(sys.stderr, level="ERROR")
# 2. File: Show EVERYTHING (Debug)
logger.add("agent.log", level="INFO", rotation="10 MB", mode="w")
# ---------------------

async def classify_intent(agent, prompt):
    """
    Ask the LLM to decide if this is a simple CHAT or a complex TASK.
    Includes recent context to detect if a "chat" is actually a correction to a previous task.
    """
    # 1. Gather recent context (last 3 messages)
    context_str = ""
    if agent.memory.messages:
        # Get last 3 messages, skipping system prompts if possible, but raw messages are fine
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
    # Wrap string in Message object
    return await agent.llm.ask([Message.user_message(classifier_prompt)])

async def generate_plan(agent, prompt):
    """
    Generates a high-level plan for the user to review before execution.
    """
    plan_prompt = (
        f"You are an expert planner. The user wants to: '{prompt}'\n"
        "Create a concise, high-level plan (3-5 bullet points) to achieve this.\n"
        "Focus on the key steps (e.g., 'Search for X', 'Download images', 'Create PPT').\n"
        "Do NOT include internal details like 'call tool X'. Keep it user-friendly."
    )
    return await agent.llm.ask([Message.user_message(plan_prompt)])

async def suggest_and_save_lesson(agent, prompt, final_answer):
    """
    Analyzes the interaction to see if a lesson should be learned.
    Now runs for BOTH Chat and Task interactions.
    """
    # Construct context from last few messages to detect follow-up corrections
    context_summary = ""
    if len(agent.memory.messages) > 4:
        # Get last 2 user messages and last 2 assistant messages
        recent = agent.memory.messages[-4:]
        for m in recent:
            role = "User" if m.role == "user" else "Assistant"
            content = m.content if m.content else "[Tool Call/Result]"
            context_summary += f"{role}: {content}\n"
    else:
        context_summary = f"User: {prompt}\nResult: {final_answer}"

    reflection_prompt = (
        f"Review this interaction:\n{context_summary}\n"
        "Did the user provide a CORRECTION, PREFERENCE, or NEW CONSTRAINT in this follow-up? "
        "Look for keywords like 'again', 'missing', 'verbose', 'not', 'instead'.\n"
        "Examples: 'I meant Italian food', 'Use Python 3.10', 'Don't use that tool', 'Pictures are missing'.\n"
        "If yes, output ONLY the lesson text (e.g. 'User prefers Italian food'). "
        "If no specific lesson, output 'NO'."
    )
    
    try:
        # Wrap string in Message object
        lesson_suggestion = await agent.llm.ask([Message.user_message(reflection_prompt)])

        if lesson_suggestion and "NO" not in lesson_suggestion.upper() and len(lesson_suggestion) > 5:
            print(f"💡 Suggested Lesson: \"{lesson_suggestion}\"")
            confirm = input("Save this lesson? (y/n): ").lower()
            if confirm in ['y', 'yes']:
                agent.memory_manager.save_lesson(lesson_suggestion)
                print("✅ Lesson saved.")
        else:
            print("🤷 No new lessons learned.")
    except Exception as e:
        logger.error(f"Error in lesson suggestion: {e}")

async def main():
    parser = argparse.ArgumentParser(description="Vazal AI Agent")
    parser.add_argument("--prompt", type=str, help="Initial prompt")
    parser.add_argument("--verbose", action="store_true", help="Show detailed logs in console")
    args = parser.parse_args()

    # Configure Logging based on Verbose flag
    if args.verbose:
        logger.remove()
        logger.add(sys.stderr, level="INFO")
        logger.add("agent.log", level="DEBUG", rotation="10 MB", mode="w")
        print("🔧 Verbose mode enabled")

    # Initialize Agent
    print("🤖 Vazal is waking up...")
    agent = Vazal()
    print("✅ Ready!\n")

    # If prompt provided via CLI
    if args.prompt:
        print(f"🚀 Starting Task: \"{args.prompt}\"")
        await agent.run(args.prompt)
        return

    # Interactive Loop
    try:
        while True:
            prompt = input("\n👉 Enter your prompt: ")

            if prompt.lower() in ['exit', 'quit']:
                break

            if not prompt.strip():
                continue

            # 1. Classify Intent
            classification = await classify_intent(agent, prompt)
            logger.info(f"DECISION: {classification}")

            final_answer = ""

            if "TYPE: CHAT" in classification:
                # Extract the chat response
                parts = classification.split("RESPONSE:")
                response = parts[1].strip() if len(parts) > 1 else classification
                print(f"\n🤖 Vazal: {response}\n")
                final_answer = response
                
                # CRITICAL CHANGE: Even for CHAT, we check for lessons!
                # This catches "The pictures are missing" -> "Oh sorry" -> LEARN LESSON
                await suggest_and_save_lesson(agent, prompt, final_answer)
                continue

            # If we are here, it's a TASK
            
            # --- PLAN & REFINE LOOP ---
            while True:
                print("\n🤔 Thinking of a plan...")
                plan = await generate_plan(agent, prompt)
                print(f"\n📋 Proposed Plan:\n{plan}\n")
                
                refinement = input("👉 Press Enter to start, or type a follow-up to refine the plan: ")
                
                if not refinement.strip():
                    break # User accepted the plan
                
                # User wants to refine
                prompt += f" (Refinement: {refinement})"
                print("🔄 Updating plan...")
            
            print(f"\n🚀 Starting Task: \"{prompt}\"")

            # 2. Run Agent (NO SPINNER - Safe for Input)
            print("⏳ Vazal is working...")
            await agent.run(prompt)

            # 3. Extract & Print Final Answer
            final_answer = "✅ Task Completed."

            # Look backwards through memory to find the last meaningful assistant message
            if agent.memory.messages:
                # Iterate backwards
                for msg in reversed(agent.memory.messages):
                    if msg.role == "assistant":
                        # Priority 1: Explicit output in terminate() call
                        terminate_output = None
                        if msg.tool_calls:
                            for tc in msg.tool_calls:
                                if tc.function.name == "terminate":
                                    import json
                                    try:
                                        args = json.loads(tc.function.arguments)
                                        if args.get("output"):
                                            terminate_output = args.get("output")
                                    except: pass
                        
                        if terminate_output:
                            final_answer = terminate_output
                            break
                        
                        # Priority 2: The thought/content of the message (summary)
                        if msg.content:
                            final_answer = msg.content
                            break
                        
                        # If we found a terminate call but no output and no content, 
                        # we might want to keep looking back, OR rely on the fallback below.
                        # But usually the assistant message with terminate HAS content.
                        if msg.tool_calls and any(tc.function.name == "terminate" for tc in msg.tool_calls):
                             # If we are here, it means terminate was called with NO output and NO thought.
                             # We should let the loop continue to find previous tool outputs? 
                             # No, usually we want to fall back to the last tool output.
                             pass
                
                # Fallback: If final_answer is still default, look for the last tool output
                if final_answer == "✅ Task Completed.":
                    for msg in reversed(agent.memory.messages):
                        if msg.role == "tool" and msg.content:
                            # Found the last tool output (e.g. search results)
                            final_answer = f"✅ Task Completed. Last Tool Output:\n\n{msg.content[:2000]}..." # Truncate if too long
                            break

            print(f"\n🤖 Vazal: {final_answer}\n")

            # 4. Suggest Lesson (Moved to shared function)
            await suggest_and_save_lesson(agent, prompt, final_answer)

    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        print(f"❌ Error: {e}")
    finally:
        await agent.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
