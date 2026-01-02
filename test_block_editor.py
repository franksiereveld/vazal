import asyncio
import os
from app.tool.block_editor import BlockEditor

async def test_block_editor():
    path = "test_file.txt"
    editor = BlockEditor()

    # 1. Create/Insert
    print("--- Test 1: Insert ---")
    await editor.execute("insert", path, start_line=1, content="Line 1\nLine 2\nLine 3")
    with open(path, "r") as f: print(f.read())

    # 2. Replace
    print("\n--- Test 2: Replace Line 2 ---")
    await editor.execute("replace", path, start_line=2, end_line=3, content="Line 2 Modified")
    with open(path, "r") as f: print(f.read())

    # 3. Delete
    print("\n--- Test 3: Delete Line 1 ---")
    await editor.execute("delete", path, start_line=1, end_line=2)
    with open(path, "r") as f: print(f.read())

    # Cleanup
    os.remove(path)

if __name__ == "__main__":
    asyncio.run(test_block_editor())
