"""
Dynamic tool registry for LiveKit agent.
Manages dynamic registration of frontend tools as LLM-callable functions.
"""

import json
import logging
from typing import Callable

from livekit import rtc
from livekit.agents import RunContext, function_tool, ToolError

logger = logging.getLogger("buyamia-credit-agent")


class DynamicToolRegistry:
    """
    Manages dynamic registration of frontend tools as LLM-callable functions.
    This allows the LLM to see and call each frontend tool individually.
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
    _logging.getLogger("buyamia-credit-agent").info("[Tool Call] {escaped_tool_name} with args: " + args_str)
    
    try:
        # Validate that the arguments from the LLM are valid JSON
        try:
            payload = _json.dumps(raw_arguments)
        except TypeError as e:
            error_msg = f"LLM returned invalid arguments for '{escaped_tool_name}': {{str(e)}}"
            _logging.getLogger("buyamia-credit-agent").error(f"[Tool Error] {{error_msg}}")
            raise ToolError(error_msg)

        # Use RPC to call the frontend tool method
        response = await _room.local_participant.perform_rpc(
            destination_identity=participant_identity,
            method="{func_name}",
            payload=payload,
            response_timeout=30.0,
        )
        
        result_str = str(response)
        _logging.getLogger("buyamia-credit-agent").info("[Tool Result] {escaped_tool_name}: " + result_str)
        return response
    except Exception as e:
        error_msg = f"Error calling '{escaped_tool_name}': {{str(e)}}"
        _logging.getLogger("buyamia-credit-agent").error(f"[Tool Error] {{error_msg}}")
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
            "ToolError": ToolError,
        }

        exec(func_code, namespace)
        dynamic_tool = namespace[tool_name]

        # Decorate with @function_tool using raw_schema
        decorated_tool = function_tool(raw_schema=raw_schema)(dynamic_tool)

        return decorated_tool

    def _build_openai_function_schema(self, tool_name: str, tool_description: str, tool_params: dict) -> dict:
        """
        Build a complete OpenAI function schema with proper additionalProperties handling.
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

        return schema

    def _build_json_schema_for_param(self, param_name: str, param_info: dict) -> dict:
        """
        Build a proper JSON schema for a parameter that satisfies OpenAI's requirements.
        """
        param_type = param_info.get("type", "string")
        schema = {"type": param_type}

        # Add description if present
        if "description" in param_info:
            schema["description"] = param_info["description"]

        # Handle enum
        if "enum" in param_info:
            schema["enum"] = param_info["enum"]

        # Handle object types with properties
        if param_type == "object" and "properties" in param_info and isinstance(param_info["properties"], dict):
            properties = {}
            required = []

            for prop_name, prop_schema in param_info["properties"].items():
                properties[prop_name] = self._build_json_schema_for_param(prop_name, prop_schema)
                if prop_schema.get("required", False):
                    required.append(prop_name)

            schema["properties"] = properties
            schema["additionalProperties"] = False  # Required by OpenAI

            if required:
                schema["required"] = required
        elif param_type == "object":
            schema["additionalProperties"] = False

        # Handle arrays with items
        elif param_type == "array" and "items" in param_info:
            items_schema = param_info["items"]
            if isinstance(items_schema, dict):
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
            tool_func = self.create_frontend_tool(schema)
            self.registered_tools[tool_name] = tool_func
            logger.info(f"✓ Registered tool: {tool_name}")

        return list(self.registered_tools.values())

