"""
FL Bridge Piano Roll Handlers

The MCP server (Node.js) writes note data directly into the
ComposeWithBridge.pyscript file. These handlers just open the
piano roll window and select the target channel.

REGISTERED HANDLERS:
====================
- pianoroll.addNotes: Open piano roll, select channel
- pianoroll.clearNotes: Open piano roll
- pianoroll.readState: Read state (placeholder)

AUTHOR: FL Studio MCP Project
"""

import json
import os
from typing import Dict, Any

try:
    import ui
except ImportError:
    ui = None

try:
    import channels
except ImportError:
    channels = None

from protocol.commands import register_handler

print("FL Bridge: Pianoroll handler loaded")


def handle_pianoroll_add_notes(params):
    """Open piano roll and select channel. Note data is written by the MCP server."""
    try:
        # Select target channel if specified
        channel = params.get('channel')
        if channel is not None and channels is not None:
            channels.selectOneChannel(channel)

        # Open piano roll window
        if ui is not None:
            ui.showWindow(3)  # widPianoRoll = 3

        note_count = len(params.get('notes', []))
        return {
            'success': True,
            'noteCount': note_count,
            'message': 'Piano roll opened. Notes embedded in ComposeWithBridge script. Run it from Piano Roll > Tools > Scripting to apply.',
            'triggerHint': 'Piano Roll > Tools > ComposeWithBridge'
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_pianoroll_clear_notes(params):
    """Open piano roll for clear action. Clear is embedded by the MCP server."""
    try:
        if ui is not None:
            ui.showWindow(3)

        return {
            'success': True,
            'message': 'Piano roll opened. Clear action embedded. Run ComposeWithBridge from Piano Roll > Tools > Scripting to apply.'
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_pianoroll_read_state(params):
    """Read piano roll state (placeholder)."""
    return {
        'success': False,
        'error': 'State reading not yet available.'
    }


register_handler('pianoroll.addNotes', handle_pianoroll_add_notes)
register_handler('pianoroll.clearNotes', handle_pianoroll_clear_notes)
register_handler('pianoroll.readState', handle_pianoroll_read_state)
