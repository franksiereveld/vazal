import sys
import os
import asyncio

# Add current directory to sys.path
sys.path.append(os.getcwd())

def test_imports():
    print("Testing imports...")
    try:
        from app.agent.manus import Manus
        print("✅ Successfully imported Manus agent")
    except ImportError as e:
        print(f"❌ Failed to import Manus agent: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error importing Manus agent: {e}")
        return False

    try:
        from app.config import config
        print(f"✅ Successfully imported config. Workspace: {getattr(config, 'workspace_root', 'Unknown')}")
    except ImportError as e:
        print(f"❌ Failed to import config: {e}")
        return False
    
    return True

async def test_agent_init():
    print("\nTesting Agent Initialization...")
    try:
        from app.agent.manus import Manus
        agent = Manus()
        print("✅ Successfully initialized Manus agent")
        return True
    except Exception as e:
        print(f"❌ Failed to initialize Manus agent: {e}")
        return False

async def main():
    print("=== OpenManus Verification Test ===\n")
    
    if not test_imports():
        print("\n❌ Import tests failed. Aborting.")
        sys.exit(1)
        
    if not await test_agent_init():
        print("\n❌ Initialization tests failed. Aborting.")
        sys.exit(1)
        
    print("\n=== ✅ All Basic Verification Tests Passed ===")

if __name__ == "__main__":
    asyncio.run(main())
