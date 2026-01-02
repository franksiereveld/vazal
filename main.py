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
    """
    classifier_prompt = (
        f"Analyze this user prompt: '{prompt}'\n"
        "Is this a simple chat greeting/question (e.g. 'hi', 'how are you', 'explain X') "
        "OR a task requiring tools (e.g. 'find X', 'write code', 'search web')?\n"
        "Output format:\n"
        "TYPE: [CHAT or TASK]\n"
        "RESPONSE: [If CHAT, write the response here. If TASK, write the task description]"
    )
    # Wrap string in Message object
    return await agent.llm.ask([Message.user_message(classifier_prompt)])

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

            if "TYPE: CHAT" in classification:
                # Extract the chat response
                parts = classification.split("RESPONSE:")
                response = parts[1].strip() if len(parts) > 1 else classification
                print(f"\n🤖 Vazal: {response}\n")
                continue

            # If we are here, it's a TASK
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
                        # 1. Check if it was a terminate call with output
                        if msg.tool_calls:
                            for tc in msg.tool_calls:
                                if tc.function.name == "terminate":
                                    import json
                                    try:
                                        args = json.loads(tc.function.arguments)
                                        # If terminate has explicit output, use it
                                        if args.get("output"):
                                            final_answer = args.get("output")
                                            break # Found it
                                    except: pass
                            else:
                                continue # Continue to next message if no terminate found in this one
                            break # Break outer loop if terminate found

                        # 2. If it has text content (and not just a tool call), use that
                        if msg.content:
                            final_answer = msg.content
                            break
                
                # Fallback: If final_answer is still default, look for the last tool output
                if final_answer == "✅ Task Completed.":
                    for msg in reversed(agent.memory.messages):
                        if msg.role == "tool" and msg.content:
                            # Found the last tool output (e.g. search results)
                            final_answer = f"✅ Task Completed. Last Tool Output:\n\n{msg.content[:2000]}..." # Truncate if too long
                            break

            print(f"\n🤖 Vazal: {final_answer}\n")

            # 4. Suggest Lesson
            reflection_prompt = (
                f"Review the task '{prompt}' and the result. "
                "Did we learn any specific preference, constraint, or fact about the user or environment? "
                "If yes, output ONLY the lesson text. If no, output 'NO'."
            )
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

    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        print(f"❌ Error: {e}")
    finally:
        await agent.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
