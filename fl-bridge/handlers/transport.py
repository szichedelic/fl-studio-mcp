"""
FL Bridge Transport Handlers

Handles transport control commands: play, stop, record, and state queries.

REGISTERED HANDLERS:
====================
- transport.start: Start playback
- transport.stop: Stop playback
- transport.record: Toggle recording
- transport.state: Get current transport state

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any

# Import FL Studio transport module
try:
    import transport
except ImportError:
    # Running outside FL Studio
    transport = None

# Import handler registration
from protocol.commands import register_handler


def handle_transport_start(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Start playback in FL Studio.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success: True, playing: bool}
    """
    try:
        if transport is None:
            return {'success': False, 'error': 'Transport module not available'}

        transport.start()
        return {
            'success': True,
            'playing': transport.isPlaying()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_transport_stop(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stop playback in FL Studio.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success: True, playing: False}
    """
    try:
        if transport is None:
            return {'success': False, 'error': 'Transport module not available'}

        transport.stop()
        return {
            'success': True,
            'playing': False
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_transport_record(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Toggle recording in FL Studio.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success: True, recording: bool}
    """
    try:
        if transport is None:
            return {'success': False, 'error': 'Transport module not available'}

        transport.record()
        return {
            'success': True,
            'recording': transport.isRecording()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_transport_state(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get current transport state.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {
            success: True,
            playing: bool,
            recording: bool,
            songPosition: str (Bars:Steps:Ticks format),
            loopMode: int
        }
    """
    try:
        if transport is None:
            return {'success': False, 'error': 'Transport module not available'}

        return {
            'success': True,
            'playing': transport.isPlaying(),
            'recording': transport.isRecording(),
            'songPosition': transport.getSongPos(4),  # MIDI_SONGPOS_ABSTICKS
            'loopMode': transport.getLoopMode()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all transport handlers
register_handler('transport.start', handle_transport_start)
register_handler('transport.stop', handle_transport_stop)
register_handler('transport.record', handle_transport_record)
register_handler('transport.state', handle_transport_state)
