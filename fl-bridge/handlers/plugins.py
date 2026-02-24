"""
FL Bridge Plugin Parameter Handlers

Handles plugin parameter discovery, reading, and writing for any loaded
VST/FL-native plugin in the channel rack or mixer effect slots.

REGISTERED HANDLERS:
====================
- plugins.discover: Discover all named parameters of a plugin
- plugins.get_param: Read a single parameter value by index
- plugins.set_param: Write a single parameter value by index
- plugins.next_preset: Navigate to next preset and return its name
- plugins.prev_preset: Navigate to previous preset and return its name
- plugins.preset_count: Get total preset count and current preset name

PARAMETER INDEXING:
===================
VST plugins report 4240 parameter slots (4096 standard + 128 MIDI CC + 16
aftertouch). Most slots are blank/unnamed. The discover handler filters to
only named parameters, giving the caller a clean list.

ARGUMENT ORDER WARNING:
=======================
plugins.setParamValue(value, paramIndex, index, slotIndex) -- value is the
FIRST argument, not paramIndex. This is the FL Studio API convention.

AUTHOR: FL Studio MCP Project
"""

from typing import Dict, Any

# Import FL Studio plugins and channels modules
try:
    import plugins
except ImportError:
    # Running outside FL Studio
    plugins = None

try:
    import channels
except ImportError:
    # Running outside FL Studio
    channels = None

# Import handler registration
from protocol.commands import register_handler


def handle_plugin_discover(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Discover all named parameters for a plugin.

    Iterates all parameter slots (typically 4240 for VSTs) and returns only
    those with non-empty names, along with their current values.

    Args:
        params: {
            index (int, optional): Channel index. Default: selected channel.
            slotIndex (int, optional): Mixer effect slot. Default: -1 (channel rack).
        }

    Returns:
        dict: {
            success: True,
            pluginName: str,
            channelIndex: int,
            slotIndex: int,
            totalSlots: int,
            parameterCount: int,
            parameters: [{index, name, value}, ...]
        }
    """
    try:
        if plugins is None:
            return {'success': False, 'error': 'Plugins module not available'}
        if channels is None:
            return {'success': False, 'error': 'Channels module not available'}

        index = params.get('index', channels.selectedChannel())
        slot_index = params.get('slotIndex', -1)

        if not plugins.isValid(index, slot_index):
            return {
                'success': False,
                'error': f'No valid plugin at channel {index}, slot {slot_index}'
            }

        plugin_name = plugins.getPluginName(index, slot_index)
        param_count = plugins.getParamCount(index, slot_index)

        discovered = []
        for i in range(param_count):
            name = plugins.getParamName(i, index, slot_index)
            if name and name.strip():
                discovered.append({
                    'index': i,
                    'name': name,
                    'value': plugins.getParamValue(i, index, slot_index)
                })

        return {
            'success': True,
            'pluginName': plugin_name,
            'channelIndex': index,
            'slotIndex': slot_index,
            'totalSlots': param_count,
            'parameterCount': len(discovered),
            'parameters': discovered
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_plugin_get_param(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Read a single parameter's value by index.

    Args:
        params: {
            paramIndex (int, required): Parameter index to read.
            index (int, optional): Channel index. Default: selected channel.
            slotIndex (int, optional): Mixer effect slot. Default: -1 (channel rack).
        }

    Returns:
        dict: {
            success: True,
            paramIndex: int,
            name: str,
            value: float,
            valueString: str,
            channelIndex: int,
            slotIndex: int
        }
    """
    try:
        if plugins is None:
            return {'success': False, 'error': 'Plugins module not available'}
        if channels is None:
            return {'success': False, 'error': 'Channels module not available'}

        if 'paramIndex' not in params:
            return {'success': False, 'error': 'Missing required parameter: paramIndex'}

        param_index = int(params['paramIndex'])
        index = params.get('index', channels.selectedChannel())
        slot_index = params.get('slotIndex', -1)

        if not plugins.isValid(index, slot_index):
            return {
                'success': False,
                'error': f'No valid plugin at channel {index}, slot {slot_index}'
            }

        param_count = plugins.getParamCount(index, slot_index)
        if param_index < 0 or param_index >= param_count:
            return {
                'success': False,
                'error': f'paramIndex {param_index} out of range (0 to {param_count - 1})'
            }

        name = plugins.getParamName(param_index, index, slot_index)
        value = plugins.getParamValue(param_index, index, slot_index)

        # Some plugins don't support getParamValueString
        try:
            value_string = plugins.getParamValueString(param_index, index, slot_index)
        except Exception:
            value_string = ''

        return {
            'success': True,
            'paramIndex': param_index,
            'name': name,
            'value': value,
            'valueString': value_string,
            'channelIndex': index,
            'slotIndex': slot_index
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_plugin_set_param(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Write a single parameter's value by index.

    IMPORTANT: plugins.setParamValue(value, paramIndex, index, slotIndex)
    -- value is the FIRST argument.

    Args:
        params: {
            paramIndex (int, required): Parameter index to write.
            value (float, required): Value to set (0.0 to 1.0).
            index (int, optional): Channel index. Default: selected channel.
            slotIndex (int, optional): Mixer effect slot. Default: -1 (channel rack).
        }

    Returns:
        dict: {
            success: True,
            paramIndex: int,
            value: float,
            readBack: float,
            valueString: str,
            channelIndex: int,
            slotIndex: int
        }
    """
    try:
        if plugins is None:
            return {'success': False, 'error': 'Plugins module not available'}
        if channels is None:
            return {'success': False, 'error': 'Channels module not available'}

        if 'paramIndex' not in params:
            return {'success': False, 'error': 'Missing required parameter: paramIndex'}
        if 'value' not in params:
            return {'success': False, 'error': 'Missing required parameter: value'}

        param_index = int(params['paramIndex'])
        value = float(params['value'])
        index = params.get('index', channels.selectedChannel())
        slot_index = params.get('slotIndex', -1)

        # Validate value range
        if value < 0.0 or value > 1.0:
            return {
                'success': False,
                'error': f'value {value} out of range (must be 0.0 to 1.0)'
            }

        if not plugins.isValid(index, slot_index):
            return {
                'success': False,
                'error': f'No valid plugin at channel {index}, slot {slot_index}'
            }

        param_count = plugins.getParamCount(index, slot_index)
        if param_index < 0 or param_index >= param_count:
            return {
                'success': False,
                'error': f'paramIndex {param_index} out of range (0 to {param_count - 1})'
            }

        # Set the parameter value
        # CRITICAL: value is the FIRST argument in setParamValue
        plugins.setParamValue(value, param_index, index, slot_index)

        # Read back for confirmation
        readback_value = plugins.getParamValue(param_index, index, slot_index)

        # Get display string for confirmation
        try:
            value_string = plugins.getParamValueString(param_index, index, slot_index)
        except Exception:
            value_string = ''

        return {
            'success': True,
            'paramIndex': param_index,
            'value': value,
            'readBack': readback_value,
            'valueString': value_string,
            'channelIndex': index,
            'slotIndex': slot_index
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_plugin_next_preset(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Navigate to the next preset in the plugin's preset list.

    Args:
        params: {
            index (int, optional): Channel index. Default: selected channel.
            slotIndex (int, optional): Mixer effect slot. Default: -1 (channel rack).
        }

    Returns:
        dict: {
            success: True,
            presetName: str,
            channelIndex: int,
            slotIndex: int
        }
    """
    try:
        if plugins is None:
            return {'success': False, 'error': 'Plugins module not available'}
        if channels is None:
            return {'success': False, 'error': 'Channels module not available'}

        index = params.get('index', channels.selectedChannel())
        slot_index = params.get('slotIndex', -1)

        if not plugins.isValid(index, slot_index):
            return {
                'success': False,
                'error': f'No valid plugin at channel {index}, slot {slot_index}'
            }

        plugins.nextPreset(index, slot_index)
        preset_name = plugins.getName(index, slot_index, 6, 0)  # 6 = FPN_Preset
        return {
            'success': True,
            'presetName': preset_name,
            'channelIndex': index,
            'slotIndex': slot_index
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_plugin_prev_preset(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Navigate to the previous preset in the plugin's preset list.

    Args:
        params: {
            index (int, optional): Channel index. Default: selected channel.
            slotIndex (int, optional): Mixer effect slot. Default: -1 (channel rack).
        }

    Returns:
        dict: {
            success: True,
            presetName: str,
            channelIndex: int,
            slotIndex: int
        }
    """
    try:
        if plugins is None:
            return {'success': False, 'error': 'Plugins module not available'}
        if channels is None:
            return {'success': False, 'error': 'Channels module not available'}

        index = params.get('index', channels.selectedChannel())
        slot_index = params.get('slotIndex', -1)

        if not plugins.isValid(index, slot_index):
            return {
                'success': False,
                'error': f'No valid plugin at channel {index}, slot {slot_index}'
            }

        plugins.prevPreset(index, slot_index)
        preset_name = plugins.getName(index, slot_index, 6, 0)  # 6 = FPN_Preset
        return {
            'success': True,
            'presetName': preset_name,
            'channelIndex': index,
            'slotIndex': slot_index
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_plugin_preset_count(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get the total number of presets for a plugin.

    Args:
        params: {
            index (int, optional): Channel index. Default: selected channel.
            slotIndex (int, optional): Mixer effect slot. Default: -1 (channel rack).
        }

    Returns:
        dict: {
            success: True,
            presetCount: int,
            currentPreset: str,
            channelIndex: int,
            slotIndex: int
        }
    """
    try:
        if plugins is None:
            return {'success': False, 'error': 'Plugins module not available'}
        if channels is None:
            return {'success': False, 'error': 'Channels module not available'}

        index = params.get('index', channels.selectedChannel())
        slot_index = params.get('slotIndex', -1)

        if not plugins.isValid(index, slot_index):
            return {
                'success': False,
                'error': f'No valid plugin at channel {index}, slot {slot_index}'
            }

        count = plugins.getPresetCount(index, slot_index)
        current_name = plugins.getName(index, slot_index, 6, 0)  # 6 = FPN_Preset
        return {
            'success': True,
            'presetCount': count,
            'currentPreset': current_name,
            'channelIndex': index,
            'slotIndex': slot_index
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# Register all plugin handlers
register_handler('plugins.discover', handle_plugin_discover)
register_handler('plugins.get_param', handle_plugin_get_param)
register_handler('plugins.set_param', handle_plugin_set_param)
register_handler('plugins.next_preset', handle_plugin_next_preset)
register_handler('plugins.prev_preset', handle_plugin_prev_preset)
register_handler('plugins.preset_count', handle_plugin_preset_count)
