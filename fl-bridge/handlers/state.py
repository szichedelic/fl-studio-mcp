"""
FL Bridge State Handlers

Handles state reading commands for channels, mixer, and patterns.

REGISTERED HANDLERS:
====================
- state.channels: Get all channels in the channel rack
- state.mixer: Get mixer track information
- state.patterns: Get all patterns in the project

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any, List

# Import FL Studio modules
try:
    import channels
    import mixer
    import patterns
except ImportError:
    # Running outside FL Studio
    channels = None
    mixer = None
    patterns = None

# Import handler registration
from protocol.commands import register_handler


def handle_get_channels(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get all channels in the channel rack.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {
            success: True,
            channels: [
                {
                    index: int,
                    name: str,
                    type: int,
                    volume: float,
                    pan: float,
                    muted: bool,
                    selected: bool,
                    targetMixer: int
                }
            ]
        }
    """
    try:
        if channels is None:
            return {'success': False, 'error': 'Channels module not available'}

        channel_list: List[Dict[str, Any]] = []
        count = channels.channelCount()

        for i in range(count):
            channel_info = {
                'index': i,
                'name': channels.getChannelName(i),
                'type': channels.getChannelType(i),
                'volume': channels.getChannelVolume(i),
                'pan': channels.getChannelPan(i),
                'muted': channels.isChannelMuted(i),
                'selected': channels.isChannelSelected(i),
                'targetMixer': channels.getTargetFxTrack(i)
            }
            channel_list.append(channel_info)

        return {
            'success': True,
            'channels': channel_list
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_get_mixer(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get mixer track information.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {
            success: True,
            tracks: [
                {
                    index: int,
                    name: str,
                    volume: float,
                    pan: float,
                    muted: bool,
                    solo: bool
                }
            ],
            tempo: float
        }
    """
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        track_list: List[Dict[str, Any]] = []
        count = mixer.trackCount()

        for i in range(count):
            track_info = {
                'index': i,
                'name': mixer.getTrackName(i),
                'volume': mixer.getTrackVolume(i),
                'pan': mixer.getTrackPan(i),
                'muted': mixer.isTrackMuted(i),
                'solo': mixer.isTrackSolo(i),
                'color': mixer.getTrackColor(i)
            }
            track_list.append(track_info)

        return {
            'success': True,
            'tracks': track_list,
            'tempo': mixer.getCurrentTempo()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_get_patterns(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get all patterns in the project.

    Args:
        params: Empty dict (no parameters needed)

    Returns:
        dict: {
            success: True,
            patterns: [
                {
                    index: int,
                    name: str,
                    length: int,
                    color: int,
                    selected: bool
                }
            ],
            currentPattern: int
        }
    """
    try:
        if patterns is None:
            return {'success': False, 'error': 'Patterns module not available'}

        pattern_list: List[Dict[str, Any]] = []
        count = patterns.patternCount()

        for i in range(1, count + 1):  # Patterns are 1-indexed
            # Skip default/empty patterns (check if name is default)
            name = patterns.getPatternName(i)

            # Include all patterns that exist
            pattern_info = {
                'index': i,
                'name': name,
                'length': patterns.getPatternLength(i),
                'color': patterns.getPatternColor(i),
                'selected': (patterns.patternNumber() == i)
            }
            pattern_list.append(pattern_info)

        return {
            'success': True,
            'patterns': pattern_list,
            'currentPattern': patterns.patternNumber()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all state handlers
register_handler('state.channels', handle_get_channels)
register_handler('state.mixer', handle_get_mixer)
register_handler('state.patterns', handle_get_patterns)
