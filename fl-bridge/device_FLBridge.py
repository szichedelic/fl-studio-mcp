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

# Response queue for async response delivery
_response_queue = []

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

    Clean up any resources and clear queues.
    """
    global _response_queue

    print("FL Bridge: Shutting down")

    try:
        # Clear response queue
        _response_queue.clear()

    except Exception as e:
        # Even shutdown errors should be caught
        print(f"FL Bridge: Error during shutdown - {e}")


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
    global _response_queue

    # DEBUG: Log every SysEx call
    print(f"FL Bridge: OnSysEx called!")
    print(f"FL Bridge: Event type: {type(event)}")
    print(f"FL Bridge: Event dir: {[a for a in dir(event) if not a.startswith('_')]}")

    try:
        # Check if protocol is loaded
        if not _protocol_loaded:
            print("FL Bridge: SysEx received but protocol not loaded")
            event.handled = True
            return

        # Get the SysEx data - try multiple attributes
        sysex_data = None
        if hasattr(event, 'sysex'):
            sysex_data = event.sysex
            print(f"FL Bridge: Found event.sysex: {type(sysex_data)}")
        if sysex_data is None and hasattr(event, 'data'):
            sysex_data = event.data
            print(f"FL Bridge: Using event.data instead: {type(sysex_data)}")
        if sysex_data is None:
            print("FL Bridge: No sysex data in event (checked .sysex and .data)")
            return

        print(f"FL Bridge: SysEx data length: {len(sysex_data)}, first bytes: {list(sysex_data[:10]) if len(sysex_data) >= 10 else list(sysex_data)}")

        # Check if this is our message (manufacturer ID 0x7D)
        # SysEx format: F0 7D [origin] [client_id] ...
        if len(sysex_data) < 3:
            print("FL Bridge: SysEx too short")
            return

        # Check for SysEx start (0xF0) and our manufacturer ID (0x7D)
        if sysex_data[0] != 0xF0 or sysex_data[1] != 0x7D:
            # Not our message - let other scripts handle it
            print(f"FL Bridge: Not our message (byte 0: {sysex_data[0]}, byte 1: {sysex_data[1]})")
            return

        # Mark as handled so other scripts don't process it
        event.handled = True
        print("FL Bridge: Our message! Parsing...")

        # Parse the SysEx message
        parsed = _sysex.parse_sysex(bytes(sysex_data))
        print(f"FL Bridge: Parsed result: {parsed}")

        if 'error' in parsed:
            # Parsing failed - send error response
            error_response = {
                'success': False,
                'error': parsed['error']
            }
            client_id = parsed.get('client_id', 0)
            _response_queue.append({
                'client_id': client_id,
                'response': error_response,
                'success': False
            })
            print(f"FL Bridge: Parse error - {parsed['error']}")
            return

        # Execute the command
        print(f"FL Bridge: Executing command...")
        result = _commands.execute_command(parsed)
        print(f"FL Bridge: Command result: {result}")

        # Send response immediately (OnIdle not being called reliably)
        # Use chunked sending to handle large payloads (e.g., plugin parameter lists)
        try:
            chunks = _sysex.build_chunked_sysex_response(
                client_id=parsed['client_id'],
                response=result,
                success=result.get('success', True)
            )
            print(f"FL Bridge: Built response, {len(chunks)} chunk(s)")

            # Send each chunk on same port (bidirectional single-port setup)
            for i, chunk in enumerate(chunks):
                device.midiOutSysex(bytes(chunk))
                print(f"FL Bridge: Chunk {i+1}/{len(chunks)} sent ({len(chunk)} bytes)")

            print(f"FL Bridge: Response sent!")
        except Exception as send_err:
            print(f"FL Bridge: Failed to send response: {send_err}")

    except Exception as e:
        # Catch ALL exceptions to prevent FL Studio crash
        print(f"FL Bridge: Error in OnSysEx - {e}")

        # Try to send error response if we can
        try:
            event.handled = True
            if _protocol_loaded:
                _response_queue.append({
                    'client_id': 0,
                    'response': {'success': False, 'error': str(e)},
                    'success': False
                })
        except:
            pass


def OnIdle():
    """
    Called every ~20ms by FL Studio.

    This is where we send queued responses. We process at most ONE response
    per call to prevent blocking FL Studio's UI/audio thread.

    Responses are built into SysEx messages and sent via device.midiOutSysex().
    """
    global _response_queue

    # Debug: check if OnIdle is being called when there's data
    if _response_queue:
        print(f"FL Bridge: OnIdle called with queue size: {len(_response_queue)}, protocol_loaded: {_protocol_loaded}")

    try:
        # Process at most 1 response per call to prevent blocking
        if _response_queue and _protocol_loaded:
            print(f"FL Bridge: OnIdle sending response, queue size: {len(_response_queue)}")
            response_data = _response_queue.pop(0)

            # Build SysEx response
            sysex_bytes = _sysex.build_sysex_response(
                client_id=response_data['client_id'],
                response=response_data['response'],
                success=response_data.get('success', True)
            )
            print(f"FL Bridge: Built SysEx response, length: {len(sysex_bytes)}")

            # Send via MIDI
            device.midiOutSysex(bytes(sysex_bytes))
            print(f"FL Bridge: Response sent!")

    except Exception as e:
        # Log but don't crash - OnIdle is called continuously
        print(f"FL Bridge: Error in OnIdle - {e}")


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

    Returns:
        dict: The _handlers dictionary
    """
    return _handlers


def queue_response(client_id: int, response: dict, success: bool = True):
    """
    Queue a response for delivery in OnIdle.

    This can be called from command handlers that need to send
    additional responses or notifications.

    Args:
        client_id: Client correlation ID
        response: Response dictionary
        success: Whether the response indicates success
    """
    global _response_queue
    _response_queue.append({
        'client_id': client_id,
        'response': response,
        'success': success
    })
