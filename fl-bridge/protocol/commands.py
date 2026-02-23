"""
FL Bridge Command Routing

This module handles command routing and response building for FL Bridge.
Command handlers register themselves here, and execute_command routes
incoming commands to the appropriate handler.

HANDLER REGISTRATION:
=====================
Handlers are registered by action name. The action follows a namespace
convention: "module.action" (e.g., "transport.start", "patterns.list").

Example:
    from protocol.commands import register_handler

    def handle_transport_start(params):
        import transport
        transport.start()
        return {'success': True, 'playing': transport.isPlaying()}

    register_handler('transport.start', handle_transport_start)

HANDLER SIGNATURE:
==================
All handlers must follow this signature:
    def handler(params: dict) -> dict

- params: Dictionary of parameters from the command
- returns: Dictionary with at least 'success' (bool) key

ERROR HANDLING:
===============
If a handler raises an exception, execute_command catches it and returns
an error response. Handlers should catch expected errors and return
appropriate error responses.

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any, Callable, Optional

# ============================================================================
# HANDLER REGISTRY
# ============================================================================

# Registry of command handlers
# Key: action string (e.g., 'transport.start')
# Value: handler function
_handlers: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {}


# ============================================================================
# PUBLIC FUNCTIONS
# ============================================================================

def register_handler(action: str, handler: Callable[[Dict[str, Any]], Dict[str, Any]]) -> None:
    """
    Register a handler for a command action.

    Args:
        action: The action string to handle (e.g., 'transport.start')
        handler: The handler function

    Example:
        >>> def my_handler(params):
        ...     return {'success': True, 'result': 'done'}
        >>> register_handler('my.action', my_handler)
    """
    _handlers[action] = handler


def unregister_handler(action: str) -> bool:
    """
    Unregister a handler for an action.

    Args:
        action: The action string to unregister

    Returns:
        bool: True if handler was found and removed, False otherwise
    """
    if action in _handlers:
        del _handlers[action]
        return True
    return False


def get_handler(action: str) -> Optional[Callable[[Dict[str, Any]], Dict[str, Any]]]:
    """
    Get the handler for an action.

    Args:
        action: The action string

    Returns:
        The handler function or None if not found
    """
    return _handlers.get(action)


def list_handlers() -> list:
    """
    List all registered action names.

    Returns:
        list: List of registered action strings
    """
    return list(_handlers.keys())


def execute_command(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a parsed command and return the result.

    Args:
        parsed: Parsed command dictionary from sysex.parse_sysex()
            Expected structure:
            {
                'client_id': int,
                'command': {
                    'action': str,
                    'params': dict (optional)
                }
            }
            OR
            {
                'client_id': int,
                'error': str
            }

    Returns:
        dict: Result dictionary with at least 'success' key
            On success: {'success': True, ...result data}
            On error: {'success': False, 'error': str}

    Example:
        >>> parsed = {'client_id': 1, 'command': {'action': 'transport.start', 'params': {}}}
        >>> result = execute_command(parsed)
        >>> print(result)
        {'success': True, 'playing': True}
    """
    try:
        # Check for parse errors
        if 'error' in parsed:
            return {
                'success': False,
                'error': parsed['error']
            }

        # Extract command info
        command = parsed.get('command', {})
        action = command.get('action')
        params = command.get('params', {})

        # Validate action exists
        if not action:
            return {
                'success': False,
                'error': 'No action specified in command'
            }

        # Look up handler
        handler = _handlers.get(action)

        if handler is None:
            return {
                'success': False,
                'error': f'Unknown action: {action}'
            }

        # Execute handler
        result = handler(params)

        # Ensure result has success key
        if isinstance(result, dict):
            if 'success' not in result:
                result['success'] = True
            return result
        else:
            # Handler returned non-dict, wrap it
            return {
                'success': True,
                'result': result
            }

    except Exception as e:
        # Catch any exception from handler execution
        return {
            'success': False,
            'error': f'Handler error: {e}'
        }


def build_response(client_id: int, result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Package a result with client_id for response building.

    This is a convenience function for handlers that need to build
    responses with correlation IDs.

    Args:
        client_id: Client correlation ID from the original command
        result: Result dictionary from handler

    Returns:
        dict: Response dictionary with client_id and response
    """
    return {
        'client_id': client_id,
        'response': result
    }


# ============================================================================
# BUILT-IN HANDLERS
# ============================================================================

def _handle_ping(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle ping command for connection testing.

    Returns:
        dict: Pong response with timestamp
    """
    import time
    return {
        'success': True,
        'pong': True,
        'timestamp': time.time()
    }


def _handle_list_handlers(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle request to list all registered handlers.

    Returns:
        dict: List of registered action names
    """
    return {
        'success': True,
        'handlers': list_handlers()
    }


def _handle_echo(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Echo back the parameters (for testing).

    Returns:
        dict: Echo of input parameters
    """
    return {
        'success': True,
        'echo': params
    }


# Register built-in handlers
register_handler('system.ping', _handle_ping)
register_handler('system.list_handlers', _handle_list_handlers)
register_handler('system.echo', _handle_echo)
