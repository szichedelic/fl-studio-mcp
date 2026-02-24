"""
FL Bridge SysEx Protocol

This module handles SysEx message parsing and building for communication
between the MCP server and FL Bridge.

MESSAGE FORMAT (Flapi-inspired):
================================
Byte 0:     F0          - SysEx start
Byte 1:     7D          - Non-commercial manufacturer ID
Byte 2:     origin      - 0x00=client (MCP server), 0x01=server (FL Bridge)
Byte 3:     client_id   - Correlation ID (0x01-0x7F)
Byte 4:     continuation - 0x00=final, 0x01=continued
Byte 5:     msg_type    - 0x01=command, 0x02=response
Byte 6:     status      - 0x00=ok, 0x01=error
Bytes 7-N:  payload     - Base64-encoded JSON
Byte N+1:   F7          - SysEx end

PAYLOAD ENCODING:
=================
The JSON payload is base64 encoded to ensure all bytes are 7-bit safe
(MIDI SysEx requires data bytes to have bit 7 = 0).

AUTHOR: FL Studio MCP Project
"""

import base64
import json
from typing import Dict, Any, List, Optional, Union

# ============================================================================
# CONSTANTS
# ============================================================================

# SysEx framing bytes
SYSEX_START = 0xF0
SYSEX_END = 0xF7

# Non-commercial manufacturer ID (safe for custom protocols)
MANUFACTURER_ID = 0x7D

# Message origin
ORIGIN_CLIENT = 0x00  # Message from MCP server
ORIGIN_SERVER = 0x01  # Message from FL Bridge

# Message types
MSG_TYPE_COMMAND = 0x01
MSG_TYPE_RESPONSE = 0x02

# Status codes
STATUS_OK = 0x00
STATUS_ERROR = 0x01

# Chunking limits
# Conservative: 2048 RtMidi buffer - 8 header/footer bytes - safety margin
MAX_PAYLOAD_BYTES = 1800


# ============================================================================
# PUBLIC FUNCTIONS
# ============================================================================

def parse_sysex(data: bytes) -> Dict[str, Any]:
    """
    Parse an incoming SysEx message into a command dictionary.

    Args:
        data: Raw SysEx bytes from FL Studio

    Returns:
        dict: Parsed message with keys:
            - client_id (int): Correlation ID for response matching
            - command (dict): The command object with 'action' and 'params'
            OR
            - client_id (int): Best guess at client ID
            - error (str): Error description if parsing failed

    Example:
        >>> parsed = parse_sysex(raw_sysex)
        >>> if 'error' not in parsed:
        ...     action = parsed['command']['action']
        ...     params = parsed['command'].get('params', {})
    """
    try:
        # Validate minimum length
        # Minimum: F0 7D origin client_id continuation msg_type status F7 = 8 bytes
        if len(data) < 8:
            return {'client_id': 0, 'error': 'Message too short'}

        # Validate SysEx framing
        if data[0] != SYSEX_START:
            return {'client_id': 0, 'error': 'Missing SysEx start byte (0xF0)'}

        if data[-1] != SYSEX_END:
            return {'client_id': 0, 'error': 'Missing SysEx end byte (0xF7)'}

        # Validate manufacturer ID
        if data[1] != MANUFACTURER_ID:
            return {'client_id': 0, 'error': f'Wrong manufacturer ID: {hex(data[1])}'}

        # Extract header fields
        origin = data[2]
        client_id = data[3]
        continuation = data[4]
        msg_type = data[5]
        status = data[6]

        # Validate origin (should be from client)
        if origin != ORIGIN_CLIENT:
            return {
                'client_id': client_id,
                'error': f'Expected origin=client (0x00), got {hex(origin)}'
            }

        # Validate message type (should be command)
        if msg_type != MSG_TYPE_COMMAND:
            return {
                'client_id': client_id,
                'error': f'Expected msg_type=command (0x01), got {hex(msg_type)}'
            }

        # Handle continuation (not implemented yet, but prepared for future)
        if continuation != 0x00:
            return {
                'client_id': client_id,
                'error': 'Continuation messages not yet supported'
            }

        # Extract payload (bytes 7 to -1, excluding F7)
        payload_bytes = data[7:-1]

        if len(payload_bytes) == 0:
            return {
                'client_id': client_id,
                'error': 'Empty payload'
            }

        # Base64 decode the payload
        try:
            payload_str = bytes(payload_bytes).decode('ascii')
            json_bytes = base64.b64decode(payload_str)
            json_str = json_bytes.decode('utf-8')
        except Exception as e:
            return {
                'client_id': client_id,
                'error': f'Base64 decode failed: {e}'
            }

        # JSON parse the command
        try:
            command = json.loads(json_str)
        except json.JSONDecodeError as e:
            return {
                'client_id': client_id,
                'error': f'JSON parse failed: {e}'
            }

        # Validate command structure
        if not isinstance(command, dict):
            return {
                'client_id': client_id,
                'error': 'Command must be a JSON object'
            }

        if 'action' not in command:
            return {
                'client_id': client_id,
                'error': 'Command missing required "action" field'
            }

        return {
            'client_id': client_id,
            'command': command
        }

    except Exception as e:
        # Catch-all for any unexpected errors
        return {'client_id': 0, 'error': f'Parse error: {e}'}


def build_sysex_response(
    client_id: int,
    response: Dict[str, Any],
    success: bool = True
) -> List[int]:
    """
    Build a SysEx response message to send back to the MCP server.

    Args:
        client_id: Correlation ID from the original command
        response: Response dictionary to send
        success: True if operation succeeded, False if error

    Returns:
        list: SysEx message as list of integers (bytes)

    Example:
        >>> resp = build_sysex_response(1, {'success': True, 'data': 'test'})
        >>> device.midiOutSysex(bytes(resp))
    """
    try:
        # JSON encode the response
        json_str = json.dumps(response)
        json_bytes = json_str.encode('utf-8')

        # Base64 encode for 7-bit safety
        base64_str = base64.b64encode(json_bytes).decode('ascii')
        payload = [ord(c) for c in base64_str]

        # Build the message
        message = [
            SYSEX_START,           # F0
            MANUFACTURER_ID,       # 7D
            ORIGIN_SERVER,         # 0x01 (from FL Bridge)
            client_id & 0x7F,      # Ensure 7-bit (0x01-0x7F valid range)
            0x00,                  # No continuation
            MSG_TYPE_RESPONSE,     # 0x02
            STATUS_OK if success else STATUS_ERROR,
            *payload,
            SYSEX_END              # F7
        ]

        return message

    except Exception as e:
        # If building fails, return a minimal error response
        error_json = json.dumps({'success': False, 'error': str(e)})
        error_b64 = base64.b64encode(error_json.encode('utf-8')).decode('ascii')
        error_payload = [ord(c) for c in error_b64]

        return [
            SYSEX_START,
            MANUFACTURER_ID,
            ORIGIN_SERVER,
            client_id & 0x7F,
            0x00,
            MSG_TYPE_RESPONSE,
            STATUS_ERROR,
            *error_payload,
            SYSEX_END
        ]


def build_chunked_sysex_response(
    client_id: int,
    response: Dict[str, Any],
    success: bool = True
) -> List[List[int]]:
    """
    Build one or more SysEx messages for a response, chunking if the payload
    exceeds MAX_PAYLOAD_BYTES.

    This is the preferred way to send responses, as it transparently handles
    payloads that would exceed the node-midi 2048-byte RtMidi buffer limit.
    Small responses produce exactly one message (identical to build_sysex_response).

    Args:
        client_id: Correlation ID from the original command
        response: Response dictionary to send
        success: True if operation succeeded, False if error

    Returns:
        list: List of SysEx messages (each a list of integers).
              Single-chunk responses return a list with one message.
              Multi-chunk responses have continuation=0x01 on all but the last.

    Example:
        >>> chunks = build_chunked_sysex_response(1, {'success': True, 'data': 'test'})
        >>> for chunk in chunks:
        ...     device.midiOutSysex(bytes(chunk))
    """
    try:
        # JSON encode the response
        json_str = json.dumps(response)
        json_bytes = json_str.encode('utf-8')

        # Base64 encode for 7-bit safety
        base64_str = base64.b64encode(json_bytes).decode('ascii')

        status_byte = STATUS_OK if success else STATUS_ERROR

        # Split into chunks if needed
        chunks = []
        for i in range(0, len(base64_str), MAX_PAYLOAD_BYTES):
            chunk_payload = base64_str[i:i + MAX_PAYLOAD_BYTES]
            is_last = (i + MAX_PAYLOAD_BYTES >= len(base64_str))
            continuation = 0x00 if is_last else 0x01

            message = [
                SYSEX_START,           # F0
                MANUFACTURER_ID,       # 7D
                ORIGIN_SERVER,         # 0x01 (from FL Bridge)
                client_id & 0x7F,      # Ensure 7-bit
                continuation,          # 0x01=more chunks, 0x00=final
                MSG_TYPE_RESPONSE,     # 0x02
                status_byte,
                *[ord(c) for c in chunk_payload],
                SYSEX_END              # F7
            ]
            chunks.append(message)

        return chunks

    except Exception as e:
        # If building fails, return a minimal error response as single chunk
        error_json = json.dumps({'success': False, 'error': str(e)})
        error_b64 = base64.b64encode(error_json.encode('utf-8')).decode('ascii')
        error_payload = [ord(c) for c in error_b64]

        return [[
            SYSEX_START,
            MANUFACTURER_ID,
            ORIGIN_SERVER,
            client_id & 0x7F,
            0x00,
            MSG_TYPE_RESPONSE,
            STATUS_ERROR,
            *error_payload,
            SYSEX_END
        ]]


def build_sysex_command(
    client_id: int,
    action: str,
    params: Optional[Dict[str, Any]] = None
) -> List[int]:
    """
    Build a SysEx command message (used for testing).

    This is typically called by the MCP server (TypeScript), but provided
    here for testing the protocol in Python.

    Args:
        client_id: Correlation ID for response matching
        action: Command action string (e.g., 'transport.start')
        params: Optional parameters dictionary

    Returns:
        list: SysEx message as list of integers (bytes)

    Example:
        >>> cmd = build_sysex_command(1, 'transport.start', {})
        >>> # In test: parse_sysex(bytes(cmd))
    """
    command = {
        'action': action,
        'params': params or {}
    }

    # JSON encode the command
    json_str = json.dumps(command)
    json_bytes = json_str.encode('utf-8')

    # Base64 encode for 7-bit safety
    base64_str = base64.b64encode(json_bytes).decode('ascii')
    payload = [ord(c) for c in base64_str]

    # Build the message
    message = [
        SYSEX_START,           # F0
        MANUFACTURER_ID,       # 7D
        ORIGIN_CLIENT,         # 0x00 (from MCP server)
        client_id & 0x7F,      # Ensure 7-bit
        0x00,                  # No continuation
        MSG_TYPE_COMMAND,      # 0x01
        STATUS_OK,             # 0x00
        *payload,
        SYSEX_END              # F7
    ]

    return message


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def validate_sysex(data: bytes) -> bool:
    """
    Quick validation that data looks like our SysEx message.

    Args:
        data: Raw bytes to check

    Returns:
        bool: True if data appears to be our SysEx message
    """
    return (
        len(data) >= 8 and
        data[0] == SYSEX_START and
        data[1] == MANUFACTURER_ID and
        data[-1] == SYSEX_END
    )


def get_client_id(data: bytes) -> int:
    """
    Extract client ID from SysEx data without full parsing.

    Args:
        data: Raw SysEx bytes

    Returns:
        int: Client ID or 0 if extraction fails
    """
    if len(data) >= 4 and data[0] == SYSEX_START:
        return data[3]
    return 0
