"""
FL Bridge Pattern Handlers

Handles pattern manipulation commands: select, create, rename.

REGISTERED HANDLERS:
====================
- pattern.select: Select a pattern by index
- pattern.create: Create a new empty pattern
- pattern.rename: Rename a pattern

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any

# Import FL Studio patterns module
try:
    import patterns
except ImportError:
    # Running outside FL Studio
    patterns = None

# Import handler registration
from protocol.commands import register_handler


def handle_pattern_select(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Select a pattern by index.

    Args:
        params: {
            index: int (1-based pattern index, defaults to 1)
        }

    Returns:
        dict: {success: True, currentPattern: int}
    """
    try:
        if patterns is None:
            return {'success': False, 'error': 'Patterns module not available'}

        index = params.get('index', 1)

        # Validate index
        if not isinstance(index, int) or index < 1:
            return {'success': False, 'error': 'Invalid pattern index'}

        patterns.jumpToPattern(index)

        return {
            'success': True,
            'currentPattern': patterns.patternNumber()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_pattern_create(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new empty pattern.

    Finds the first empty pattern slot and selects it.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success: True, currentPattern: int}
    """
    try:
        if patterns is None:
            return {'success': False, 'error': 'Patterns module not available'}

        # Find first empty pattern slot starting from pattern 1
        patterns.findFirstNextEmptyPat(0)

        return {
            'success': True,
            'currentPattern': patterns.patternNumber()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_pattern_rename(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rename a pattern.

    Args:
        params: {
            index: int (optional, defaults to current pattern),
            name: str (new pattern name)
        }

    Returns:
        dict: {success: True, index: int, name: str}
    """
    try:
        if patterns is None:
            return {'success': False, 'error': 'Patterns module not available'}

        # Get pattern index (default to current)
        index = params.get('index', patterns.patternNumber())
        name = params.get('name', 'New Pattern')

        # Validate
        if not isinstance(index, int) or index < 1:
            return {'success': False, 'error': 'Invalid pattern index'}

        if not isinstance(name, str):
            return {'success': False, 'error': 'Invalid pattern name'}

        patterns.setPatternName(index, name)

        return {
            'success': True,
            'index': index,
            'name': name
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all pattern handlers
register_handler('pattern.select', handle_pattern_select)
register_handler('pattern.create', handle_pattern_create)
register_handler('pattern.rename', handle_pattern_rename)
