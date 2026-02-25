"""
FL Bridge Mixer Handlers

Handles mixer track mutations: volume, pan, mute, solo, name, color.

REGISTERED HANDLERS:
====================
- mixer.set_volume: Set mixer track volume (0.0-1.0, where 0.8 = 0dB)
- mixer.set_pan: Set mixer track pan (-1.0 to 1.0)
- mixer.mute: Mute/unmute mixer track (explicit, not toggle)
- mixer.solo: Solo/unsolo mixer track (explicit, not toggle)
- mixer.set_name: Set mixer track name
- mixer.set_color: Set mixer track color (BGR format)

IMPORTANT NOTES:
================
- Volume 0.8 = unity gain (0dB), not 1.0
- Color format is BGR (0x--BBGGRR), not RGB
- Mute/solo use explicit 1/0, NOT -1 (toggle mode)
- Index 0 = Master track, 1+ = insert tracks

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any

# Import FL Studio modules
try:
    import mixer
    import midi
except ImportError:
    # Running outside FL Studio
    mixer = None
    midi = None

# Import handler registration
from protocol.commands import register_handler


def _validate_track_index(index: int) -> str | None:
    """
    Validate mixer track index is in valid range.

    Returns:
        None if valid, error message string if invalid.
    """
    if mixer is None:
        return 'Mixer module not available'

    track_count = mixer.trackCount()
    if index < 0 or index >= track_count:
        return f'Track index {index} out of range (0 to {track_count - 1})'

    return None


def handle_mixer_set_volume(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set mixer track volume.

    Args:
        params: {
            index (int, required): Mixer track index (0=Master, 1+=inserts)
            volume (float, required): Volume level (0.0 to 1.0, where 0.8 = 0dB)
        }

    Returns:
        dict: {
            success: True,
            index: int,
            volume: float (readback value)
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'volume' not in params:
            return {'success': False, 'error': 'Missing required parameter: volume'}

        index = int(params['index'])
        volume = float(params['volume'])

        # Validate index range
        error = _validate_track_index(index)
        if error:
            return {'success': False, 'error': error}

        # Validate volume range
        if volume < 0.0 or volume > 1.0:
            return {'success': False, 'error': f'Volume {volume} out of range (0.0 to 1.0)'}

        # Set volume with immediate pickup mode (PIM_None = 0)
        pickup_mode = midi.PIM_None if midi else 0
        mixer.setTrackVolume(index, volume, pickup_mode)

        # Read back for confirmation
        readback = mixer.getTrackVolume(index)

        return {
            'success': True,
            'index': index,
            'volume': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_mixer_set_pan(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set mixer track pan.

    Args:
        params: {
            index (int, required): Mixer track index (0=Master, 1+=inserts)
            pan (float, required): Pan position (-1.0 = left, 0.0 = center, 1.0 = right)
        }

    Returns:
        dict: {
            success: True,
            index: int,
            pan: float (readback value)
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'pan' not in params:
            return {'success': False, 'error': 'Missing required parameter: pan'}

        index = int(params['index'])
        pan = float(params['pan'])

        # Validate index range
        error = _validate_track_index(index)
        if error:
            return {'success': False, 'error': error}

        # Validate pan range
        if pan < -1.0 or pan > 1.0:
            return {'success': False, 'error': f'Pan {pan} out of range (-1.0 to 1.0)'}

        # Set pan with immediate pickup mode (PIM_None = 0)
        pickup_mode = midi.PIM_None if midi else 0
        mixer.setTrackPan(index, pan, pickup_mode)

        # Read back for confirmation
        readback = mixer.getTrackPan(index)

        return {
            'success': True,
            'index': index,
            'pan': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_mixer_mute(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mute or unmute a mixer track (explicit, not toggle).

    Args:
        params: {
            index (int, required): Mixer track index (0=Master, 1+=inserts)
            mute (bool, required): True to mute, False to unmute
        }

    Returns:
        dict: {
            success: True,
            index: int,
            muted: bool (readback state)
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'mute' not in params:
            return {'success': False, 'error': 'Missing required parameter: mute'}

        index = int(params['index'])
        mute = bool(params['mute'])

        # Validate index range
        error = _validate_track_index(index)
        if error:
            return {'success': False, 'error': error}

        # CRITICAL: Use explicit 1 or 0, NOT -1 (toggle mode)
        # Per research pitfall #4: -1 toggles, 1/0 sets explicitly
        mixer.muteTrack(index, 1 if mute else 0)

        # Read back for confirmation
        readback = mixer.isTrackMuted(index)

        return {
            'success': True,
            'index': index,
            'muted': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_mixer_solo(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Solo or unsolo a mixer track (explicit, not toggle).

    Args:
        params: {
            index (int, required): Mixer track index (0=Master, 1+=inserts)
            solo (bool, required): True to solo, False to unsolo
        }

    Returns:
        dict: {
            success: True,
            index: int,
            soloed: bool (readback state)
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'solo' not in params:
            return {'success': False, 'error': 'Missing required parameter: solo'}

        index = int(params['index'])
        solo = bool(params['solo'])

        # Validate index range
        error = _validate_track_index(index)
        if error:
            return {'success': False, 'error': error}

        # CRITICAL: Use explicit 1 or 0, NOT -1 (toggle mode)
        # Per research pitfall #4: -1 toggles, 1/0 sets explicitly
        mixer.soloTrack(index, 1 if solo else 0)

        # Read back for confirmation
        readback = mixer.isTrackSolo(index)

        return {
            'success': True,
            'index': index,
            'soloed': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_mixer_set_name(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set mixer track name.

    Args:
        params: {
            index (int, required): Mixer track index (0=Master, 1+=inserts)
            name (str, required): New track name
        }

    Returns:
        dict: {
            success: True,
            index: int,
            name: str (readback value)
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'name' not in params:
            return {'success': False, 'error': 'Missing required parameter: name'}

        index = int(params['index'])
        name = str(params['name'])

        # Validate index range
        error = _validate_track_index(index)
        if error:
            return {'success': False, 'error': error}

        # Set track name
        mixer.setTrackName(index, name)

        # Read back for confirmation
        readback = mixer.getTrackName(index)

        return {
            'success': True,
            'index': index,
            'name': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_mixer_set_color(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set mixer track color.

    Args:
        params: {
            index (int, required): Mixer track index (0=Master, 1+=inserts)
            color (int, required): Color in BGR format (0x--BBGGRR)
        }

    Returns:
        dict: {
            success: True,
            index: int,
            color: int (readback value in BGR format)
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'color' not in params:
            return {'success': False, 'error': 'Missing required parameter: color'}

        index = int(params['index'])
        color = int(params['color'])

        # Validate index range
        error = _validate_track_index(index)
        if error:
            return {'success': False, 'error': error}

        # Set track color (BGR format)
        mixer.setTrackColor(index, color)

        # Read back for confirmation
        readback = mixer.getTrackColor(index)

        return {
            'success': True,
            'index': index,
            'color': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all mixer handlers
register_handler('mixer.set_volume', handle_mixer_set_volume)
register_handler('mixer.set_pan', handle_mixer_set_pan)
register_handler('mixer.mute', handle_mixer_mute)
register_handler('mixer.solo', handle_mixer_solo)
register_handler('mixer.set_name', handle_mixer_set_name)
register_handler('mixer.set_color', handle_mixer_set_color)
