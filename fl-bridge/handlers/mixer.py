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


# EQ band name mapping
EQ_BAND_NAMES = {0: 'Low', 1: 'Mid', 2: 'High'}


def _resolve_track_ref(track_ref):
    """
    Resolve track reference to index.
    Accepts: int (direct index) OR str (track name for lookup)
    Returns: int index or None if not found
    """
    if mixer is None:
        return None
    if isinstance(track_ref, int):
        return track_ref
    if isinstance(track_ref, str):
        track_ref_lower = track_ref.lower()
        for i in range(mixer.trackCount()):
            name = mixer.getTrackName(i).lower()
            if track_ref_lower == name or track_ref_lower in name:
                return i
    return None


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


# =============================================================================
# ROUTING HANDLERS (Phase 9)
# =============================================================================


def handle_mixer_get_routing(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get full routing table showing all active sends between mixer tracks.

    Args:
        params: {} (no required params)

    Returns:
        dict: {
            success: True,
            trackCount: int,
            routes: [{source, sourceName, destination, destName, level}]
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        track_count = mixer.trackCount()
        routes = []

        # Scan all track pairs for active routes
        # O(n^2) but necessary - FL Studio has ~127 tracks = ~16K checks
        for src in range(track_count):
            for dest in range(track_count):
                if src == dest:
                    continue  # Skip self-routing
                if mixer.getRouteSendActive(src, dest):
                    level = mixer.getRouteToLevel(src, dest)
                    routes.append({
                        'source': src,
                        'sourceName': mixer.getTrackName(src),
                        'destination': dest,
                        'destName': mixer.getTrackName(dest),
                        'level': level
                    })

        return {
            'success': True,
            'trackCount': track_count,
            'routes': routes
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_mixer_get_track_sends(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get sends for a specific mixer track.

    Args:
        params: {
            index (int, optional): Track index OR
            name (str, optional): Track name (case-insensitive, partial match)
            At least one of index or name required.
        }

    Returns:
        dict: {
            success: True,
            track: int,
            trackName: str,
            sends: [{destination, destName, level}]
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Get track reference (index or name)
        track_ref = params.get('index') if 'index' in params else params.get('name')
        if track_ref is None:
            return {'success': False, 'error': 'Missing required parameter: index or name'}

        # Resolve to index
        index = _resolve_track_ref(track_ref)
        if index is None:
            return {'success': False, 'error': f'Could not resolve track reference: {track_ref}'}

        # Validate index range
        error = _validate_track_index(index)
        if error:
            return {'success': False, 'error': error}

        track_count = mixer.trackCount()
        sends = []

        # Find all active sends from this track
        for dest in range(track_count):
            if dest == index:
                continue  # Skip self
            if mixer.getRouteSendActive(index, dest):
                level = mixer.getRouteToLevel(index, dest)
                sends.append({
                    'destination': dest,
                    'destName': mixer.getTrackName(dest),
                    'level': level
                })

        return {
            'success': True,
            'track': index,
            'trackName': mixer.getTrackName(index),
            'sends': sends
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_mixer_set_route(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create or remove a route between mixer tracks.

    Args:
        params: {
            source (int or str, required): Source track index or name
            destination (int or str, required): Destination track index or name
            enabled (bool, required): True to create route, False to remove
        }

    Returns:
        dict: {
            success: True,
            source: int,
            sourceName: str,
            destination: int,
            destName: str,
            active: bool (readback)
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Validate required params
        if 'source' not in params:
            return {'success': False, 'error': 'Missing required parameter: source'}
        if 'destination' not in params:
            return {'success': False, 'error': 'Missing required parameter: destination'}
        if 'enabled' not in params:
            return {'success': False, 'error': 'Missing required parameter: enabled'}

        # Resolve source and destination
        source = _resolve_track_ref(params['source'])
        if source is None:
            return {'success': False, 'error': f"Could not resolve source track: {params['source']}"}

        destination = _resolve_track_ref(params['destination'])
        if destination is None:
            return {'success': False, 'error': f"Could not resolve destination track: {params['destination']}"}

        # Validate both indices
        error = _validate_track_index(source)
        if error:
            return {'success': False, 'error': f'Source track error: {error}'}
        error = _validate_track_index(destination)
        if error:
            return {'success': False, 'error': f'Destination track error: {error}'}

        enabled = bool(params['enabled'])

        # Set route (True for UI update/afterRoutingChanged)
        mixer.setRouteTo(source, destination, 1 if enabled else 0, True)

        # Readback
        active = mixer.getRouteSendActive(source, destination)

        return {
            'success': True,
            'source': source,
            'sourceName': mixer.getTrackName(source),
            'destination': destination,
            'destName': mixer.getTrackName(destination),
            'active': active
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_mixer_set_route_level(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set send level for an existing route.

    Args:
        params: {
            source (int or str, required): Source track index or name
            destination (int or str, required): Destination track index or name
            level (float, required): Send level (0.0 to 1.0, where 0.8 = 0dB)
        }

    Returns:
        dict: {
            success: True,
            source: int,
            sourceName: str,
            destination: int,
            destName: str,
            level: float (readback)
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        # Validate required params
        if 'source' not in params:
            return {'success': False, 'error': 'Missing required parameter: source'}
        if 'destination' not in params:
            return {'success': False, 'error': 'Missing required parameter: destination'}
        if 'level' not in params:
            return {'success': False, 'error': 'Missing required parameter: level'}

        # Resolve source and destination
        source = _resolve_track_ref(params['source'])
        if source is None:
            return {'success': False, 'error': f"Could not resolve source track: {params['source']}"}

        destination = _resolve_track_ref(params['destination'])
        if destination is None:
            return {'success': False, 'error': f"Could not resolve destination track: {params['destination']}"}

        # Validate both indices
        error = _validate_track_index(source)
        if error:
            return {'success': False, 'error': f'Source track error: {error}'}
        error = _validate_track_index(destination)
        if error:
            return {'success': False, 'error': f'Destination track error: {error}'}

        level = float(params['level'])

        # Validate level range
        if level < 0.0 or level > 1.0:
            return {'success': False, 'error': f'Level {level} out of range (0.0 to 1.0)'}

        # CRITICAL: Check route exists first
        if not mixer.getRouteSendActive(source, destination):
            return {
                'success': False,
                'error': f'No route exists from track {source} to {destination}. Use set_route to create it first.'
            }

        # Set route level
        mixer.setRouteToLevel(source, destination, level)

        # Readback
        readback = mixer.getRouteToLevel(source, destination)

        return {
            'success': True,
            'source': source,
            'sourceName': mixer.getTrackName(source),
            'destination': destination,
            'destName': mixer.getTrackName(destination),
            'level': readback
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

# Routing handlers (Phase 9)
register_handler('mixer.get_routing', handle_mixer_get_routing)
register_handler('mixer.get_track_sends', handle_mixer_get_track_sends)
register_handler('mixer.set_route', handle_mixer_set_route)
register_handler('mixer.set_route_level', handle_mixer_set_route_level)
