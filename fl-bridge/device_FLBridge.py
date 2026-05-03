# name=FL Bridge
# url=https://github.com/fl-studio-mcp

"""
FL Bridge - FL Studio MIDI Controller Script for MCP Server Communication

This script serves as the FL Studio side of the communication bridge between
an MCP server and FL Studio. It receives commands via MIDI SysEx messages,
executes them against the FL Studio API, and sends responses back.

CRITICAL ARCHITECTURE NOTES:
============================
1. FL Studio crashes SILENTLY on any initialization errors. ALL module-level
   code MUST be wrapped in try/except blocks.

2. FL Studio's Python interpreter has BROKEN threading support. Never use
   threading, asyncio, or any concurrent patterns. All operations must be
   synchronous and event-driven.

3. The script communicates via MIDI SysEx messages using virtual MIDI ports
   (loopMIDI on Windows). Messages are JSON payloads encoded in base64.

4. Commands are received in OnSysEx callback, responses are queued and sent
   in OnIdle callback (runs every ~20ms) to prevent blocking.

FILE NAMING:
============
This file MUST be named device_FLBridge.py (device_*.py is FL Studio's naming
convention for MIDI Controller Scripts).

INSTALLATION:
=============
Copy the fl-bridge folder to:
  Documents/Image-Line/FL Studio/Settings/Hardware/

AUTHOR: FL Studio MCP Project
"""

# ============================================================================
# SAFE INITIALIZATION SECTION
# All imports and module-level code wrapped in try/except to prevent crashes
# ============================================================================

# Verbose per-message logging. Off by default to keep FL Studio's Script
# output usable; flip on while debugging the bridge itself.
_DEBUG = False


def _dbg(msg):
    """Print only when _DEBUG is on. Always safe to call."""
    if _DEBUG:
        print(msg)


# Command handlers registry (populated by commands.py)
_handlers = {}

# FL Studio module references (may be mocks if running outside FL Studio)
device = None
transport = None
patterns = None
channels = None
mixer = None

# Protocol modules (lazy loaded in OnInit for safety)
_protocol_loaded = False
_sysex = None
_commands = None

try:
    # Attempt to import FL Studio modules
    import device as _device
    import transport as _transport
    import patterns as _patterns
    import channels as _channels
    import mixer as _mixer

    device = _device
    transport = _transport
    patterns = _patterns
    channels = _channels
    mixer = _mixer

except ImportError:
    # Running outside FL Studio (testing mode)
    # Create mock objects for basic testing
    class MockModule:
        """Mock module for testing outside FL Studio."""
        def __getattr__(self, name):
            def mock_method(*args, **kwargs):
                print(f"[MOCK] {name}({args}, {kwargs})")
                return None
            return mock_method

    device = MockModule()
    transport = MockModule()
    patterns = MockModule()
    channels = MockModule()
    mixer = MockModule()
    print("FL Bridge: Running in test mode (FL Studio modules not available)")

except Exception as e:
    # Catch ANY other initialization error
    print(f"FL Bridge: Initialization error - {e}")


# ============================================================================
# FL STUDIO CALLBACKS
# ============================================================================

def OnInit():
    """
    Called when FL Studio initializes the MIDI script.

    This is the safe place to do initialization that might fail.
    We use lazy imports here to catch protocol module errors safely.
    """
    global _protocol_loaded, _sysex, _commands

    print("FL Bridge: Initializing...")

    try:
        # Lazy import protocol modules for safety
        # If these fail, we log but don't crash FL Studio
        from protocol import sysex as sysex_module
        from protocol import commands as commands_module

        _sysex = sysex_module
        _commands = commands_module
        _protocol_loaded = True

        print("FL Bridge: Protocol modules loaded")

        # Import handlers to register them
        # This triggers registration of all command handlers
        try:
            from handlers import transport, state, patterns, pianoroll
            print("FL Bridge: Handlers registered (transport, state, patterns, pianoroll)")
        except ImportError as e:
            print(f"FL Bridge: Warning - failed to load handlers: {e}")
            # Continue anyway - protocol still works, just no handlers

        # Import plugin handlers (created in Plan 02, may not exist yet)
        try:
            from handlers import plugins
            print("FL Bridge: Plugin handlers registered")
        except ImportError:
            print("FL Bridge: Plugin handlers not yet available")

        print("FL Bridge: Ready")

    except ImportError as e:
        print(f"FL Bridge: Failed to load protocol modules - {e}")
        print("FL Bridge: Running in degraded mode (no SysEx handling)")
        _protocol_loaded = False

    except Exception as e:
        print(f"FL Bridge: Unexpected error during init - {e}")
        _protocol_loaded = False


def OnDeInit():
    """
    Called when FL Studio is closing or reloading the script.
    """
    print("FL Bridge: Shutting down")


def _send_response(client_id, response, success):
    """
    Build a chunked SysEx response and send it synchronously.

    All response paths (success, command-error, parse-error, exception)
    go through here so the wire format is identical in every case —
    chunked, with reassembly on the client side.
    """
    if not _protocol_loaded:
        return
    try:
        chunks = _sysex.build_chunked_sysex_response(
            client_id=client_id,
            response=response,
            success=success,
        )
        for chunk in chunks:
            device.midiOutSysex(bytes(chunk))
        _dbg(f"FL Bridge: Sent {len(chunks)} chunk(s) for client {client_id}")
    except Exception as send_err:
        # Don't re-raise — a failed send must not destabilise FL Studio.
        print(f"FL Bridge: Failed to send response: {send_err}")


def OnSysEx(event):
    """
    Called when a SysEx MIDI message is received.

    This is the main command entry point. Messages are parsed, executed,
    and responses are queued for delivery in OnIdle.

    CRITICAL: Entire function wrapped in try/except. Any uncaught exception
    here could destabilize FL Studio.

    Args:
        event: FL Studio MIDI event object with .sysex attribute (bytes)
    """
    _dbg("FL Bridge: OnSysEx called")

    try:
        if not _protocol_loaded:
            print("FL Bridge: SysEx received but protocol not loaded")
            event.handled = True
            return

        # FL Studio uses .sysex on most builds; fall back to .data.
        sysex_data = getattr(event, 'sysex', None)
        if sysex_data is None:
            sysex_data = getattr(event, 'data', None)
        if sysex_data is None:
            _dbg("FL Bridge: No sysex data on event")
            return

        # Need at least F0 7D ... to identify our protocol.
        if len(sysex_data) < 3:
            return
        if sysex_data[0] != 0xF0 or sysex_data[1] != 0x7D:
            # Not our message — let other scripts handle it.
            return

        # Mark as handled so other MIDI scripts don't reprocess it.
        event.handled = True

        parsed = _sysex.parse_sysex(bytes(sysex_data))

        if 'error' in parsed:
            print(f"FL Bridge: Parse error - {parsed['error']}")
            _send_response(
                parsed.get('client_id', 0),
                {'success': False, 'error': parsed['error']},
                success=False,
            )
            return

        result = _commands.execute_command(parsed)
        _send_response(
            parsed['client_id'],
            result,
            success=result.get('success', True),
        )

    except Exception as e:
        # Catch ALL exceptions to prevent FL Studio crash.
        print(f"FL Bridge: Error in OnSysEx - {e}")
        try:
            event.handled = True
            _send_response(0, {'success': False, 'error': str(e)}, success=False)
        except Exception:
            pass


def OnIdle():
    """
    Called every ~20ms by FL Studio. We have nothing to do here — responses
    are sent synchronously from OnSysEx via _send_response.
    """
    pass


def OnMidiMsg(event):
    """
    Called when a non-SysEx MIDI message is received.

    Currently a placeholder for future non-SysEx MIDI handling if needed.
    SysEx messages go to OnSysEx instead.

    Args:
        event: FL Studio MIDI event object
    """
    # Placeholder for future non-SysEx MIDI handling
    # Currently we only use SysEx for communication
    pass


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_handlers():
    """
    Returns the handlers dictionary for command registration.

    Called by commands.py to register command handlers.
    """
    return _handlers
