"""
FL Bridge Playlist Handlers

Handles playlist track management: query, mute, solo, rename, and color control.

REGISTERED HANDLERS:
====================
- playlist.get_tracks: Get all playlist tracks with name/color/mute/solo state
- playlist.mute: Mute/unmute playlist track (explicit, not toggle)
- playlist.solo: Solo/unsolo playlist track (explicit, not toggle)
- playlist.set_name: Set playlist track name
- playlist.set_color: Set playlist track color (BGR format)

IMPORTANT NOTES:
================
- Playlist tracks are 1-INDEXED (first track = 1, not 0)
  This differs from mixer tracks which are 0-indexed (0=Master)
- Color format is BGR (0x--BBGGRR), not RGB
- Mute/solo use explicit 1/0, NOT -1 (toggle mode)
- Empty name string resets track to default name

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any

# Import FL Studio modules
try:
    import playlist
    import midi
except ImportError:
    # Running outside FL Studio
    playlist = None
    midi = None

# Import handler registration
from protocol.commands import register_handler


def _validate_playlist_track(index: int) -> str | None:
    """
    Validate playlist track index is in valid range.

    CRITICAL: Playlist tracks are 1-indexed (first track = 1, not 0).

    Returns:
        None if valid, error message string if invalid.
    """
    if playlist is None:
        return 'Playlist module not available'

    track_count = playlist.trackCount()
    if index < 1 or index > track_count:
        return f'Track index {index} out of range (1 to {track_count})'

    return None


def handle_playlist_get_tracks(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get all playlist tracks with their properties.

    Args:
        params: {} (no required params)

    Returns:
        dict: {
            success: True,
            trackCount: int,
            tracks: [{index, name, color, muted, solo}]
        }
    """
    try:
        if playlist is None:
            return {'success': False, 'error': 'Playlist module not available'}

        track_count = playlist.trackCount()
        tracks = []

        # CRITICAL: Playlist tracks are 1-indexed (first track = 1)
        for i in range(1, track_count + 1):
            tracks.append({
                'index': i,
                'name': playlist.getTrackName(i),
                'color': playlist.getTrackColor(i),
                'muted': playlist.isTrackMuted(i),
                'solo': playlist.isTrackSolo(i)
            })

        return {
            'success': True,
            'trackCount': track_count,
            'tracks': tracks
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_playlist_mute(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mute or unmute a playlist track (explicit, not toggle).

    Args:
        params: {
            index (int, required): Playlist track index (1-indexed, first track = 1)
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
        if playlist is None:
            return {'success': False, 'error': 'Playlist module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'mute' not in params:
            return {'success': False, 'error': 'Missing required parameter: mute'}

        index = int(params['index'])
        mute = bool(params['mute'])

        # Validate index range (1-indexed)
        error = _validate_playlist_track(index)
        if error:
            return {'success': False, 'error': error}

        # CRITICAL: Use explicit 1 or 0, NOT -1 (toggle mode)
        # Per research: -1 toggles, 1/0 sets explicitly
        playlist.muteTrack(index, 1 if mute else 0)

        # Read back for confirmation
        readback = playlist.isTrackMuted(index)

        return {
            'success': True,
            'index': index,
            'muted': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_playlist_solo(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Solo or unsolo a playlist track (explicit, not toggle).

    Args:
        params: {
            index (int, required): Playlist track index (1-indexed, first track = 1)
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
        if playlist is None:
            return {'success': False, 'error': 'Playlist module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'solo' not in params:
            return {'success': False, 'error': 'Missing required parameter: solo'}

        index = int(params['index'])
        solo = bool(params['solo'])

        # Validate index range (1-indexed)
        error = _validate_playlist_track(index)
        if error:
            return {'success': False, 'error': error}

        # CRITICAL: Use explicit 1 or 0, NOT -1 (toggle mode)
        # Third param False = don't affect grouped tracks
        playlist.soloTrack(index, 1 if solo else 0, False)

        # Read back for confirmation
        readback = playlist.isTrackSolo(index)

        return {
            'success': True,
            'index': index,
            'soloed': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_playlist_set_name(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set playlist track name.

    Args:
        params: {
            index (int, required): Playlist track index (1-indexed, first track = 1)
            name (str, required): New track name (empty string resets to default)
        }

    Returns:
        dict: {
            success: True,
            index: int,
            name: str (readback value)
        }
    """
    try:
        if playlist is None:
            return {'success': False, 'error': 'Playlist module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'name' not in params:
            return {'success': False, 'error': 'Missing required parameter: name'}

        index = int(params['index'])
        name = str(params['name'])

        # Validate index range (1-indexed)
        error = _validate_playlist_track(index)
        if error:
            return {'success': False, 'error': error}

        # Set track name (empty string resets to default)
        playlist.setTrackName(index, name)

        # Read back for confirmation
        readback = playlist.getTrackName(index)

        return {
            'success': True,
            'index': index,
            'name': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_playlist_set_color(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set playlist track color.

    Args:
        params: {
            index (int, required): Playlist track index (1-indexed, first track = 1)
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
        if playlist is None:
            return {'success': False, 'error': 'Playlist module not available'}

        # Validate required params
        if 'index' not in params:
            return {'success': False, 'error': 'Missing required parameter: index'}
        if 'color' not in params:
            return {'success': False, 'error': 'Missing required parameter: color'}

        index = int(params['index'])
        color = int(params['color'])

        # Validate index range (1-indexed)
        error = _validate_playlist_track(index)
        if error:
            return {'success': False, 'error': error}

        # Set track color (BGR format)
        playlist.setTrackColor(index, color)

        # Read back for confirmation
        readback = playlist.getTrackColor(index)

        return {
            'success': True,
            'index': index,
            'color': readback
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all playlist handlers
register_handler('playlist.get_tracks', handle_playlist_get_tracks)
register_handler('playlist.mute', handle_playlist_mute)
register_handler('playlist.solo', handle_playlist_solo)
register_handler('playlist.set_name', handle_playlist_set_name)
register_handler('playlist.set_color', handle_playlist_set_color)
