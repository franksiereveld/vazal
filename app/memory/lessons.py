import json
import os
from typing import List

LESSONS_FILE = "lessons.json"

class LessonManager:
    def __init__(self):
        self.lessons = self._load_lessons()

    def _load_lessons(self) -> List[str]:
        """Loads lessons from the JSON file."""
        if not os.path.exists(LESSONS_FILE):
            return []
        try:
            with open(LESSONS_FILE, 'r') as f:
                return json.load(f)
        except:
            return []

    def save_lesson(self, lesson: str):
        """Saves a new lesson if it doesn't exist."""
        if lesson not in self.lessons:
            self.lessons.append(lesson)
            with open(LESSONS_FILE, 'w') as f:
                json.dump(self.lessons, f, indent=2)
            print(f"✅ Lesson learned: {lesson}")

    def get_relevant_lessons(self) -> str:
        """Returns all lessons formatted as a string for the AI."""
        if not self.lessons:
            return ""
        
        formatted = "\n".join([f"- {l}" for l in self.lessons])
        return f"\n\n## 🧠 LESSONS LEARNED FROM PAST TASKS:\n{formatted}\n"
