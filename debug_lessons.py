#!/usr/bin/env python3
"""
Debug utility to review lesson history and compare prompts.
This helps understand why lessons are or aren't being learned.
"""

import json
import os
from pathlib import Path
from datetime import datetime

def load_debug_logs():
    """Load and parse debug logs to extract LLM interactions."""
    log_dir = Path("logs")
    if not log_dir.exists():
        print("❌ No logs directory found. Run Vazal first to generate logs.")
        return []
    
    interactions = []
    
    # Find the most recent debug log
    log_files = sorted(log_dir.glob("debug_trace_*.log"), reverse=True)
    if not log_files:
        print("❌ No debug trace logs found.")
        return []
    
    latest_log = log_files[0]
    print(f"📖 Reading log: {latest_log}\n")
    
    with open(latest_log, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                # Each line should be JSON
                if line.strip().startswith('{'):
                    entry = json.loads(line)
                    if entry.get("type") == "LLM_INTERACTION":
                        interactions.append(entry)
            except json.JSONDecodeError:
                # Skip malformed lines
                pass
    
    return interactions

def find_lesson_prompts(interactions):
    """Find interactions related to lesson learning."""
    lesson_interactions = []
    
    for interaction in interactions:
        messages = interaction.get("input_messages", [])
        response = interaction.get("output_response", "")
        
        # Check if this is a lesson reflection prompt
        for msg in messages:
            if isinstance(msg, dict):
                content = msg.get("content", "")
                if "lesson" in content.lower() or "correction" in content.lower():
                    lesson_interactions.append({
                        "timestamp": interaction.get("timestamp"),
                        "prompt_snippet": content[:200],
                        "response": response if isinstance(response, str) else str(response)[:200]
                    })
    
    return lesson_interactions

def display_lesson_history(lesson_interactions):
    """Display lesson history in a readable format."""
    if not lesson_interactions:
        print("❌ No lesson-related interactions found in logs.")
        return
    
    print(f"\n📚 Lesson History ({len(lesson_interactions)} interactions):\n")
    print("=" * 80)
    
    for i, interaction in enumerate(lesson_interactions, 1):
        print(f"\n[{i}] Timestamp: {interaction['timestamp']}")
        print(f"    Prompt: {interaction['prompt_snippet']}...")
        print(f"    Response: {interaction['response']}...")
        print("-" * 80)

def compare_recent_prompts():
    """Compare the last few user prompts to see patterns."""
    agent_log = Path("agent.log")
    if not agent_log.exists():
        print("❌ No agent.log found. Run Vazal first.")
        return
    
    print("\n🔍 Recent Prompts (from agent.log):\n")
    
    with open(agent_log, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Find lines with "User:" or "👉" prompts
    recent_prompts = []
    for line in lines[-100:]:  # Last 100 lines
        if "User:" in line or "👉" in line or "Starting Task:" in line:
            recent_prompts.append(line.strip())
    
    if recent_prompts:
        for i, prompt in enumerate(recent_prompts[-5:], 1):  # Last 5
            print(f"[{i}] {prompt}")
    else:
        print("No recent prompts found.")

def main():
    print("\n🔧 Vazal Lesson Debug Utility\n")
    
    print("1️⃣  Loading debug logs...")
    interactions = load_debug_logs()
    
    if not interactions:
        print("No interactions found.")
        return
    
    print(f"✅ Found {len(interactions)} LLM interactions.\n")
    
    print("2️⃣  Extracting lesson-related prompts...")
    lesson_interactions = find_lesson_prompts(interactions)
    
    print("3️⃣  Displaying lesson history...")
    display_lesson_history(lesson_interactions)
    
    print("\n4️⃣  Comparing recent prompts...")
    compare_recent_prompts()
    
    print("\n" + "=" * 80)
    print("💡 Tip: Check logs/debug_trace_YYYYMMDD.log for full LLM interactions.")
    print("💡 Tip: Check agent.log for full execution history.")

if __name__ == "__main__":
    main()
