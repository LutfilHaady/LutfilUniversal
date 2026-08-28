import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Optional
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    RoomOutputOptions,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.agents.llm import ImageContent
from livekit.plugins import openai, silero
from openai.types.beta.realtime.session import TurnDetection

# Import backend tools
from backend_tools import BACKEND_TOOLS

load_dotenv(".env.local")

logger = logging.getLogger("procurement-agent")


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


def get_time_based_greeting(timezone: str = "UTC") -> str:
    """
    Get an appropriate greeting based on the time of day in the user's timezone.

    Args:
        timezone: IANA timezone string (e.g., "Asia/Jakarta", "America/New_York")

    Returns:
        A time-appropriate greeting phrase
    """
    try:
        tz = ZoneInfo(timezone)
        current_hour = datetime.now(tz).hour
    except Exception:
        # Fallback to UTC if timezone is invalid
        current_hour = datetime.now(ZoneInfo("UTC")).hour

    if 5 <= current_hour < 12:
        return "Good morning"
    elif 12 <= current_hour < 17:
        return "Good afternoon"
    elif 17 <= current_hour < 21:
        return "Good evening"
    else:
        return "Hello"


def get_user_context_from_participant(participant) -> dict:
    """
    Extract user context from participant metadata.

    Args:
        participant: LiveKit RemoteParticipant

    Returns:
        Dict with user context (name, email, timezone, initialQuestion)
    """
    default_context = {
        "user_name": "there",
        "user_email": None,
        "user_timezone": "UTC",
        "initial_question": None,
    }

    if not participant or not participant.metadata:
        return default_context

    try:
        metadata = json.loads(participant.metadata)
        return {
            "user_name": metadata.get("userName", "there"),
            "user_email": metadata.get("userEmail"),
            "user_timezone": metadata.get("userTimezone", "UTC"),
            "initial_question": metadata.get("initialQuestion"),
        }
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Failed to parse participant metadata: {e}")
        return default_context


def get_persona_from_participant(participant) -> str:
    """
    Extract persona type from participant metadata.

    Args:
        participant: LiveKit RemoteParticipant

    Returns:
        Persona type: "atlas-copilot" (default) or "atlas-intelligence"
    """
    default_persona = "atlas-copilot"

    if not participant or not participant.metadata:
        return default_persona

    try:
        metadata = json.loads(participant.metadata)
        persona = metadata.get("agentPersona", default_persona)
        logger.info(f"Detected persona from metadata: {persona}")
        return persona
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Failed to parse persona from metadata: {e}")
        return default_persona


class DynamicToolRegistry:
    """
    Manages dynamic registration of frontend tools as LLM-callable functions.
    This allows the LLM to see and call each frontend tool individually,
    similar to CopilotKit's approach.
    """

    def __init__(self, room: rtc.Room):
        self.room = room
        self.registered_tools: dict[str, Callable] = {}
        self.tool_definitions: list = []

    def create_frontend_tool(self, tool_schema: dict) -> Callable:
        """
        Creates a dynamic function tool that calls the frontend using raw_schema.

        Args:
            tool_schema: Tool definition from frontend with name, description, parameters
        """
        tool_name = tool_schema["name"]
        tool_description = tool_schema["description"]
        tool_params = tool_schema.get("parameters", {})

        # Build proper JSON schema for OpenAI (with additionalProperties: false for objects)
        raw_schema = self._build_openai_function_schema(tool_name, tool_description, tool_params)

        # Escape tool_name for logging
        escaped_tool_name = tool_name.replace('"', '\\"')

        # Capture room in closure
        room = self.room

        # Create function that receives raw_arguments dict
        func_code_template = """
async def {func_name}(raw_arguments: dict, context: RunContext) -> str:
    \"\"\"{description}\"\"\"
    import json as _json
    import logging as _logging
    from livekit.agents import ToolError
    
    # Get the first remote participant (frontend)
    if not _room.remote_participants:
        raise ToolError("No frontend participant connected")
    
    participant_identity = next(iter(_room.remote_participants))
    
    # Log the tool call
    args_str = str(raw_arguments)
    _logging.getLogger("procurement-agent").info("[Tool Call] {escaped_tool_name} with args: " + args_str)
    
    try:
        # Validate that the arguments from the LLM are valid JSON
        try:
            payload = _json.dumps(raw_arguments)
        except TypeError as e:
            error_msg = f"LLM returned invalid arguments for '{escaped_tool_name}': {{str(e)}}"
            _logging.getLogger("procurement-agent").error(f"[Tool Error] {{error_msg}}")
            raise ToolError(error_msg)

        # Use RPC to call the frontend tool method
        response = await _room.local_participant.perform_rpc(
            destination_identity=participant_identity,
            method="{func_name}",
            payload=payload,
            response_timeout=30.0,
        )
        
        result_str = str(response)
        _logging.getLogger("procurement-agent").info("[Tool Result] {escaped_tool_name}: " + result_str)
        return response
    except Exception as e:
        error_msg = f"Error calling '{escaped_tool_name}': {{str(e)}}"
        _logging.getLogger("procurement-agent").error(f"[Tool Error] {{error_msg}}")
        raise ToolError(error_msg)
"""

        func_code = func_code_template.format(
            func_name=tool_name,
            description=tool_description.replace('"', '\\"').replace('\n', '\\n'),
            escaped_tool_name=escaped_tool_name
        )

        # Execute the function definition
        namespace = {
            "RunContext": RunContext,
            "dict": dict,
            "_room": room,
            "ToolError": agents.ToolError,
        }

        exec(func_code, namespace)
        dynamic_tool = namespace[tool_name]

        # Decorate with @function_tool using raw_schema
        decorated_tool = function_tool(raw_schema=raw_schema)(dynamic_tool)

        return decorated_tool

    def _build_openai_function_schema(self, tool_name: str, tool_description: str, tool_params: dict) -> dict:
        """
        Build a complete OpenAI function schema with proper additionalProperties handling.

        Args:
            tool_name: Name of the tool
            tool_description: Description of what the tool does
            tool_params: Parameters schema from frontend (always dict format after convertParametersToObject)

        Returns:
            Complete OpenAI function schema in LiveKit format
        """
        properties = {}
        required = []

        # Frontend always sends parameters as dict (not array)
        if not isinstance(tool_params, dict):
            logger.error(f"Tool '{tool_name}' received non-dict parameters: {type(tool_params)}")
            tool_params = {}

        for param_name, param_info in tool_params.items():
            properties[param_name] = self._build_json_schema_for_param(param_name, param_info)

            if param_info.get("required", False):
                required.append(param_name)

        schema = {
            "type": "function",
            "name": tool_name,
            "description": tool_description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "additionalProperties": False,
            }
        }

        if required:
            schema["parameters"]["required"] = required

        # Debug logging to see what schema we built
        logger.info(f"Built schema for {tool_name}:")
        logger.info(f"  Properties: {list(properties.keys())}")
        logger.info(f"  Required: {required}")
        if "items" in properties:
            logger.info(f"  Items schema: {properties['items']}")

        return schema

    def _get_python_type(self, type_str: str) -> type:
        """Convert JSON schema type to Python type"""
        type_map = {
            "string": str,
            "number": float,
            "integer": int,
            "boolean": bool,
            "array": list,
            "object": dict,
        }
        return type_map.get(type_str, str)

    def _parse_parameter_type(self, param_info: dict) -> type:
        """
        Parse parameter type from schema, handling nested structures.

        Supports:
        - Basic types (string, number, etc.)
        - Nested objects with properties
        - Arrays with nested item schemas

        Args:
            param_info: Parameter schema dict with type, properties, items, etc.

        Returns:
            Python type for the parameter
        """
        param_type = param_info.get("type", "string")

        # Handle nested object types with properties
        if param_type == "object" and "properties" in param_info:
            return dict  # Accept as dictionary, LLM will structure it properly

        # Handle array types with nested items
        if param_type == "array" and "items" in param_info:
            items_schema = param_info["items"]
            # Check if items are objects with properties
            if isinstance(items_schema, dict) and items_schema.get("type") == "object":
                return list  # Accept as list of dicts
            return list  # Accept as list of any type

        # Handle basic array type (no nested items specified)
        if param_type == "array":
            return list

        # Handle basic object type (no nested properties specified)
        if param_type == "object":
            return dict

        # Fallback to basic type mapping
        return self._get_python_type(param_type)

    def _build_json_schema_for_param(self, param_name: str, param_info: dict) -> dict:
        """
        Build a proper JSON schema for a parameter that satisfies OpenAI's requirements.

        Crucially, for object types with properties, this adds 'additionalProperties: false'
        which is required by OpenAI.

        Args:
            param_name: Name of the parameter
            param_info: Parameter info from frontend schema

        Returns:
            JSON schema dict for this parameter
        """
        param_type = param_info.get("type", "string")

        # Note: Frontend sends "array" type (not "object[]") - this is just for safety
        if isinstance(param_type, str) and param_type.endswith("[]"):
            logger.warning(f"Received legacy array notation '{param_type}' for param '{param_name}' - frontend should send 'array' type")
            base_type = param_type[:-2]
            schema = {"type": "array"}
            items_schema = {"type": base_type}
            if base_type == "object":
                items_schema["additionalProperties"] = False
            schema["items"] = items_schema
        else:
            # Standard JSON Schema type
            schema = {"type": param_type}

        # Add description if present (skip if already handled for TypeScript array)
        if "description" in param_info and schema.get("type") != "array":
            schema["description"] = param_info["description"]
        elif "description" in param_info and schema.get("type") == "array":
            # For arrays, add description to the array itself
            schema["description"] = param_info["description"]

        # Handle enum
        if "enum" in param_info:
            schema["enum"] = param_info["enum"]

        # Handle object types with properties (frontend always converts attributes -> properties)
        if param_type == "object" and "properties" in param_info and isinstance(param_info["properties"], dict):
            properties = {}
            required = []

            # Frontend sends properties as a dict of param_name: param_schema
            for prop_name, prop_schema in param_info["properties"].items():
                # Recursively build each property schema
                properties[prop_name] = self._build_json_schema_for_param(prop_name, prop_schema)
                if prop_schema.get("required", False):
                    required.append(prop_name)

            schema["properties"] = properties
            schema["additionalProperties"] = False  # Required by OpenAI

            if required:
                schema["required"] = required
        elif param_type == "object":
            # Object without nested properties - still needs additionalProperties: false for OpenAI
            schema["additionalProperties"] = False

        # Handle arrays with items
        elif param_type == "array" and "items" in param_info:
            items_schema = param_info["items"]
            if isinstance(items_schema, dict):
                # Recursively build the items schema (handles nested objects with properties)
                schema["items"] = self._build_json_schema_for_param(
                    f"{param_name}_item", items_schema
                )

        return schema

    def register_tools_from_schemas(self, tool_schemas: list):
        """
        Register multiple tools from frontend schemas.

        Args:
            tool_schemas: List of tool definitions from frontend
        """
        logger.info(f"Registering {len(tool_schemas)} tools from frontend")

        for schema in tool_schemas:
            tool_name = schema["name"]
            tool_params = schema.get("parameters", {})

            # Check for nested parameters (objects with properties or arrays with items)
            if isinstance(tool_params, list):
                # Should never happen - frontend always converts to dict
                logger.warning(f"Tool '{tool_name}' has parameters as list - frontend should send dict")
                has_nested = any(
                    "properties" in p or "items" in p
                    for p in tool_params if isinstance(p, dict)
                )
            else:
                has_nested = any(
                    "properties" in p or "items" in p
                    for p in tool_params.values() if isinstance(p, dict)
                )
            if has_nested:
                logger.info(f"  Tool '{tool_name}' has nested parameters (object/array with properties)")

            # create_frontend_tool now returns an already-decorated tool
            tool_func = self.create_frontend_tool(schema)

            self.registered_tools[tool_name] = tool_func
            logger.info(f"✓ Registered tool: {tool_name}")

        return list(self.registered_tools.values())


def get_atlas_intelligence_instructions(user_context: dict, workspace_context_str: str, current_date: str, current_time: str) -> str:
    """
    Generate system instructions for Atlas Intelligence persona (procurement wizard).

    Args:
        user_context: User context dict with name, email, timezone
        workspace_context_str: Formatted workspace context string
        current_date: Current date in user's timezone
        current_time: Current time in user's timezone

    Returns:
        System instructions string for Atlas Intelligence
    """
    return """# Personality

You are Atlas Intelligence, a helpful assistant guiding users through procurement request creation.

# CRITICAL LANGUAGE RULE

**YOU MUST RESPOND IN THE SAME LANGUAGE THE USER IS TYPING.**

- User types "Hello, who are you?" → You respond in ENGLISH
- User types "Halo, siapa kamu?" → You respond in INDONESIAN

**IGNORE these when deciding language:**
- User's name (e.g., "Alif", "John", "Budi")
- User's timezone (e.g., "Asia/Jakarta", "America/New_York")
- Platform location (Indonesia)
- Your assumptions about user preferences

**ONLY look at the ACTUAL WORDS they type in their messages to determine language.**

If you violate this rule and switch languages when the user hasn't, you will confuse them.

# Environment

You are assisting users through a web-based interface. The user is filling out a procurement request form comprised of multiple steps. Using tools you can assess what step you are on and what inputs are available to be interacted with in that step.

If you are getting inquiries from the user that are not relevant yet in the current step but will be relevant in another step, you should remember and take note of the data so that you can fill it out when the progress reaches the relevant step.

# Tone & Communication Style

- **Be conversational, not robotic**: Vary your responses naturally. Don't start every message with "Perfect!" "Excellent!" "Great!" or "Okay!" - it sounds formulaic.
- **Sometimes just proceed**: After tool calls, you can often just share the result or next step without an enthusiastic preamble.
- **Keep it brief**: Responses should be natural and concise, generally under three sentences.
- **Vary your acknowledgments**: When you do acknowledge, mix it up: "Got it," "I see," "Understood," "Sure," or sometimes just proceed directly.
- **Be professional but warm**: Friendly without being overly excited about routine operations.
- **Adapt technical language** based on user familiarity.

VERY IMPORTANT:
- For response messages, NEVER abbreviate words (kg, pcs, etc.) - use the full word.
- For response messages, convert numbers to words (e.g., 1000 to "one thousand").
- NEVER USE ASTERISKS, COMPLEX FORMATTING, EMOJIS, OR OTHER SYMBOLS.
- NEVER REVEAL UUIDs, IDs, or any internal identifiers to the user.

# Goal

Your primary goal is to help users complete their procurement request form efficiently while ensuring they understand each step.

**Guided Assistance Approach:**
- Fill in information as users provide it, but don't rush to the next step unless they explicitly want to proceed.
- If the user says "I need office chairs", call `setName` with "Office Chairs" and then ask if they'd like to proceed or if there's anything else they want to specify for this step.
- When they mention details for future steps (e.g., "I need 50 chairs delivered to Jakarta"), acknowledge it ("Got that - I'll remember the quantity and delivery details for when we get to those sections") and continue with the current step.
- Always confirm before advancing to the next step: "Ready to move on to the next step?" or "Should we proceed to [next step name]?"

**CRITICAL - CONFIRMATION REQUIRED BEFORE NAVIGATION:**
You MUST get explicit user confirmation before calling these tools:
- `goToNextStep` - NEVER call unless user explicitly says "next", "continue", "proceed", "move on", "yes" (in response to your question), or similar
- `submitSimpleDeliveryForm` - NEVER call unless user explicitly confirms they want to submit
- Any tool that submits or finalizes data

If you navigate or submit without explicit user confirmation, you will frustrate and confuse users. This is a HARD requirement.

**Step Navigation Guidelines:**
- Only advance to the next step when:
  1. The user explicitly asks to proceed ("next", "continue", "let's move on", "go ahead", "proceed")
  2. The user confirms they're ready when you ask ("yes", "sure", "ok", "yep")
  3. They've completed all required fields AND explicitly indicated they're done with the current step
- NEVER advance when:
  1. The user is still providing information
  2. They haven't explicitly confirmed they want to proceed
  3. They're asking questions about the current step
  4. They seem to be thinking or planning what to enter
  5. You just finished filling in data - ASK if they want to proceed, don't auto-proceed
  6. The user said something ambiguous that COULD mean proceed but isn't explicit

**Progressive Disclosure:**
- Each step reveals new fields. Don't try to gather all information upfront.
- If the user volunteers information for later steps, store it mentally but focus on completing the current step thoroughly.
- The form has natural validation, but don't rely solely on it - ensure users feel confident about their entries before proceeding.

# Guardrails

If the user asks a question outside of the scope of procurement requests, politely decline to answer.

# User Context

CURRENT DATE IS {current_date}
CURRENT TIME IS {current_time} (in user's timezone: {user_timezone})
USER'S NAME IS {user_name}

# Workspace Context

{workspace_context}

# Tool Usage

Use the available tools to understand the current form state, navigate between steps, and fill in form data. The tools available will change based on which step of the form the user is on.

**IMPORTANT**:
- Call `getCurrentFormState` after navigation or field changes to get the latest state
- For recurring deliveries, the quantity parameter represents quantity PER DELIVERY, not total
- All creation tools return JSON with generated IDs - use these exact IDs for subsequent operations

# Delivery Plan Step Guidance

When the user reaches the Delivery Plan step, follow this approach:

1. **First, understand the context**: Call `getDeliveryPlanOptions` to see:
   - What path options are available (Simple vs Multiple Destinations)
   - How many items need to be scheduled
   - Whether the user has registered properties
   - Explain the options to the user and ask which they prefer

2. **Help choose the right path**:
   - **Simple**: Best for straightforward orders - all items go to one place on one date
   - **Multiple Destinations**: Best for complex orders with different items going to different places or dates

3. **If user wants to use a property**: Call `listDeliveryProperties` to get their registered properties, then help them select one by name.

4. **Guide through the process**:
   - For Simple path: Help set destination, date/time, and WAIT for user to confirm before submitting
   - For Destination-based path: Help add destinations, then add deliveries with dates, then assign items

5. **CRITICAL - NEVER auto-submit or auto-proceed**:
   - After setting up delivery details, ALWAYS ask: "Does this look correct? Ready to proceed?"
   - ONLY call `submitSimpleDeliveryForm` or `goToNextStep` after explicit user confirmation
""".format(
        current_date=current_date,
        current_time=current_time,
        user_timezone=user_context["user_timezone"],
        user_name=user_context["user_name"],
        workspace_context=workspace_context_str,
    )

def get_atlas_copilot_instructions(user_context: dict, workspace_context_str: str, current_date: str, current_time: str) -> str:
    return """# Personality

You are Atlas Copilot, a helpful assistant for B-Source, a sourcing and property management platform in Indonesia. You help users explore and navigate the platform, whether they're creating procurement requests, managing suppliers, viewing properties, or discovering platform features.

# CRITICAL LANGUAGE RULE

**YOU MUST RESPOND IN THE SAME LANGUAGE THE USER IS TYPING.**

- User types "Hello, who are you?" → You respond in ENGLISH
- User types "Halo, siapa kamu?" → You respond in INDONESIAN

**IGNORE these when deciding language:**
- User's name (e.g., "Alif", "John", "Budi")
- User's timezone (e.g., "Asia/Jakarta", "America/New_York")
- Platform location (Indonesia)
- Your assumptions about user preferences

**ONLY look at the ACTUAL WORDS they type in their messages to determine language.**

If you violate this rule and switch languages when the user hasn't, you will confuse them.

# Environment

You are assisting users through a web-based interface. The platform offers various features including procurement request creation, supplier management, property management, inventory tracking, and more. Using tools, you can understand the user's current context and help them accomplish their goals. Tools are dynamically provided based on what the user is currently working on - they may be focused on a specific form, browsing data, or exploring features.

Users can also send you images for analysis. When a user shares an image, examine it carefully and provide helpful insights, descriptions, or answer questions about what you see in the image.

# Tone & Communication Style
- **Be conversational, not robotic**: Vary your responses naturally. Don't start every message with "Perfect!" "Excellent!" "Great!" or "Okay!" - it sounds formulaic.
- **Vary your acknowledgments**: When you do acknowledge, mix it up: "Got it," "I see," "Understood," "Sure," or sometimes just proceed directly.
- **Be professional but warm**: Friendly without being overly excited about routine operations.
- **Keep responses concise**: Under 75 words and/or under 3 sentences when possible. NEVER MORE THAN 1 QUESTION AT ONCE.
- **Avoid formulaic responses**: Don't start every response with "Perfect!" "Excellent!" "Great!" or "Okay!" - vary your language naturally.
- **Guide exploration**: If users seem unsure what to do, help them discover relevant features or suggest next steps based on their context.
- **IMPORTANT - Before tool calls**: When you need to use a tool, ALWAYS acknowledge first with a brief phrase like "Let me check that for you...", "Looking into that...", or "One moment...". This prevents awkward silence while tools execute.
- NEVER REVEAL UUIDs, IDs, or any internal identifiers to the user - REFERENCE BY OTHER MEANS INSTEAD.

VERY IMPORTANT:
- For response messages, NEVER abbreviate words (kg, pcs, etc.) - use the full word. For tool calls you are allowed to use the usual abbreviations.
- For response messages, convert numbers to words (e.g., 1000 to "one thousand"). For tool calls you are allowed to use the usual numbers.
- NEVER USE ASTERISKS, COMPLEX FORMATTING, EMOJIS, OR OTHER SYMBOLS.

# Goal

Your primary goal is to help users efficiently accomplish their tasks on the B-Source platform, whether that's creating procurement requests, managing suppliers, exploring properties, or discovering platform capabilities. Use available tools to understand context and take appropriate actions.

# Supplier Search Strategy

When users ask about suppliers, follow this approach:

1. **Retrieve all suppliers with their products** using `search_suppliers`:
   - Call with `include_items=true` to get all suppliers and the items they supply
   - The tool returns ALL suppliers - you do the semantic matching
   - For "Do I have a mango supplier?" - match "mango" with items like "mango", "mangga", "manggo" (handle typos, language variations)
   - For "Who supplies chicken?" - match "chicken" with "chicken breast", "whole chicken", "poultry", "ayam" semantically
   - For "How many suppliers?" - just count the total returned
   - Use your natural language understanding to match:
     * Typos: "manggo" matches "mango"
     * Languages: "mangga" (Indonesian) matches "mango" (English)
     * Synonyms: "chicken" matches "poultry" or "ayam"
     * Variations: "flour" matches "wheat flour", "tepung", "terigu"

2. **If not found, offer to search Buyamia's database** using `search_global_suppliers`:
   - If the organization doesn't have the requested supplier/product, inform them
   - Then offer: "Would you like me to search Buyamia's supplier database for you?"
   - If they agree (e.g., "Boleh tolong carikan yang ada?"), use `search_global_suppliers`
   - This searches ALL suppliers in Buyamia's system

# Guardrails

If the user asks about something completely outside the scope of B-Source platform functionality, politely redirect them back to platform-related topics. However, be helpful with general questions about how to use the platform or what features are available.

# Pagination

Some tools that return a list of items may support pagination. A paginated response will include a `meta` object with the following fields: `currentPage`, `totalPages`, `limit`, and `totalCount`.

If you receive a paginated response and need to retrieve more items, you can call the same tool again with the `page` parameter incremented. Continue fetching pages until `currentPage` equals `totalPages`. When the user's query implies that all items are needed (e.g., "find a specific item," "summarize all items"), you MUST iterate through all pages to get the complete dataset.

# User Context

CURRENT DATE IS {current_date}
CURRENT TIME IS {current_time} (in user's timezone: {user_timezone})
USER'S NAME IS {user_name}

# Workspace Context

The user has already selected their organization and property in the platform UI. These are their CURRENT working context.

**IMPORTANT RULES:**
1. ALWAYS use the provided organization_id and property_id when calling tools - YOU DO NOT need ask the user to confirm or select these
2. ASSUME the user wants to work within their current context unless they EXPLICITLY say otherwise (e.g., "switch to property X", "use a different organization")
3. If a tool requires organization_id or property_id, use the values below without confirmation
4. Only ask about organization/property if the user explicitly requests to change it

{workspace_context}
""".format(
        current_date=current_date,
        current_time=current_time,
        user_timezone=user_context["user_timezone"],
        user_name=user_context["user_name"],
        workspace_context=workspace_context_str,
    )

def create_session_scoped_tools(state: SessionState) -> list:
    """
    Create tools that are scoped to a specific session.
    This ensures concurrent sessions don't share state.
    """

    async def _add_image_from_url(file_url: str) -> None:
        if not state.agent:
            logger.error("Agent not initialized, cannot process image metadata")
            return

        chat_ctx = state.agent.chat_ctx.copy()
        chat_ctx.add_message(
            role="user",
            content=[ImageContent(image=file_url)],
        )

        await state.agent.update_chat_ctx(chat_ctx)
        logger.info("Image reference %s added to chat context", file_url)

    # Store the helper function on state for use in data handlers
    state._add_image_from_url = _add_image_from_url

    @function_tool
    async def get_context(context: RunContext) -> str:
        """
        Get the current context from the frontend (e.g., current form state, current page).

        Returns:
            JSON string with current context information
        """
        room = state.room
        if not room:
            raise agents.ToolError("Agent not properly initialized")

        # Get the first remote participant (frontend)
        if not room.remote_participants:
            raise agents.ToolError("No frontend participant connected")

        participant_identity = next(iter(room.remote_participants))

        logger.info("Requesting context from frontend via RPC")

        try:
            # Use RPC to call the frontend context method
            result = await room.local_participant.perform_rpc(
                destination_identity=participant_identity,
                method="get_context",
                payload="{}",  # Empty payload for context request
                response_timeout=5.0,
            )
            logger.info(f"Received context: {result}")
            return result if isinstance(result, str) else json.dumps(result)
        except Exception as e:
            logger.error(f"Error getting context: {e}")
            raise agents.ToolError(f"Unable to retrieve context: {e!s}") from e

    return [get_context]


def prewarm(proc: JobProcess):
    """Preload models to reduce latency"""
    logger.info("Prewarming models...")
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.2,  # Minimum speech duration to be considered speech (200ms)
        min_silence_duration=0.8,  # Increased to 800ms to allow natural pauses (commas, thinking)
        # Note: ElevenLabs uses 1.5s, but 0.8s provides good balance between responsiveness and natural flow
    )
    logger.info("VAD model loaded")


async def entrypoint(ctx: JobContext):
    # Set logging context
    ctx.log_context_fields = {"room": ctx.room.name}

    # Connect to the room
    await ctx.connect()

    # Create session-scoped state (ensures concurrent sessions don't share state)
    state = SessionState(room=ctx.room)
    state.tool_registry = DynamicToolRegistry(ctx.room)

    async def refresh_frontend_tools() -> list:
        """
        Fetch the latest tool registry from the frontend and re-register tools.
        Returns the updated list of dynamic tools.
        """
        try:
            if not ctx.room.remote_participants:
                logger.warning("[Tools Refresh] No remote participants to fetch tools from")
                return []

            participant_identity = next(iter(ctx.room.remote_participants))

            logger.info("[Tools Refresh] Requesting updated tool registry from frontend...")
            response = await ctx.room.local_participant.perform_rpc(
                destination_identity=participant_identity,
                method="get_tool_registry",
                payload="{}",
                response_timeout=5.0,
            )

            message = json.loads(response if isinstance(response, str) else json.dumps(response))
            tool_schemas = message.get("tools", [])

            if tool_schemas:
                logger.info(f"[Tools Refresh] Received {len(tool_schemas)} tool schemas")
                for schema in tool_schemas:
                    logger.info(f"  - Tool: {schema.get('name')} - {schema.get('description', 'No description')}")

                # Re-register tools with updated registry
                dynamic_tools = state.tool_registry.register_tools_from_schemas(tool_schemas)
                logger.info(f"[Tools Refresh] Successfully registered {len(dynamic_tools)} tools")
                return dynamic_tools
            else:
                logger.info("[Tools Refresh] No tools in registry (current page has no tools)")
                return []

        except Exception as e:
            logger.error(f"[Tools Refresh] Failed to refresh tools: {e}")
            return []

    async def handle_tools_changed_rpc(data: rtc.RpcInvocationData) -> str:
        """
        RPC handler called by frontend when tools are registered/unregistered.
        This happens when user navigates between wizard steps.
        """
        try:
            payload = json.loads(data.payload) if data.payload else {}
            timestamp = payload.get("timestamp", 0)
            tool_count = payload.get("toolCount", 0)

            logger.info(f"[Tools Changed] Notification received: {tool_count} tools available (timestamp: {timestamp})")

            # Refresh the tool registry
            dynamic_tools = await refresh_frontend_tools()

            # Update the agent's tools with the new dynamic tools
            if state.agent and state.session:
                # Recreate session-scoped and backend tools
                session_tools = create_session_scoped_tools(state)

                # Get current persona from agent instructions
                current_persona = "atlas-copilot"
                if state.agent.instructions and "Atlas Intelligence" in state.agent.instructions:
                    current_persona = "atlas-intelligence"

                backend_tools = BACKEND_TOOLS if current_persona == "atlas-copilot" else []

                # Combine all tools
                all_tools = [*session_tools, *backend_tools, *dynamic_tools]

                logger.info(f"[Tools Changed] Updating agent with {len(all_tools)} total tools ({len(session_tools)} session + {len(backend_tools)} backend + {len(dynamic_tools)} dynamic)")

                # Use official update_tools() method to replace all tools
                await state.agent.update_tools(all_tools)
                logger.info("[Tools Changed] Successfully updated agent tools via update_tools()")

                # Also update our tracked tools list
                state.current_tools.clear()
                state.current_tools.extend(all_tools)

            logger.info("[Tools Changed] Successfully updated agent tools")
            return json.dumps({"success": True, "toolsRegistered": len(dynamic_tools)})

        except Exception as e:
            logger.error(f"[Tools Changed] Error handling tools_changed RPC: {e}")
            return json.dumps({"success": False, "error": str(e)})

    # Register the tools_changed RPC handler
    ctx.room.local_participant.register_rpc_method("tools_changed", handle_tools_changed_rpc)
    logger.info("[RPC] Registered tools_changed handler")

    # Tools will be registered dynamically via RPC
    dynamic_tools = []
    tools_received = asyncio.Event()

    # Request tool registry from frontend via RPC
    logger.info("Requesting tool registry from frontend via RPC...")
    rpc_attempts = 0
    max_attempts = 10
    while rpc_attempts < max_attempts:
        try:
            if not ctx.room.remote_participants:
                logger.info("No remote participants yet; waiting before RPC...")
                await asyncio.sleep(0.5)
                rpc_attempts += 1
                continue
            participant_identity = next(iter(ctx.room.remote_participants))
            response = await ctx.room.local_participant.perform_rpc(
                destination_identity=participant_identity,
                method="get_tool_registry",
                payload="{}",
                response_timeout=5.0,
            )
            try:
                message = json.loads(response if isinstance(response, str) else json.dumps(response))
                tool_schemas = message.get("tools", [])
            except Exception:
                logger.error("Invalid tool registry RPC response format")
                tool_schemas = []

            # If RPC call succeeded, we got a response (even if empty)
            # Empty tools array means this page genuinely has no tools - accept it and proceed
            if tool_schemas:
                logger.info(f"Received {len(tool_schemas)} tool schemas via RPC")
                for schema in tool_schemas:
                    logger.info(f"  - Tool: {schema.get('name')} - {schema.get('description', 'No description')}")
                    params = schema.get('parameters')
                    if params:
                        if isinstance(params, list):
                            logger.info(f"    Parameters (array): {[p.get('name') for p in params]}")
                            # Log the draft_procurement_request params in detail
                            if schema.get('name') == 'draft_procurement_request':
                                logger.info(f"    Full params for draft_procurement_request: {params}")
                        else:
                            logger.info(f"    Parameters (dict): {list(params.keys())}")
                # Register tools
                dynamic_tools = state.tool_registry.register_tools_from_schemas(tool_schemas)
                logger.info(f"Registered {len(dynamic_tools)} dynamic tools")
            else:
                # Empty tools array - page has no tools, proceed with base tools only
                logger.info("No tools returned via RPC - this page has no tools, proceeding with base tools only")
                dynamic_tools = []

            # Mark tools as received (even if empty) - RPC call succeeded
            tools_received.set()
            break
        except Exception as e:
            error_msg = str(e)
            if "Method not supported" in error_msg:
                logger.info(f"RPC get_tool_registry attempt {rpc_attempts+1} failed: {e} (frontend may not have registered method yet)")
            else:
                logger.warning(f"RPC get_tool_registry attempt {rpc_attempts+1} failed: {e}")
        rpc_attempts += 1
        await asyncio.sleep(0.5)

    # Wait for tools with timeout (only needed if RPC never succeeded)
    try:
        await asyncio.wait_for(tools_received.wait(), timeout=5.0)
        logger.info("✓ Tool registry request completed (may have 0 tools if page has none)")
    except asyncio.TimeoutError:
        logger.warning("⚠ Timeout waiting for tool registry, proceeding with base tools only")

    # Extract user context and persona from remote participant metadata FIRST
    user_context = {"user_name": "there", "user_email": None, "user_timezone": "UTC"}
    persona = "atlas-copilot"  # Default persona
    if ctx.room.remote_participants:
        remote_participant = next(iter(ctx.room.remote_participants.values()))
        user_context = get_user_context_from_participant(remote_participant)
        persona = get_persona_from_participant(remote_participant)
        logger.info(f"User context extracted: name={user_context['user_name']}, timezone={user_context['user_timezone']}, persona={persona}")

    # Create session-scoped tools (get_context, etc.)
    session_tools = create_session_scoped_tools(state)

    # Conditionally include backend tools based on persona
    # Backend tools (inventory, suppliers, etc.) are only for atlas-copilot, not atlas-intelligence
    backend_tools = BACKEND_TOOLS if persona == "atlas-copilot" else []

    # Create initial agent with all available tools
    all_tools = [*session_tools, *backend_tools, *dynamic_tools]
    logger.info(f"Creating agent with {len(all_tools)} total tools for persona '{persona}' ({len(session_tools)} session + {len(backend_tools)} backend + {len(dynamic_tools)} dynamic)")

    # Clear processed images for this session
    state.processed_image_messages.clear()

    # Fetch initial workspace context (org/property) from frontend via RPC
    if ctx.room.remote_participants:
        try:
            participant_identity = next(iter(ctx.room.remote_participants))
            context_response = await ctx.room.local_participant.perform_rpc(
                destination_identity=participant_identity,
                method="get_context",
                payload="{}",
                response_timeout=5.0,
            )
            context_data = json.loads(context_response) if isinstance(context_response, str) else context_response
            state.workspace_context = {
                "organization_id": context_data.get("organizationId"),
                "organization_name": context_data.get("organizationName"),
                "property_id": context_data.get("propertyId"),
                "property_name": context_data.get("propertyName"),
            }
            logger.info(f"Initial workspace context: org={state.workspace_context['organization_name']}, property={state.workspace_context['property_name']}")
        except Exception as e:
            logger.warning(f"Failed to fetch initial workspace context: {e}")

    # Get current date in user's timezone
    try:
        user_tz = ZoneInfo(user_context["user_timezone"])
        current_date = datetime.now(user_tz).strftime("%Y-%m-%d")
        current_time = datetime.now(user_tz).strftime("%H:%M")
    except Exception:
        current_date = datetime.now().strftime("%Y-%m-%d")
        current_time = datetime.now().strftime("%H:%M")

    # Build workspace context string for instructions (include IDs for tool calls)
    workspace_context_parts = []
    if state.workspace_context.get("organization_id"):
        org_name = state.workspace_context.get("organization_name") or "Unknown"
        workspace_context_parts.append(f"CURRENT ORGANIZATION: {org_name}")
        workspace_context_parts.append(f"ORGANIZATION_ID (for tool calls): {state.workspace_context['organization_id']}")
    if state.workspace_context.get("property_id"):
        prop_name = state.workspace_context.get("property_name") or "Unknown"
        workspace_context_parts.append(f"CURRENT PROPERTY: {prop_name}")
        workspace_context_parts.append(f"PROPERTY_ID (for tool calls): {state.workspace_context['property_id']}")
    workspace_context_str = "\n".join(workspace_context_parts) if workspace_context_parts else "No organization/property currently selected."

    # Select instructions based on persona
    if persona == "atlas-intelligence":
        instructions = get_atlas_intelligence_instructions(
            user_context, workspace_context_str, current_date, current_time
        )
        logger.info("Using Atlas Intelligence persona instructions")
        logger.info(f"Instructions: {instructions}")
    else:
        instructions = get_atlas_copilot_instructions(
            user_context, workspace_context_str, current_date, current_time
        )
        logger.info("Using Atlas Copilot persona instructions")
        logger.info(f"Instructions: {instructions}")

    state.agent = Agent(
        instructions=instructions,
        tools=all_tools,  # Include all tools (session-scoped + backend + dynamic)
    )

    # Store the initial tools list in state for tracking
    state.current_tools = all_tools.copy()

    # Detect if this is a text-only session by checking if remote participant has audio tracks
    # Wait a moment for tracks to be published
    is_text_only = False
    if ctx.room.remote_participants:
        # Wait briefly for tracks to be published
        await asyncio.sleep(0.5)
        remote_participant = next(iter(ctx.room.remote_participants.values()))
        # Check if participant has any audio track publications
        has_audio = any(
            pub.kind == rtc.TrackKind.KIND_AUDIO
            for pub in remote_participant.track_publications.values()
        )
        is_text_only = not has_audio
        logger.info(f"Detected session type: {'text-only' if is_text_only else 'voice'} (has_audio={has_audio})")

    # Create the session with models using custom API keys
    # Using gpt-4o which supports vision (images)
    vad_instance = ctx.proc.userdata["vad"]

    state.session = AgentSession(
        # stt=cartesia.STT(
        #     model="ink-whisper"
        # ),
        # stt=openai.STT(
        #     model="gpt-4o-transcribe",
        # ),
        # llm=openai.LLM.with_openrouter(model="anthropic/claude-haiku-4.5"),
        # llm=google.LLM(
        #     model="gemini-flash-latest",
        # ),
        # llm=openai.LLM(
        #     model="gpt-4.1",
        #     temperature=0.7,
        #     # reasoning_effort="none",
        # ),
        # tts=elevenlabs.TTS(
        #     model="eleven_flash_v2_5",
        #     voice_id="cjVigY5qzO86Huf0OWal", # english voice
        #     voice_settings=elevenlabs.VoiceSettings(
        #         stability=0.5,
        #         similarity_boost=0.8,
        #         style=0.0,
        #         use_speaker_boost=True
        #     ),
        #     # streaming_latency=1,
        #     # encoding="mp3_44100_128",
        #     # chunk_length_schedule=[150, 250, 400],
        # ),
        # tts=cartesia.TTS(
        #     model="sonic-3",
        #     voice="a167e0f3-df7e-4d52-a9c3-f949145efdab"
        # ),
        llm=openai.realtime.RealtimeModel(
            voice="cedar",
            turn_detection=TurnDetection(
                type="semantic_vad",
                eagerness="auto",
                create_response=True,
                interrupt_response=True,
            ),
        ),
        # llm=google.realtime.RealtimeModel(
        #     model="gemini-2.0-flash-exp",
        #     voice="Puck",
        #     temperature=0.8,
        # ),
        # vad=vad_instance,  # Use prewarmed VAD
        # allow_interruptions=True,
        # min_interruption_duration=0.8,  # Increased to 800ms to reduce false interruptions
        # min_endpointing_delay=0.8,  # Increased to 800ms for more natural turn-taking (matches VAD silence duration)
        # use_tts_aligned_transcript=True,
    )

    async def _process_chat_image_metadata(metadata: dict):
        file_url = metadata.get("fileUrl") or metadata.get("imageUrl")
        if not file_url:
            logger.debug("Received chat image metadata without fileUrl/imageUrl")
            return

        cache_key = (
            str(metadata.get("fileId"))
            or str(metadata.get("messageTimestamp"))
            or file_url
        )
        if cache_key in state.processed_image_messages:
            logger.debug("Duplicate chat image metadata ignored (key=%s)", cache_key)
            return
        state.processed_image_messages.add(cache_key)

        # Use session-scoped helper function
        await state._add_image_from_url(file_url=file_url)
        # After adding the image to chat context, ACK back to the frontend via RPC
        try:
            room = state.room
            if room and room.remote_participants:
                participant_identity = next(iter(room.remote_participants))
                ack_payload = {
                    "type": "image_context_added",
                    "fileId": metadata.get("fileId"),
                    "messageTimestamp": metadata.get("messageTimestamp"),
                    "fileUrl": file_url,
                }
                await room.local_participant.perform_rpc(
                    destination_identity=participant_identity,
                    method="image_context_added",
                    payload=json.dumps(ack_payload),
                    response_timeout=2.0,
                )
                logger.debug("Sent image_context_added ACK for fileId=%s", metadata.get("fileId"))
        except Exception as exc:
            logger.debug("Failed to send image_context_added ACK: %s", exc)

    async def _process_context_update(context_data: dict) -> None:
        """Process context update from frontend and update session workspace context."""
        # Update session-scoped context (not global)
        state.workspace_context = {
            "organization_id": context_data.get("organizationId"),
            "organization_name": context_data.get("organizationName"),
            "property_id": context_data.get("propertyId"),
            "property_name": context_data.get("propertyName"),
        }
        
        logger.info(f"Updated workspace context: org={state.workspace_context['organization_name']}, property={state.workspace_context['property_name']}")

    @ctx.room.on("data_received")
    def _handle_data_received(packet):
        topic = getattr(packet, "topic", None)
        
        # Handle context updates from frontend
        if topic == "context-updates":
            try:
                context_data = json.loads(packet.data.decode("utf-8"))
                if context_data.get("type") == "context_update":
                    asyncio.create_task(_process_context_update(context_data))
            except Exception as exc:
                logger.debug("Failed to parse context update: %s", exc)
            return
        
        # Handle chat images
        if topic != "chat-images":
            return
        try:
            metadata = json.loads(packet.data.decode("utf-8"))
        except Exception as exc:
            logger.debug("Failed to parse chat image metadata: %s", exc)
            return

        _ = asyncio.create_task(_process_chat_image_metadata(metadata))

    # Start the session with appropriate options based on session type
    if is_text_only:
        # For text-only sessions, disable audio input and output to skip TTS computation
        await state.session.start(
            agent=state.agent,
            room=ctx.room,
            room_input_options=RoomInputOptions(audio_enabled=False),
            room_output_options=RoomOutputOptions(audio_enabled=False),
        )
        logger.info("✓ Agent session started in text-only mode (TTS disabled)")
    else:
        # For voice sessions, use default audio settings
        await state.session.start(agent=state.agent, room=ctx.room)
        logger.info("✓ Agent session started in voice mode with all tools")

    # Check if there's an initial question to respond to
    initial_question = user_context.get("initial_question")
    
    if initial_question:
        # User has a specific question - respond directly to it without a generic greeting
        logger.info(f"Responding to initial question: {initial_question}")
        
        # Send immediate acknowledgment so user knows we're working on it
        await state.session.say("Let me look into that for you.", allow_interruptions=False)
        
        # Add the user's question to the chat context so the agent sees it
        chat_ctx = state.agent.chat_ctx.copy()
        chat_ctx.add_message(role="user", content=initial_question)
        await state.agent.update_chat_ctx(chat_ctx)
        
        # Generate a response to the question
        await state.session.generate_reply()
    else:
        # No initial question - use personalized greeting
        time_greeting = get_time_based_greeting(user_context["user_timezone"])
        user_name = user_context["user_name"]

        # Build personalized greeting instruction based on persona
        if persona == "atlas-intelligence":
            # Atlas Intelligence: Direct, action-oriented greeting
            if user_name and user_name.lower() not in ["there", "user"]:
                greeting_instruction = f"Say ONLY this in English: '{time_greeting}, {user_name}! Ready to create your procurement request?' Keep it natural and in ONE single message."
            else:
                greeting_instruction = f"Say ONLY this in English: '{time_greeting}! Ready to create your procurement request?' Keep it natural and in ONE single message."
        else:
            # Atlas Copilot: Warm, helpful greeting
            if user_name and user_name.lower() not in ["there", "user"]:
                greeting_instruction = f"Say ONLY this in English: '{time_greeting}, {user_name}! How can I assist you today?' Keep it natural and in ONE single message."
            else:
                greeting_instruction = f"Say ONLY this in English: '{time_greeting}! How can I assist you today?' Keep it natural and in ONE single message."

        logger.info(f"Generating personalized greeting: {greeting_instruction}")
        await state.session.generate_reply(instructions=greeting_instruction)

    logger.info("Agent session started successfully")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
