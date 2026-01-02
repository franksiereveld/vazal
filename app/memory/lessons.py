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
        """Returns relevant lessons based on the query context using keyword scoring."""
        if not self.lessons:
            return ""
        
        if not query:
            # Return up to 5 most recent lessons if no query
            recent = [l["content"] for l in self.lessons[-5:]]
            formatted = "\n".join([f"- {l}" for l in recent])
            return f"\n\n## 🧠 RECENT LESSONS:\n{formatted}\n"

        query_words = set(query.lower().split())
        scored_lessons = []

        for lesson in self.lessons:
            content = lesson["content"].lower()
            tags = [t.lower() for t in lesson.get("tags", [])]
            
            # Calculate score: +1 for each query word found in content or tags
            score = 0
            for word in query_words:
                if len(word) < 3: continue # Skip stop words/short words
                if word in content:
                    score += 1
                if any(word in t for t in tags):
                    score += 2 # Tags are more important

            if score > 0:
                scored_lessons.append((score, lesson["content"]))

        # Sort by score descending
        scored_lessons.sort(key=lambda x: x[0], reverse=True)

        # Take top 5
        top_lessons = [l[1] for l in scored_lessons[:5]]

        if not top_lessons:
             # Fallback to recent if no matches
             top_lessons = [l["content"] for l in self.lessons[-3:]]

        formatted = "\n".join([f"- {l}" for l in top_lessons])
        return f"\n\n## 🧠 RELEVANT LESSONS:\n{formatted}\n"
