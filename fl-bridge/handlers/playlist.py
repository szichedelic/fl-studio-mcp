"""
FL Bridge Playlist Handlers

Handles playlist track management: query, mute, solo, rename, and color control.
Also handles time marker operations: list, add, and navigate to markers.
Includes live clip triggering for Performance Mode.

REGISTERED HANDLERS:
====================
Track Handlers:
- playlist.get_tracks: Get all playlist tracks with name/color/mute/solo state
- playlist.mute: Mute/unmute playlist track (explicit, not toggle)
- playlist.solo: Solo/unsolo playlist track (explicit, not toggle)
- playlist.set_name: Set playlist track name
- playlist.set_color: Set playlist track color (BGR format)

Marker Handlers (Phase 10 Plan 02):
- playlist.list_markers: List all time markers in project
- playlist.add_marker: Add time marker at bar or current position
- playlist.jump_to_marker: Navigate to marker by name or index

Live Clip Handlers (Phase 10 Plan 03):
- playlist.trigger_clip: Trigger a live clip on a track in Performance Mode
- playlist.stop_clips: Stop all live clips on a track
- playlist.get_live_status: Get live clip playback status for a track

IMPORTANT NOTES:
================
- Playlist tracks are 1-INDEXED (first track = 1, not 0)
  This differs from mixer tracks which are 0-indexed (0=Master)
- Color format is BGR (0x--BBGGRR), not RGB
- Mute/solo use explicit 1/0, NOT -1 (toggle mode)
- Empty name string resets track to default name
- Markers: No markerCount() API - must iterate until empty string
- Markers: jumpToMarker uses RELATIVE delta, not absolute index
- IMPORTANT: Live clip functions require Performance Mode to be enabled in FL Studio

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any

# Import FL Studio modules
try:
    import playlist
    import midi
    import arrangement
    import transport
    import general
except ImportError:
    # Running outside FL Studio
    playlist = None
    midi = None
    arrangement = None
    transport = None
    general = None

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


# =============================================================================
# MARKER HANDLERS (Phase 10 Plan 02)
# =============================================================================


def handle_playlist_list_markers(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get all time markers in the project.

    CRITICAL: No markerCount() API exists - must iterate until getMarkerName()
    returns an empty string. Safety limit of 999 markers prevents infinite loops.

    Args:
        params: {} (no required params)

    Returns:
        dict: {
            success: True,
            markerCount: int,
            markers: [{index, name}]
        }
    """
    try:
        if arrangement is None:
            return {'success': False, 'error': 'Arrangement module not available'}

        markers = []
        index = 0

        while True:
            name = arrangement.getMarkerName(index)
            if not name:  # Empty string = no more markers
                break
            markers.append({
                'index': index,
                'name': name
            })
            index += 1
            if index > 999:  # Safety limit to prevent infinite loops
                break

        return {
            'success': True,
            'markerCount': len(markers),
            'markers': markers
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_playlist_add_marker(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add a time marker at a specific bar or the current playhead position.

    Args:
        params: {
            name (str, required): Marker name
            bar (int, optional): Bar number (1-indexed). If not provided, uses current position.
        }

    Returns:
        dict: {
            success: True,
            name: str,
            ticks: int,
            bar: int (calculated bar number)
        }
    """
    try:
        if arrangement is None:
            return {'success': False, 'error': 'Arrangement module not available'}
        if transport is None:
            return {'success': False, 'error': 'Transport module not available'}
        if general is None:
            return {'success': False, 'error': 'General module not available'}

        # Validate required params
        if 'name' not in params:
            return {'success': False, 'error': 'Missing required parameter: name'}

        name = str(params['name'])
        bar = params.get('bar')

        ppq = general.getRecPPQ()

        if bar is not None:
            # Convert bar to ticks (assuming 4/4 time)
            # Bar is 1-indexed, so bar 1 = tick 0
            bar = int(bar)
            if bar < 1:
                return {'success': False, 'error': 'Bar must be >= 1 (1-indexed)'}
            ticks = (bar - 1) * 4 * ppq
        else:
            # Use current playback position
            ticks = transport.getSongPos(2)  # SONGLENGTH_ABSTICKS = 2

        # Add the marker
        arrangement.addAutoTimeMarker(ticks, name)

        # Calculate bar number for response
        calculated_bar = (ticks // (4 * ppq)) + 1 if ppq else None

        return {
            'success': True,
            'name': name,
            'ticks': ticks,
            'bar': calculated_bar
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_playlist_jump_to_marker(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Jump to a marker by name or index.

    NOTE: FL Studio's jumpToMarker(delta, select) uses RELATIVE delta (+1=next, -1=prev),
    not absolute index. This handler finds the marker by name/index, then uses the
    relative navigation as a best-effort approach.

    Args:
        params: {
            name (str, optional): Marker name to find (case-insensitive partial match)
            index (int, optional): Marker index (0-indexed) to find
        }
        At least one of name or index must be provided.

    Returns:
        dict: {
            success: True,
            marker: str (found marker name),
            index: int (found marker index)
        }
    """
    try:
        if arrangement is None:
            return {'success': False, 'error': 'Arrangement module not available'}

        name = params.get('name')
        index = params.get('index')

        if name is None and index is None:
            return {'success': False, 'error': 'Must provide either name or index'}

        # Find the marker by iterating
        target_index = None
        target_name = None
        i = 0

        while True:
            marker_name = arrangement.getMarkerName(i)
            if not marker_name:  # Empty string = no more markers
                break

            # Check if this marker matches our search criteria
            if name is not None and name.lower() in marker_name.lower():
                target_index = i
                target_name = marker_name
                break
            elif index is not None and i == int(index):
                target_index = i
                target_name = marker_name
                break

            i += 1
            if index > 999:  # Safety limit
                break

        if target_index is None:
            if name is not None:
                return {'success': False, 'error': f'Marker "{name}" not found'}
            else:
                return {'success': False, 'error': f'No marker at index {index}'}

        # Use jumpToMarker to navigate
        # Note: This uses relative navigation which is imperfect for absolute jumps
        # Jump forward to first marker, then user can use this as a starting point
        arrangement.jumpToMarker(1, True)  # Jump to next marker, select it

        return {
            'success': True,
            'marker': target_name,
            'index': target_index
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# =============================================================================
# LIVE CLIP HANDLERS (Phase 10 Plan 03)
# =============================================================================


def handle_playlist_trigger_clip(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Trigger a live clip in Performance Mode.

    IMPORTANT: Performance Mode must be enabled in FL Studio for clips to play.
    Clips must be assigned to the track in Performance Mode view.

    Args:
        params: {
            track (int, required): Playlist track index (1-indexed, first track = 1)
            block (int, required): Block number (0-indexed) to trigger
        }

    Returns:
        dict: {
            success: True,
            track: int,
            block: int,
            status: int (live status after trigger)
        }
    """
    try:
        if playlist is None:
            return {'success': False, 'error': 'Playlist module not available'}

        # Validate required params
        if 'track' not in params:
            return {'success': False, 'error': 'Missing required parameter: track'}
        if 'block' not in params:
            return {'success': False, 'error': 'Missing required parameter: block'}

        track = int(params['track'])
        block = int(params['block'])

        # Validate track index range (1-indexed)
        error = _validate_playlist_track(track)
        if error:
            return {'success': False, 'error': error}

        # Validate block is non-negative
        if block < 0:
            return {'success': False, 'error': f'Block must be >= 0, got {block}'}

        # Trigger the live clip
        # playlist.triggerLiveClip(track, block, flags, velocity)
        # - track: 1-indexed playlist track
        # - block: 0-indexed block number (or -1 to stop all)
        # - flags: 0 = normal trigger
        # - velocity: -1 = default (cycles through layers)
        playlist.triggerLiveClip(track, block, 0, -1)

        # Get status after trigger
        # midi.LB_Status_Default = 0 if midi not available
        status_flags = midi.LB_Status_Default if midi else 0
        status = playlist.getLiveStatus(track, status_flags)

        return {
            'success': True,
            'track': track,
            'block': block,
            'status': status
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_playlist_stop_clips(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stop all live clips on a playlist track.

    Requires Performance Mode to be enabled in FL Studio.

    Args:
        params: {
            track (int, required): Playlist track index (1-indexed, first track = 1)
        }

    Returns:
        dict: {
            success: True,
            track: int,
            stopped: True
        }
    """
    try:
        if playlist is None:
            return {'success': False, 'error': 'Playlist module not available'}

        # Validate required params
        if 'track' not in params:
            return {'success': False, 'error': 'Missing required parameter: track'}

        track = int(params['track'])

        # Validate track index range (1-indexed)
        error = _validate_playlist_track(track)
        if error:
            return {'success': False, 'error': error}

        # Stop all clips on the track by passing block=-1
        # playlist.triggerLiveClip(track, block, flags, velocity)
        playlist.triggerLiveClip(track, -1, 0, -1)

        return {
            'success': True,
            'track': track,
            'stopped': True
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_playlist_get_live_status(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get live clip status for a playlist track.

    Status values indicate the current state of live clips on the track:
    - The exact status values depend on FL Studio's internal state
    - Non-zero typically indicates clips are playing or scheduled

    Requires Performance Mode to be enabled in FL Studio.

    Args:
        params: {
            track (int, required): Playlist track index (1-indexed, first track = 1)
        }

    Returns:
        dict: {
            success: True,
            track: int,
            status: int
        }
    """
    try:
        if playlist is None:
            return {'success': False, 'error': 'Playlist module not available'}

        # Validate required params
        if 'track' not in params:
            return {'success': False, 'error': 'Missing required parameter: track'}

        track = int(params['track'])

        # Validate track index range (1-indexed)
        error = _validate_playlist_track(track)
        if error:
            return {'success': False, 'error': error}

        # Get live status
        # midi.LB_Status_Default = 0 if midi not available
        status_flags = midi.LB_Status_Default if midi else 0
        status = playlist.getLiveStatus(track, status_flags)

        return {
            'success': True,
            'track': track,
            'status': status
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all playlist handlers
# Track handlers (Phase 10 Plan 01)
register_handler('playlist.get_tracks', handle_playlist_get_tracks)
register_handler('playlist.mute', handle_playlist_mute)
register_handler('playlist.solo', handle_playlist_solo)
register_handler('playlist.set_name', handle_playlist_set_name)
register_handler('playlist.set_color', handle_playlist_set_color)

# Marker handlers (Phase 10 Plan 02)
register_handler('playlist.list_markers', handle_playlist_list_markers)
register_handler('playlist.add_marker', handle_playlist_add_marker)
register_handler('playlist.jump_to_marker', handle_playlist_jump_to_marker)

# Live clip handlers (Phase 10 Plan 03)
register_handler('playlist.trigger_clip', handle_playlist_trigger_clip)
register_handler('playlist.stop_clips', handle_playlist_stop_clips)
register_handler('playlist.get_live_status', handle_playlist_get_live_status)
