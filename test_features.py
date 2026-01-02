import asyncio
import os
from app.tool.str_replace_editor import StrReplaceEditor
from app.memory.lessons import LessonManager

async def test_block_replace():
    print("Testing Block Replace...")
    editor = StrReplaceEditor()
    path = os.path.abspath("test_block.txt")
    
    # Create file
    await editor.execute(command="create", path=path, file_text="Line 1\nLine 2\nLine 3\nLine 4\nLine 5")
    
    # Block replace lines 2-4
    await editor.execute(
        command="block_replace", 
        path=path, 
        start_line=2, 
        end_line=4, 
        new_str="New Line A\nNew Line B"
    )
    
    # Verify
    with open(path, "r") as f:
        content = f.read()
    
    expected = "Line 1\nNew Line A\nNew Line B\nLine 5"
    if content == expected:
        print("✅ Block Replace Passed")
    else:
        print(f"❌ Block Replace Failed. Got:\n{content}\nExpected:\n{expected}")

def test_learning():
    print("\nTesting Learning Mechanism...")
    manager = LessonManager()
    
    # Clear existing lessons for test
    if os.path.exists("lessons.json"):
        os.remove("lessons.json")
    manager = LessonManager() # Reload empty
    
    # Save lesson
    manager.save_lesson("Always check for null values", tags=["coding", "safety"])
    manager.save_lesson("Use low heat for eggs", tags=["cooking"])
    
    # Query relevant
    relevant = manager.get_relevant_lessons("coding safety")
    if "null values" in relevant and "eggs" not in relevant:
        print("✅ Retrieval Passed (Found relevant, ignored irrelevant)")
    else:
        print(f"❌ Retrieval Failed. Got:\n{relevant}")

async def main():
    await test_block_replace()
    test_learning()

if __name__ == "__main__":
    asyncio.run(main())
