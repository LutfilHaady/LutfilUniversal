"""
Minimal LiveKit Agent Chatbot Example

This is a simplified example of how to create a chatbot using LiveKit Agents.
Use this as a starting point for your own chatbot.
"""

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

logger = logging.getLogger("minimal-chatbot")


@function_tool
async def get_current_time(context: RunContext) -> str:
    """Get the current date and time. Use this when user asks about the time or date."""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@function_tool
async def calculate(expression: str, context: RunContext) -> str:
    """
    Evaluate a mathematical expression. Use this when user asks to calculate something.
    
    Args:
        expression: A mathematical expression like "2 + 2" or "10 * 5"
    """
    try:
        # Safe evaluation - only allow basic math operations
        allowed_names = {
            k: v for k, v in __builtins__.items() if k in ["abs", "round", "min", "max"]
        }
        result = eval(expression, {"__builtins__": allowed_names}, {})
        return str(result)
    except Exception as e:
        return f"Error calculating: {str(e)}"


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the agent - called when a new session starts."""
    
    # Connect to the LiveKit room
    await ctx.connect()
    
    # Define your agent's personality and behavior
    instructions = """You are a helpful and friendly AI assistant.
    
You can help users with:
- Answering questions
- Checking the current time
- Performing calculations
- Having general conversations

Guidelines:
- Be concise but friendly
- Use tools when appropriate
- If you don't know something, admit it
- Keep responses natural and conversational"""
    
    # Create the agent with instructions and available tools
    agent = Agent(
        instructions=instructions,
        tools=[get_current_time, calculate],  # Add your tools here
    )
    
    # Create session with AI models
    # These handle speech-to-text, language model, and text-to-speech
    session = AgentSession(
        agent=agent,
        stt=openai.STT(),                    # Converts speech to text
        llm=openai.LLM(model="gpt-4o"),      # The language model for conversation
        tts=openai.TTS(),                    # Converts text to speech
    )
    
    # Start the session and handle the conversation
    logger.info("Starting agent session")
    await session.start(ctx.room)
    await session.aclose()
    logger.info("Agent session ended")


def prewarm(proc: JobProcess):
    """
    Prewarm function - called when the worker starts.
    Use this to load models or initialize resources ahead of time.
    """
    logger.info("Prewarming agent (loading models, etc.)")
    # Example: Load VAD (Voice Activity Detection) model
    proc.userdata["vad"] = silero.VAD.load()


if __name__ == "__main__":
    # Run the agent using LiveKit CLI
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )

