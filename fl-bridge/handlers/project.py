"""
FL Bridge Project Handlers

Handles project-level commands: tempo get/set and playback position get/set.

REGISTERED HANDLERS:
====================
- project.get_tempo: Get current project tempo in BPM
- project.set_tempo: Set project tempo (10-999 BPM)
- project.get_position: Get playback position in multiple formats
- project.set_position: Jump to playback position (by bars, ticks, ms, seconds)
- project.undo: Undo last operation
- project.redo: Redo last undone operation

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any

# Import FL Studio modules
try:
    import mixer
except ImportError:
    mixer = None

try:
    import transport
except ImportError:
    transport = None

try:
    import general
except ImportError:
    general = None

try:
    import midi
except ImportError:
    midi = None

# Import handler registration
from protocol.commands import register_handler


def handle_project_get_tempo(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get current project tempo.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success: True, tempo: float, bpm: int}
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        tempo = mixer.getCurrentTempo()
        return {
            'success': True,
            'tempo': tempo,
            'bpm': int(round(tempo))
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_project_set_tempo(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set project tempo.

    Args:
        params: {bpm: float} - Tempo in BPM (10-999)

    Returns:
        dict: {success: True, tempo: float, requested: float}
    """
    try:
        if general is None or midi is None or mixer is None:
            return {'success': False, 'error': 'Required modules not available'}

        bpm = float(params.get('bpm', 120))

        # Validate range (FL Studio supports ~10-999 BPM)
        if bpm < 10 or bpm > 999:
            return {'success': False, 'error': f'BPM {bpm} out of range (10-999)'}

        # CRITICAL: Multiply by 1000 for processRECEvent (120 BPM = 120000)
        tempo_value = int(bpm * 1000)

        # Use REC_Control | REC_UpdateControl to set value and update UI
        flags = midi.REC_Control | midi.REC_UpdateControl
        general.processRECEvent(midi.REC_Tempo, tempo_value, flags)

        # Read back to confirm
        readback = mixer.getCurrentTempo()

        return {
            'success': True,
            'tempo': readback,
            'requested': bpm
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_project_get_position(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get current playback position in multiple formats.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {
            success: True,
            bars: int (bar number),
            steps: int (steps component),
            ticks: int (ticks component),
            absoluteTicks: int (total ticks from start),
            milliseconds: int (total ms from start),
            fractional: float (0.0-1.0 through song),
            hint: str (B:S:T formatted string)
        }
    """
    try:
        if transport is None:
            return {'success': False, 'error': 'Transport module not available'}

        return {
            'success': True,
            'bars': transport.getSongPos(3),        # Bars component
            'steps': transport.getSongPos(4),       # Steps component
            'ticks': transport.getSongPos(5),       # Ticks component
            'absoluteTicks': transport.getSongPos(2),  # Absolute ticks
            'milliseconds': transport.getSongPos(0),   # Milliseconds
            'fractional': transport.getSongPos(-1),    # Fractional (0.0-1.0)
            'hint': transport.getSongPosHint()         # B:S:T formatted string
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_project_set_position(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Jump to playback position.

    Accepts ONE of these position formats:
    - bars: Bar number (1-indexed)
    - ticks: Absolute tick position
    - ms: Position in milliseconds
    - seconds: Position in seconds
    - fractional: Position as 0.0-1.0 through song

    Args:
        params: {bars?: int, ticks?: int, ms?: int, seconds?: int, fractional?: float}

    Returns:
        dict: {success: True, bars: int, steps: int, ticks: int, hint: str}
    """
    try:
        if transport is None or general is None:
            return {'success': False, 'error': 'Required modules not available'}

        # Support multiple input formats
        if 'bars' in params:
            # Convert bars to absolute ticks
            # ticks = (bars - 1) * PPQ * beats_per_bar
            ppq = general.getRecPPQ()
            bars = int(params['bars'])
            # Assuming 4/4 time (4 beats per bar)
            # bars are 1-indexed (bar 1 = tick 0)
            abs_ticks = (bars - 1) * ppq * 4
            transport.setSongPos(abs_ticks, 2)  # Mode 2 = absolute ticks
        elif 'ticks' in params:
            transport.setSongPos(int(params['ticks']), 2)  # Mode 2 = absolute ticks
        elif 'ms' in params:
            transport.setSongPos(int(params['ms']), 0)  # Mode 0 = milliseconds
        elif 'seconds' in params:
            transport.setSongPos(int(params['seconds']), 1)  # Mode 1 = seconds
        elif 'fractional' in params:
            transport.setSongPos(float(params['fractional']), -1)  # Mode -1 = fractional
        else:
            return {
                'success': False,
                'error': 'No position specified. Use bars, ticks, ms, seconds, or fractional.'
            }

        # Read back position
        return {
            'success': True,
            'bars': transport.getSongPos(3),
            'steps': transport.getSongPos(4),
            'ticks': transport.getSongPos(5),
            'hint': transport.getSongPosHint()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_project_undo(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Undo the last operation.

    Uses general.undoUp() - NOT general.undo() which toggles unpredictably.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success: True, action: 'undo', result: int}
    """
    try:
        if general is None:
            return {'success': False, 'error': 'General module not available'}

        result = general.undoUp()
        return {
            'success': True,
            'action': 'undo',
            'result': result
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_project_redo(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Redo the last undone operation.

    Uses general.undoDown() - NOT general.undo() which toggles unpredictably.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {success: True, action: 'redo', result: int}
    """
    try:
        if general is None:
            return {'success': False, 'error': 'General module not available'}

        result = general.undoDown()
        return {
            'success': True,
            'action': 'redo',
            'result': result
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all project handlers
register_handler('project.get_tempo', handle_project_get_tempo)
register_handler('project.set_tempo', handle_project_set_tempo)
register_handler('project.get_position', handle_project_get_position)
register_handler('project.set_position', handle_project_set_position)
register_handler('project.undo', handle_project_undo)
register_handler('project.redo', handle_project_redo)
