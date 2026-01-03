import chromadb
from app.config import config
import os

def inspect_memory():
    db_path = os.path.join(config.workspace_root, "data", "chroma_db")
    print(f"📂 Opening Vector DB at: {db_path}")
    
    try:
        client = chromadb.PersistentClient(path=db_path)
        collection = client.get_collection("lessons")
        
        count = collection.count()
        print(f"📊 Total Lessons: {count}")
        
        if count > 0:
            print("\n--- 📝 Stored Lessons ---")
            results = collection.get()
            for i, doc in enumerate(results['documents']):
                meta = results['metadatas'][i]
                print(f"[{meta.get('scope', 'UNKNOWN')}] {doc}")
        else:
            print("⚠️ No lessons found yet. Try teaching Vazal something!")
            
    except Exception as e:
        print(f"❌ Error reading DB: {e}")

if __name__ == "__main__":
    inspect_memory()
