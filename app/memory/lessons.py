import json
import os
from typing import List, Dict, Optional

LESSONS_FILE = "lessons.json"

class LessonManager:
    def __init__(self):
        self.lessons: List[Dict[str, str]] = self._load_lessons()

    def _load_lessons(self) -> List[Dict[str, str]]:
        """Loads lessons from the JSON file."""
        if not os.path.exists(LESSONS_FILE):
            return []
        try:
            with open(LESSONS_FILE, 'r') as f:
                data = json.load(f)
                # Migration: Convert old list of strings to list of dicts
                if data and isinstance(data[0], str):
                    return [{"content": l, "tags": []} for l in data]
                return data
        except:
            return []

    def save_lesson(self, content: str, tags: List[str] = None):
        """Saves a new lesson with optional tags."""
        if tags is None:
            tags = []
        
        # Check for duplicates
        for lesson in self.lessons:
            if lesson["content"] == content:
                return

        new_lesson = {"content": content, "tags": tags}
        self.lessons.append(new_lesson)
        
        with open(LESSONS_FILE, 'w') as f:
            json.dump(self.lessons, f, indent=2)
        print(f"✅ Lesson learned: {content}")

    def get_relevant_lessons(self, query: str = "") -> str:
        """Returns relevant lessons based on the query context."""
        if not self.lessons:
            return ""
        
        relevant = []
        query_lower = query.lower()
        
        for lesson in self.lessons:
            # Simple keyword matching
            content = lesson["content"].lower()
            tags = [t.lower() for t in lesson.get("tags", [])]
            
            # If query is empty, return everything (or top N)
            if not query:
                relevant.append(lesson["content"])
                continue

            # Check if any word in the query matches content or tags
            # This is a basic heuristic; can be improved with embeddings later
            if any(word in content for word in query_lower.split()) or \
               any(word in tags for word in query_lower.split()):
                relevant.append(lesson["content"])
        
        # Fallback: If no specific matches, show generic lessons
        if not relevant and self.lessons:
             # Return up to 5 most recent lessons as fallback
             relevant = [l["content"] for l in self.lessons[-5:]]

        if not relevant:
            return ""

        formatted = "\n".join([f"- {l}" for l in relevant])
        return f"\n\n## 🧠 RELEVANT LESSONS:\n{formatted}\n"
