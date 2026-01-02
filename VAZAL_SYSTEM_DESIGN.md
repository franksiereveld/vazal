# Vazal AI: System Design & Architecture
*(Built on the OpenManus Foundation)*

## 1. Executive Summary
Vazal AI is an autonomous agent framework designed for complex, multi-step problem solving. It inherits the robust **Plan-Execute-Observe** loop from OpenManus but significantly extends it with enterprise-grade capabilities: **Context-Aware Learning**, **Safe Block Editing**, **Premium Search Integration**, and **Resilient Browser Automation**.

---

## 2. System Hierarchy

```mermaid
graph TD
    User[User Input] --> Agent[Vazal Agent]
    
    subgraph "The Brain (app/agent)"
        Agent --> Planner[Planner / LLM]
        Agent --> Memory[Memory Manager]
        Agent --> Lessons[Lesson Manager (Enhanced)]
    end
    
    subgraph "The Hands (app/tool)"
        Agent --> Tools[Tool Collection]
        Tools --> Search[FastSearch (Tavily/DDG)]
        Tools --> Browser[BrowserUse (Playwright)]
        Tools --> Editor[StrReplaceEditor (Block Edit)]
        Tools --> Python[Python Sandbox]
        Tools --> Bash[Bash Executor]
    end
    
    subgraph "The Environment (app/sandbox)"
        Python --> Docker[Docker/Daytona Container]
        Bash --> Docker
    end
```

---

## 3. The OpenManus Foundation
At its core, Vazal utilizes the OpenManus agent loop. This is a state machine that cycles until the goal is met.

### Core Loop Pseudocode
```python
class VazalAgent:
    def run(self, user_goal):
        # 1. Initialize Memory
        self.memory.add(user_goal)
        
        while not self.is_finished:
            # 2. Think (LLM)
            # The LLM sees the history + current state + available tools
            next_step = self.llm.think(self.memory)
            
            # 3. Act (Tool Execution)
            if next_step.is_tool_call:
                tool_name = next_step.tool
                tool_args = next_step.args
                
                # Execute the tool
                observation = self.tools[tool_name].execute(**tool_args)
                
                # 4. Observe
                self.memory.add(observation)
                
            # 5. Reflect (Optional)
            # The agent updates its internal state based on the result
```

---

## 4. Vazal Enhancements (The "Secret Sauce")

### A. Enhanced Learning Mechanism (`app/memory/lessons.py`)
**Problem:** Standard agents repeat mistakes. They don't "remember" that a specific library is deprecated or a specific server is slow.
**Vazal Solution:** A persistent, context-aware lesson store.

**Module:** `LessonManager`
*   **Storage:** JSON-based persistent store (`lessons.json`).
*   **Structure:** Lessons are stored as objects with content and tags.
*   **Retrieval:** Instead of dumping all lessons, Vazal retrieves only what's relevant to the current query.

**Pseudocode:**
```python
def get_relevant_lessons(self, current_task_query):
    relevant_lessons = []
    
    for lesson in self.all_lessons:
        # Check if lesson content or tags match the current task keywords
        if match(lesson.tags, current_task_query) or match(lesson.content, current_task_query):
            relevant_lessons.append(lesson)
            
    if not relevant_lessons:
        # Fallback: Return the 5 most recent lessons to maintain some context
        return self.all_lessons[-5:]
        
    return format_for_llm(relevant_lessons)
```

### B. Safe Block Editing (`app/tool/str_replace_editor.py`)
**Problem:** LLMs struggle with `str_replace` (exact string matching) because of whitespace/indentation errors. `insert` is risky because it pushes code down without removing old code.
**Vazal Solution:** `block_replace`.

**Module:** `StrReplaceEditor`
*   **Capability:** Replaces a specific range of lines (Start -> End) with new content.
*   **Safety:** It's deterministic. The agent says "Replace lines 10-15", and exactly those lines are replaced.

**Pseudocode:**
```python
def block_replace(self, path, start_line, end_line, new_content):
    lines = read_file(path)
    
    # Validation
    if start_line < 1 or end_line > len(lines):
        raise Error("Invalid range")
        
    # The Surgery
    before_block = lines[:start_line-1]
    after_block = lines[end_line:]
    
    new_file_content = before_block + new_content + after_block
    
    write_file(path, new_file_content)
    return "Success: Lines replaced."
```

### C. Premium Search Integration (`app/tool/fast_search.py`)
**Problem:** OpenManus relied on DuckDuckGo (free, but often blocks bots or returns generic results).
**Vazal Solution:** Integrated **Tavily**, a search engine built specifically for AI agents.

**Module:** `FastSearch`
*   **Logic:** Checks `config.toml`. If `engine="Tavily"`, it uses the Tavily API to get clean, parsed text (no HTML clutter). If Tavily fails or is unconfigured, it gracefully falls back to DuckDuckGo.

### D. Resilient Browser Automation (`app/tool/browser_use_tool.py`)
**Problem:** The `browser-use` library API changes frequently, breaking the agent.
**Vazal Solution:** A custom wrapper that stabilizes the interface.
*   **Session Management:** Uses `BrowserSession` to maintain cookies and state across multiple steps.
*   **High-Level Actions:** Exposes `navigate`, `click`, `type` as atomic actions that handle their own waiting and error recovery.

---

## 5. Configuration Module (`app/config.py`)
Vazal introduces a robust configuration system that handles missing keys gracefully.

**Structure:**
```toml
[llm]
model = "gpt-4o"  # The Brain
api_key = "..."

[search]
engine = "Tavily" # The Eyes
api_key = "..."
```

The `Config` class in `app/config.py` validates this TOML file at startup, ensuring the agent doesn't crash halfway through a task due to a missing key.
