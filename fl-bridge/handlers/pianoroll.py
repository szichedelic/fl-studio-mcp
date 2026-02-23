"""
FL Bridge Piano Roll Handlers

Handles piano roll note manipulation commands via JSON file-based IPC.
The FL Bridge writes note data to a shared JSON file, and a companion
Piano Roll Script (.pyscript) reads it to create notes via flpianoroll.

REGISTERED HANDLERS:
====================
- pianoroll.addNotes: Write note data to staging file for piano roll script
- pianoroll.clearNotes: Write clear action to staging file
- pianoroll.readState: Read current piano roll state from exported JSON

DATA FLOW:
==========
1. MCP server sends note data via SysEx to FL Bridge
2. FL Bridge handler writes note_request.json to shared directory
3. User triggers ComposeWithBridge.pyscript from Piano Roll menu
4. Piano roll script reads JSON, creates notes, exports state
5. FL Bridge can read exported state via pianoroll.readState

AUTHOR: FL Studio MCP Project
"""

import json
import os
from typing import Dict, Any

# Import FL Studio modules (with fallback for running outside FL Studio)
try:
    import ui
except ImportError:
    ui = None

try:
    import channels
except ImportError:
    channels = None

# Import handler registration
from protocol.commands import register_handler

# Shared data directory for JSON IPC between FL Bridge and .pyscript
SHARED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shared')


def handle_pianoroll_add_notes(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Write note data to staging file for the piano roll script to consume.

    Args:
        params: {
            notes: list of {midi, time, duration, velocity, pan?, color?}
                - midi: int (0-127, MIDI note number)
                - time: float (start time in quarter notes / beats)
                - duration: float (length in quarter notes / beats)
                - velocity: float (0.0-1.0, default 0.78)
                - pan: float (0.0-1.0, default 0.5 center)
                - color: int (0-15, FL Studio note color, default 0)
            channel: int (optional, channel index to target)
            clearFirst: bool (optional, clear existing notes before adding)
        }

    Returns:
        dict: {success, noteCount, message, triggerHint}
    """
    try:
        notes = params.get('notes', [])
        if not notes:
            return {'success': False, 'error': 'No notes provided'}

        clear_first = params.get('clearFirst', False)

        # Ensure shared directory exists
        os.makedirs(SHARED_DIR, exist_ok=True)

        # Build request JSON
        request = {
            'action': 'add_notes',
            'clearFirst': clear_first,
            'notes': notes
        }

        # Write to staging file
        request_path = os.path.join(SHARED_DIR, 'note_request.json')
        with open(request_path, 'w') as f:
            json.dump(request, f, indent=2)

        # Select target channel if specified
        channel = params.get('channel')
        if channel is not None and channels is not None:
            channels.selectOneChannel(channel)

        # Open piano roll window
        if ui is not None:
            ui.showWindow(3)  # widPianoRoll = 3

        return {
            'success': True,
            'noteCount': len(notes),
            'message': 'Notes written to staging file. Trigger ComposeWithBridge script in Piano Roll to apply.',
            'triggerHint': 'Piano Roll menu > Tools > Scripting > ComposeWithBridge'
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_pianoroll_clear_notes(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Write a clear action to the staging file for the piano roll script.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success, message}
    """
    try:
        # Ensure shared directory exists
        os.makedirs(SHARED_DIR, exist_ok=True)

        # Write clear request
        request = {
            'action': 'clear'
        }

        request_path = os.path.join(SHARED_DIR, 'note_request.json')
        with open(request_path, 'w') as f:
            json.dump(request, f, indent=2)

        # Open piano roll window
        if ui is not None:
            ui.showWindow(3)  # widPianoRoll = 3

        return {
            'success': True,
            'message': 'Clear request staged. Trigger ComposeWithBridge script to apply.'
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_pianoroll_read_state(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Read the current piano roll state exported by the .pyscript.

    The ComposeWithBridge.pyscript exports piano_roll_state.json after
    applying notes. This handler reads that state for the MCP server.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success, ppq, noteCount, notes, tsnum, tsden} or error
    """
    try:
        state_path = os.path.join(SHARED_DIR, 'piano_roll_state.json')

        if not os.path.exists(state_path):
            return {
                'success': False,
                'error': 'No piano roll state available. Run ComposeWithBridge script first.'
            }

        with open(state_path, 'r') as f:
            state = json.load(f)

        return {'success': True, **state}

    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all piano roll handlers
register_handler('pianoroll.addNotes', handle_pianoroll_add_notes)
register_handler('pianoroll.clearNotes', handle_pianoroll_clear_notes)
register_handler('pianoroll.readState', handle_pianoroll_read_state)
