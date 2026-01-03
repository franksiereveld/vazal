import os
import json
import uuid
import chromadb
from chromadb.utils import embedding_functions
from typing import List, Dict, Optional
from datetime import datetime
from app.logger import logger
import logging

# Silence sentence-transformers progress bar and info logs
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)

# Configuration
DB_PATH = "data/chroma_db"
COLLECTION_NAME = "vazal_lessons"
OLD_LESSONS_FILE = "lessons.json"

class VectorLessonManager:
    def __init__(self):
        # Ensure data directory exists
        os.makedirs(DB_PATH, exist_ok=True)
        
        # Initialize ChromaDB Client
        self.client = chromadb.PersistentClient(path=DB_PATH)
        
        # Use a lightweight, high-performance embedding model
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        
        # Get or Create Collection
        self.collection = self.client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=self.embedding_fn
        )
        
        # Migrate old lessons if they exist and DB is empty
        if self.collection.count() == 0 and os.path.exists(OLD_LESSONS_FILE):
            self._migrate_old_lessons()

    def _migrate_old_lessons(self):
        """Migrates legacy JSON lessons to Vector DB as GENERAL scope."""
        logger.info("🔄 Migrating legacy lessons to Vector DB...")
        try:
            with open(OLD_LESSONS_FILE, 'r') as f:
                data = json.load(f)
                
            for item in data:
                content = item if isinstance(item, str) else item.get("content")
                tags = [] if isinstance(item, str) else item.get("tags", [])
                
                # Determine scope based on tags
                scope = "GENERAL"
                role = "none"
                
                for tag in tags:
                    if "role:" in tag:
                        scope = "ROLE"
                        role = tag.split("role:")[1]
                    elif "user" in tag:
                        scope = "USER"
                
                self.save_lesson(content, scope=scope, role=role, tags=tags)
            
            logger.info(f"✅ Migrated {len(data)} lessons.")
        except Exception as e:
            logger.error(f"⚠️ Migration failed: {e}")

    def save_lesson(self, content: str, scope: str = "GENERAL", role: str = "none", tags: List[str] = None):
        """
        Saves a lesson to the Vector DB.
        scope: "USER", "ROLE", or "GENERAL"
        role: Specific role name (e.g., "chief_of_staff") if scope is ROLE.
        """
        if tags is None: tags = []
        
        # Check for exact duplicates to avoid spam
        existing = self.collection.get(where={"content": content})
        if existing["ids"]:
            logger.debug(f"ℹ️ Lesson already exists: {content[:30]}...")
            return

        lesson_id = str(uuid.uuid4())
        metadata = {
            "scope": scope.upper(),
            "role": role.lower(),
            "timestamp": datetime.now().isoformat(),
            "tags": ",".join(tags),
            "content": content # Store content in metadata for easy retrieval
        }
        
        self.collection.add(
            documents=[content],
            metadatas=[metadata],
            ids=[lesson_id]
        )
        logger.info(f"✅ Lesson saved ({scope}): {content[:50]}...")

    def get_relevant_lessons(self, query: str = "", current_role: str = "none") -> str:
        """
        Retrieves relevant lessons based on semantic similarity and scope.
        Strategy:
        1. Always fetch ALL 'USER' lessons (Personal Preferences).
        2. Fetch relevant 'ROLE' lessons (Context specific).
        3. Fetch top-k 'GENERAL' lessons (Best practices).
        """
        results_text = []
        
        # 1. USER Lessons (Always include all, or top 10 if too many)
        # Chroma 'get' is better for filtering without semantic search
        user_lessons = self.collection.get(where={"scope": "USER"}, limit=20)
        if user_lessons["metadatas"]:
            results_text.append("## 👤 USER PREFERENCES (Always Active):")
            for meta in user_lessons["metadatas"]:
                results_text.append(f"- {meta['content']}")
        
        # 2. ROLE Lessons (Semantic Search constrained to Role)
        if current_role and current_role != "none":
            role_results = self.collection.query(
                query_texts=[query] if query else ["general guidelines"],
                n_results=5,
                where={"$and": [{"scope": "ROLE"}, {"role": current_role}]}
            )
            if role_results["documents"][0]:
                results_text.append(f"\n## 👔 ROLE GUIDELINES ({current_role}):")
                for doc in role_results["documents"][0]:
                    results_text.append(f"- {doc}")

        # 3. GENERAL Lessons (Semantic Search)
        if query:
            general_results = self.collection.query(
                query_texts=[query],
                n_results=5,
                where={"scope": "GENERAL"}
            )
            if general_results["documents"][0]:
                results_text.append("\n## 🧠 RELEVANT KNOWLEDGE:")
                for doc in general_results["documents"][0]:
                    results_text.append(f"- {doc}")
        
        if not results_text:
            return ""
            
        return "\n\n" + "\n".join(results_text) + "\n"
