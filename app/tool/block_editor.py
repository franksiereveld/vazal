import os
from app.tool.base import BaseTool, ToolResult

class BlockEditor(BaseTool):
    name: str = "block_editor"
    description: str = """
    A robust file editor that works with line numbers. Use this to edit code or text files safely.
    Supported commands:
    - insert: Insert text at a specific line number.
    - delete: Delete a range of lines (inclusive).
    - replace: Replace a range of lines with new text.
    - read: Read the file content with line numbers to plan your edits.
    """
    parameters: dict = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "enum": ["insert", "delete", "replace", "read"],
                "description": "The editing command to perform."
            },
            "path": {
                "type": "string",
                "description": "Absolute path to the file."
            },
            "start_line": {
                "type": "integer",
                "description": "Line number to start operation (1-based). Required for all commands except 'read' (optional)."
            },
            "end_line": {
                "type": "integer",
                "description": "Line number to end operation (inclusive). Required for 'delete' and 'replace'."
            },
            "content": {
                "type": "string",
                "description": "Content to insert or replace. Required for 'insert' and 'replace'."
            }
        },
        "required": ["command", "path"]
    }

    async def execute(self, command: str, path: str, start_line: int = None, end_line: int = None, content: str = None) -> ToolResult:
        if not os.path.exists(path) and command != "insert":
             return ToolResult(error=f"File not found: {path}")

        # Create file if it doesn't exist and we are inserting
        if not os.path.exists(path) and command == "insert":
            with open(path, "w") as f:
                f.write("")

        try:
            with open(path, "r") as f:
                lines = f.readlines()
        except Exception as e:
            return ToolResult(error=f"Failed to read file: {e}")

        total_lines = len(lines)

        if command == "read":
            # If start/end provided, read range
            start = (start_line - 1) if start_line else 0
            end = end_line if end_line else total_lines
            
            # Clamp
            start = max(0, start)
            end = min(total_lines, end)

            numbered_lines = []
            for i in range(start, end):
                numbered_lines.append(f"{i+1}| {lines[i].rstrip()}")
            
            return ToolResult(output="\n".join(numbered_lines))

        # For editing commands, validate line numbers
        if start_line is None:
             return ToolResult(error="start_line is required for editing commands")
        
        if start_line < 1 or start_line > total_lines + 1:
             return ToolResult(error=f"start_line {start_line} is out of bounds (File has {total_lines} lines)")

        idx_start = start_line - 1

        if command == "insert":
            if content is None:
                return ToolResult(error="content is required for insert")
            
            new_lines = [line + "\n" for line in content.splitlines()]
            # Handle case where content doesn't end with newline if needed, but splitlines usually good
            # Actually splitlines removes \n, so we add it back
            
            lines[idx_start:idx_start] = new_lines
            self._write_file(path, lines)
            return ToolResult(output=f"Inserted {len(new_lines)} lines at line {start_line}")

        elif command == "delete":
            if end_line is None:
                return ToolResult(error="end_line is required for delete")
            
            if end_line < start_line:
                return ToolResult(error="end_line cannot be less than start_line")
            
            idx_end = end_line # Slice is exclusive at end, so this covers up to end_line
            
            del lines[idx_start:idx_end]
            self._write_file(path, lines)
            return ToolResult(output=f"Deleted lines {start_line} to {end_line}")

        elif command == "replace":
            if end_line is None:
                return ToolResult(error="end_line is required for replace")
            if content is None:
                return ToolResult(error="content is required for replace")

            idx_end = end_line
            new_lines = [line + "\n" for line in content.splitlines()]
            
            lines[idx_start:idx_end] = new_lines
            self._write_file(path, lines)
            return ToolResult(output=f"Replaced lines {start_line}-{end_line} with {len(new_lines)} new lines")

        return ToolResult(error=f"Unknown command: {command}")

    def _write_file(self, path, lines):
        with open(path, "w") as f:
            f.writelines(lines)
