"""Quick test script to verify agent imports and basic functionality."""
import os

# Disable emojis
os.environ.setdefault("NO_COLOR", "1")
os.environ.setdefault("TERM", "dumb")
os.environ.setdefault("FORCE_COLOR", "0")

# Test imports
print("Testing agent imports...")
try:
    from dotenv import load_dotenv
    load_dotenv()
    _agent_dir = os.path.dirname(os.path.abspath(__file__))
    _root_dir = os.path.dirname(_agent_dir)
    load_dotenv(dotenv_path=os.path.join(_root_dir, '.env'))
    load_dotenv(dotenv_path=os.path.join(_root_dir, '.env.local'))
    print("[OK] Environment variables loaded")
    
    from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool
    from livekit.plugins import openai
    print("[OK] LiveKit imports successful")
    
    import agent
    print("[OK] Agent module imports successfully")
    
    # Check required functions exist
    assert hasattr(agent, 'entrypoint'), "Missing entrypoint function"
    assert hasattr(agent, 'prewarm'), "Missing prewarm function"
    assert callable(agent.entrypoint), "entrypoint is not callable"
    assert callable(agent.prewarm), "prewarm is not callable"
    print("[OK] All required functions exist")
    
    # Check environment variables
    required = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'OPENAI_API_KEY']
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        print(f"[WARN] Missing environment variables: {', '.join(missing)}")
    else:
        print("[OK] All required environment variables are set")
    
    print("\n[OK] All tests passed! Agent is ready to run.")
    print("\nTo start the agent, run:")
    print("  python agent.py console --text")
    
except Exception as e:
    print(f"\n[ERROR] Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

