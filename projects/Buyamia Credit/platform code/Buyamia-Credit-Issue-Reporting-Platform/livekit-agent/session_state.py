"""
Session state management for LiveKit agent.
Ensures concurrent sessions don't share state.
"""

from dataclasses import dataclass, field
from typing import Optional

from livekit import rtc
from livekit.agents import Agent, AgentSession


@dataclass
class SessionState:
    """
    Per-session state container. This ensures each concurrent session has isolated state.
    Critical for LiveKit Cloud deployment where multiple sessions run in the same worker.
    """
    room: rtc.Room
    tool_registry: Optional["DynamicToolRegistry"] = None
    session: Optional[AgentSession] = None
    agent: Optional[Agent] = None
    processed_image_messages: set = field(default_factory=set)
    workspace_context: dict = field(default_factory=lambda: {
        "organization_id": None,
        "organization_name": None,
        "property_id": None,
        "property_name": None,
    })
    current_tools: list = field(default_factory=list)  # Track current tools list

