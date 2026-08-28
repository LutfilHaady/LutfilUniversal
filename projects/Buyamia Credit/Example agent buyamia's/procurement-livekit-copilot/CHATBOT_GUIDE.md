# Guide: Creating a Chatbot Similar to This LiveKit Agent

This guide explains how to create a chatbot similar to this LiveKit Agents project. This agent is a **voice and text AI assistant** built with LiveKit Agents, which is a Python SDK for building real-time AI assistants.

## Understanding This Agent Architecture

This agent has several key components:

1. **LiveKit Agents Framework** - Handles real-time communication (voice/text)
2. **LLM Integration** - Uses OpenAI GPT-4 for conversation
3. **Speech-to-Text (STT)** - Converts voice to text (Cartesia)
4. **Text-to-Speech (TTS)** - Converts text to voice (OpenAI)
5. **Tools/Functions** - Backend tools (database queries) and dynamic frontend tools
6. **Session State** - Isolated state per conversation session
7. **Personas** - Different agent personalities (Atlas Copilot vs Atlas Intelligence)

## Quick Start: Creating Your Own Chatbot

### Option 1: Use This Template as a Starting Point

The simplest approach is to customize this existing project:

1. **Modify the Instructions/Prompts**
   - Edit `get_atlas_copilot_instructions()` or create your own persona function
   - Customize the agent's personality and behavior
   - Location: `src/agent.py` (lines 449-750+)

2. **Add/Remove Tools**
   - Backend tools: Edit `src/backend_tools.py`
   - Session-scoped tools: Edit `create_session_scoped_tools()` in `src/agent.py`
   - Remove database-related code if you don't need it

3. **Simplify if Needed**
   - Remove dynamic frontend tools if you only want backend tools
   - Remove persona switching if you only need one personality
   - Remove database integration if you don't need it

### Option 2: Create a Minimal Chatbot from Scratch

Here's how to build a minimal chatbot:

#### Step 1: Setup Project Structure

```bash
# Create a new directory
mkdir my-chatbot
cd my-chatbot

# Initialize with uv (or use your preferred package manager)
uv init
```

#### Step 2: Install Dependencies

Edit `pyproject.toml`:

```toml
[project]
name = "my-chatbot"
version = "1.0.0"
requires-python = ">=3.9"
dependencies = [
    "livekit-agents[openai,silero]~=1.2",
    "python-dotenv",
]
```

Then run:
```bash
uv sync
```

#### Step 3: Create Minimal Agent

Create `src/agent.py`:

```python
import logging
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    function_tool,
    RunContext,
)
from livekit.plugins import openai, silero

load_dotenv()

logger = logging.getLogger("my-chatbot")


@function_tool
async def get_current_time(context: RunContext) -> str:
    """Get the current time. Use this when user asks what time it is."""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


async def entrypoint(ctx: JobContext):
    await ctx.connect()
    
    # Define your agent's personality and instructions
    instructions = """You are a helpful AI assistant. 
    Be friendly, concise, and helpful.
    Use available tools when appropriate."""
    
    # Create the agent with instructions and tools
    agent = Agent(
        instructions=instructions,
        tools=[get_current_time],  # Add your tools here
    )
    
    # Create session with models
    session = AgentSession(
        agent=agent,
        stt=openai.STT(),  # Speech-to-Text
        llm=openai.LLM(model="gpt-4o"),  # Language model
        tts=openai.TTS(),  # Text-to-Speech
    )
    
    # Start the session
    await session.start(ctx.room)
    await session.aclose()


def prewarm(proc: JobProcess):
    # Prewarm any models or resources here
    pass


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
```

#### Step 4: Configure Environment

Create `.env.local`:

```env
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
OPENAI_API_KEY=your-openai-api-key
```

#### Step 5: Run Your Chatbot

```bash
# Download required model files
uv run python src/agent.py download-files

# Test in console (text-only)
uv run python src/agent.py console

# Run for production (supports voice + text)
uv run python src/agent.py dev
```

## Key Components Explained

### 1. Agent Instructions

The agent's personality and behavior are defined in the instructions string. Example:

```python
instructions = """You are a helpful assistant for [your domain].
- Be friendly and professional
- Keep responses concise
- Use tools when appropriate
- Respond in the user's language"""
```

### 2. Tools/Functions

Tools allow the agent to perform actions beyond just conversation:

```python
@function_tool
async def my_tool(param1: str, context: RunContext) -> str:
    """
    Tool description - the LLM sees this.
    
    Args:
        param1: Description of parameter
    """
    # Do something useful
    result = perform_action(param1)
    return result
```

### 3. Session State

For maintaining conversation context:

```python
@dataclass
class SessionState:
    room: rtc.Room
    agent: Optional[Agent] = None
    session: Optional[AgentSession] = None
    # Add your custom state here
    user_preferences: dict = field(default_factory=dict)
```

### 4. Models Configuration

Choose your models:

```python
session = AgentSession(
    agent=agent,
    stt=openai.STT(),           # or cartesia.STT(), deepgram.STT()
    llm=openai.LLM("gpt-4o"),   # or other LLM providers
    tts=openai.TTS(),           # or elevenlabs.TTS(), cartesia.TTS()
)
```

## Customization Options

### Text-Only vs Voice

- **Text-only**: Remove STT/TTS, or detect and skip audio tracks
- **Voice**: Include STT/TTS models (already included in this project)

### Adding Database Integration

If you need database access (like this agent has):

1. Add SQLAlchemy to dependencies
2. Create connection in a separate module
3. Create `@function_tool` functions that query the database
4. Include them in the agent's tools list

### Adding Frontend Integration

This agent uses RPC to communicate with a frontend. To add similar:

1. Register RPC handlers for frontend methods
2. Use `room.local_participant.perform_rpc()` to call frontend
3. Have frontend register tools via RPC (see `DynamicToolRegistry`)

### Adding Multiple Personas

Follow this agent's pattern:

1. Create instruction functions for each persona
2. Extract persona from participant metadata or user choice
3. Select instructions based on persona
4. Optionally use different tool sets per persona

## Testing Your Chatbot

This project includes a testing framework. Add tests in `tests/`:

```python
import pytest
from livekit.agents.testing import TestSession

@pytest.mark.asyncio
async def test_my_chatbot():
    session = TestSession()
    # Test your agent's responses
    response = await session.say("Hello")
    assert "hello" in response.lower()
```

Run tests:
```bash
uv run pytest
```

## Deployment

### Local Development
```bash
uv run python src/agent.py dev
```

### Production (Docker)
This project includes a `Dockerfile`. Build and deploy:

```bash
docker build -t my-chatbot .
docker run -e LIVEKIT_URL=... -e LIVEKIT_API_KEY=... my-chatbot
```

### LiveKit Cloud
```bash
# Install LiveKit CLI
# Then:
lk agent create
```

## What Makes This Agent Special

This particular agent includes:

1. **Dynamic Tool Registration** - Frontend can register/unregister tools at runtime
2. **Workspace Context** - Maintains organization/property context
3. **Multi-persona Support** - Different personalities for different use cases
4. **Database Integration** - Direct database queries for procurement data
5. **Form Wizard Support** - Guides users through multi-step forms
6. **Language Detection** - Responds in user's language automatically

## Simplifying for a Basic Chatbot

To create a simpler chatbot, you can:

1. Remove `DynamicToolRegistry` class
2. Remove backend database tools
3. Remove persona switching
4. Remove workspace context management
5. Keep just: Agent + Session + Basic Tools + Instructions

This will give you a clean, simple chatbot that can still do voice and text conversations with custom tools.

## Next Steps

1. **Start Simple**: Begin with the minimal example above
2. **Add Tools**: Gradually add tools for your specific use case
3. **Customize Instructions**: Make the agent match your needs
4. **Add State Management**: If you need conversation memory
5. **Integrate with Your Systems**: Add database/external APIs as needed

## Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [LiveKit Docs MCP Server](https://docs.livekit.io/mcp) - For AI assistants
- [LiveKit Cloud](https://cloud.livekit.io/) - Hosted infrastructure
- This project's `README.md` - For setup instructions

## Need Help?

- Check the LiveKit documentation
- Review this agent's code for patterns
- Test incrementally as you build
- Use the console mode (`console` command) for quick testing

