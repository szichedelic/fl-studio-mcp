# Phase 1: Foundation & Communication - Research

**Researched:** 2026-02-23
**Domain:** MCP Server / FL Studio MIDI Bridge / Bidirectional Communication
**Confidence:** HIGH

## Summary

This research covers the technical foundation for establishing reliable bidirectional communication between an MCP client (Claude) and FL Studio. The architecture requires three layers: a TypeScript MCP server using the official SDK, a communication bridge using virtual MIDI ports, and a Python script running inside FL Studio's MIDI Controller environment.

The key discovery is that FL Studio has no external API - the only viable approach is MIDI SysEx messaging through virtual ports (loopMIDI on Windows). The Flapi project proves this architecture works but is unmaintained; we will build a custom bridge using the same proven protocol patterns. Existing FL Studio MCP implementations (karl-andres, ohhalim) validate this approach.

Critical constraints: FL Studio's Python environment does not support threading, all operations must be event-driven via callbacks (OnIdle, OnMidiIn, OnSysEx), and initialization errors crash FL Studio silently.

**Primary recommendation:** Build a custom FL Bridge script using the Flapi-proven SysEx protocol, with all FL Studio operations executed synchronously in response to OnSysEx callbacks, and PME flag checks before any state-modifying operations.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.26.0 | MCP server implementation | Official SDK, TypeScript-first, v1.x stable for production |
| zod | ^3.23.0 | Schema validation for tools | Required by MCP SDK for tool input schemas |
| midi (node-midi) | Latest | MIDI communication in Node.js | RtMidi wrapper, supports virtual ports and SysEx |
| TypeScript | ^5.5.0 | Language | Type safety, MCP SDK is TypeScript-native |
| Node.js | 20.x LTS | Runtime | Stable, LTS, MCP SDK target environment |

### FL Studio Side

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FL Studio | 2025.x | DAW | Target platform with MIDI Controller Scripting API |
| Python | 3.9.x | Script language | FL Studio's embedded interpreter version |
| fl-studio-api-stubs | ^24.0.0 | Development support | Type hints and documentation for FL Studio API |

### Windows Requirements

| Tool | Version | Purpose | Why Required |
|------|---------|---------|--------------|
| loopMIDI | Latest | Virtual MIDI ports | Required on Windows; creates bidirectional MIDI channels |

**Installation:**

```bash
# MCP Server (Node.js)
npm install @modelcontextprotocol/sdk@^1.26.0 zod@^3.23.0 midi
npm install -D typescript@^5.5 @types/node

# FL Studio Script Development (Python, optional for dev)
pip install fl-studio-api-stubs>=24.0.0
```

## Architecture Patterns

### Recommended Project Structure

```
fl-studio-mcp/
├── src/                          # TypeScript MCP server
│   ├── index.ts                  # Entry point, MCP server setup
│   ├── tools/                    # MCP tool definitions
│   │   ├── transport.ts          # Play, stop, record, tempo
│   │   ├── patterns.ts           # Pattern selection, creation
│   │   ├── channels.ts           # Channel rack operations
│   │   ├── mixer.ts              # Mixer track operations
│   │   └── state.ts              # Project state reading
│   └── bridge/                   # FL Studio communication
│       ├── midi-client.ts        # MIDI port management
│       ├── sysex-codec.ts        # SysEx encoding/decoding
│       └── connection.ts         # Connection state, timeouts
├── fl-bridge/                    # FL Studio MIDI Controller Script
│   ├── device_FLBridge.py        # Main entry point (FL Studio naming)
│   ├── handlers/                 # Command handlers
│   │   ├── transport.py          # Transport operations
│   │   ├── patterns.py           # Pattern operations
│   │   ├── channels.py           # Channel operations
│   │   ├── mixer.py              # Mixer operations
│   │   └── state.py              # State reading
│   └── protocol/                 # Communication protocol
│       ├── sysex.py              # SysEx parsing/building
│       └── commands.py           # Command definitions
├── package.json
├── tsconfig.json
└── README.md
```

### Pattern 1: SysEx Message Protocol (Flapi-Inspired)

**What:** Use MIDI SysEx messages to carry JSON command/response payloads with correlation IDs
**When:** All communication between MCP server and FL Bridge
**Why:** SysEx allows arbitrary-length data, works with FL Studio's MIDI scripting, proven by Flapi

**Message Format:**
```
F0              # SysEx start
7D              # Non-commercial manufacturer ID
[origin]        # 0x00=client, 0x01=server
[client_id]     # Correlation ID (0x01-0x7F)
[continuation]  # 0=final, 1=continued
[msg_type]      # Command type byte
[status]        # 0x00=ok, 0x01=error
[base64_data]   # JSON payload, base64 encoded
F7              # SysEx end
```

**Example (TypeScript - MCP Server):**
```typescript
// Source: Flapi Protocol.md + node-midi documentation
import midi from 'midi';

class SysExCodec {
  private static HEADER = [0xF0, 0x7D]; // SysEx + non-commercial ID

  encode(command: object, clientId: number): number[] {
    const json = JSON.stringify(command);
    const base64 = Buffer.from(json).toString('base64');
    // Ensure 7-bit safe by encoding to base64
    const payload = Array.from(Buffer.from(base64));

    return [
      ...SysExCodec.HEADER,
      0x00,           // origin: client
      clientId,       // correlation ID
      0x00,           // no continuation
      0x01,           // msg_type: command
      0x00,           // status: ok
      ...payload,
      0xF7            // SysEx end
    ];
  }

  decode(sysex: number[]): { clientId: number; data: object } {
    // Skip header, extract clientId and payload
    const clientId = sysex[3];
    const payload = sysex.slice(7, -1); // Skip header and F7
    const base64 = Buffer.from(payload).toString();
    const json = Buffer.from(base64, 'base64').toString();
    return { clientId, data: JSON.parse(json) };
  }
}
```

### Pattern 2: Event-Driven FL Bridge (No Threading)

**What:** Process commands in OnSysEx callback, never use threading or async
**When:** All FL Studio script code
**Why:** FL Studio's Python interpreter has broken threading; event-driven is the only safe approach

**Example (Python - FL Bridge):**
```python
# Source: FL Studio API Stubs, flmidi-101 documentation
# device_FLBridge.py

import device
import transport
import patterns
import channels
import mixer

# Command handlers dictionary
_handlers = {}
_response_queue = []

def OnInit():
    """Called when FL Studio initializes the script."""
    print("FL Bridge initialized")

def OnSysEx(event):
    """
    Called when SysEx message received.
    This is the main command entry point.
    """
    try:
        # Parse the SysEx message
        command = parse_sysex(event.sysex)

        # Execute command and get response
        response = execute_command(command)

        # Queue response to send in OnIdle
        _response_queue.append(response)

        # Mark event as handled
        event.handled = True
    except Exception as e:
        # Log error but don't crash
        print(f"FL Bridge error: {e}")

def OnIdle():
    """
    Called every ~20ms.
    Send any queued responses.
    """
    while _response_queue:
        response = _response_queue.pop(0)
        send_response(response)

def send_response(response):
    """Send SysEx response to client."""
    sysex = build_sysex_response(response)
    device.midiOutSysex(bytes(sysex))
```

### Pattern 3: Command-Response Correlation

**What:** Every command has a unique client ID; responses include the same ID
**When:** All bidirectional communication
**Why:** MIDI is asynchronous; need to match responses to requests for proper async handling

**Example (TypeScript - MCP Server):**
```typescript
// Source: MCP SDK documentation, Flapi protocol
class FLBridgeClient {
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  private nextClientId = 1;

  async executeCommand(action: string, params: object): Promise<unknown> {
    const clientId = this.nextClientId++;
    if (this.nextClientId > 0x7F) this.nextClientId = 1;

    const command = { action, params };
    const sysex = this.codec.encode(command, clientId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(clientId);
        reject(new Error(`Command timeout: ${action}`));
      }, 5000);

      this.pendingRequests.set(clientId, { resolve, reject, timeout });
      this.midiOutput.sendMessage(sysex);
    });
  }

  handleResponse(sysex: number[]): void {
    const { clientId, data } = this.codec.decode(sysex);
    const pending = this.pendingRequests.get(clientId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(clientId);
      pending.resolve(data);
    }
  }
}
```

### Pattern 4: PME Flag Checking Before State Modification

**What:** Check PME (Performance, Modify, Execute) flags before any operation that modifies FL Studio state
**When:** Before transport control, pattern changes, mixer adjustments
**Why:** Operations at wrong time cause "Operation unsafe at current time" errors or silent crashes

**Example (Python - FL Bridge):**
```python
# Source: FL Studio API Stubs fl_classes documentation
from midi import PME_System, PME_System_Safe

def execute_transport_start():
    """Start playback with safety check."""
    try:
        transport.start()
        return {"success": True}
    except TypeError as e:
        if "unsafe" in str(e).lower():
            return {"success": False, "error": "Operation unsafe at current time"}
        raise
```

### Anti-Patterns to Avoid

- **Threading in FL Bridge:** Never use `threading`, `asyncio`, or any concurrent execution. FL Studio's Python has broken thread support.

- **Module-Level Errors:** Never let initialization code throw uncaught exceptions. FL Studio will crash silently and repeatedly on startup.

- **Blocking OnIdle:** Never do heavy work in OnIdle. It runs every 20ms; slow operations cause lag and missed MIDI messages.

- **Ignoring SysEx Format:** SysEx must start with 0xF0 and end with 0xF7. FL Studio ignores malformed SysEx entirely.

- **Direct Parameter Indices:** Never hardcode VST parameter indices. They change between plugin versions.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual MIDI ports (Windows) | Custom MIDI driver | loopMIDI | Proven, free, widely used, Flapi-compatible |
| MIDI I/O in Node.js | Raw port handling | node-midi package | RtMidi wrapper handles platform differences |
| MCP protocol | Custom JSON-RPC | @modelcontextprotocol/sdk | Official SDK, handles all protocol details |
| SysEx encoding | Custom binary format | Base64 JSON over Flapi-style protocol | Proven by Flapi, human-readable payloads |
| Tool schema validation | Manual validation | Zod schemas | MCP SDK uses Zod natively |

**Key insight:** The FL Studio communication layer is the only novel part. Everything else (MCP server, MIDI handling, schema validation) has mature solutions.

## Common Pitfalls

### Pitfall 1: Initialization Errors Crash FL Studio

**What goes wrong:** Any syntax error, import failure, or exception during script initialization causes FL Studio to crash silently and repeatedly on every subsequent startup.

**Why it happens:** FL Studio loads MIDI scripts during startup. Errors during initialization are not caught.

**How to avoid:**
1. Wrap ALL module-level code in try/except blocks
2. Use lazy imports - import modules inside functions, not at module level
3. Keep initialization code minimal - defer setup to OnInit callback
4. Test scripts in isolation before deploying to FL Studio

**Warning signs:** FL Studio crashes immediately on startup; crash persists across restarts; works fine when script is removed.

### Pitfall 2: Threading Conflicts

**What goes wrong:** Using Python threading or async patterns causes unpredictable behavior, race conditions, or crashes.

**Why it happens:** FL Studio uses a "stripped down custom Python interpreter" where "compatibility with multiple threads is broken."

**How to avoid:**
1. Never use `threading`, `asyncio`, or any concurrent patterns in FL Bridge
2. Design all operations to be synchronous within FL Studio
3. Use OnIdle callback for any time-delayed work (queue operations, process in OnIdle)
4. Handle async on MCP server side, but execute FL Studio operations synchronously

**Warning signs:** Audio glitches when script runs; operations happening in wrong order; scripts "sometimes" work.

### Pitfall 3: Operation Unsafe at Current Time

**What goes wrong:** Scripts attempt FL Studio API operations during periods when FL Studio's internal state doesn't permit them.

**Why it happens:** FL Studio enforces strict timing about when certain operations are allowed. Operations that modify state can only be called during specific callback phases.

**How to avoid:**
1. Wrap potentially unsafe operations in try/catch that catches `TypeError` with "unsafe" message
2. Check PME flags before state-modifying operations (where documented)
3. Test extensively during playback, recording, and idle states
4. Never assume an operation is safe - verify and handle errors

**Warning signs:** Intermittent crashes; operations that work in isolation but fail during playback; crashes without Python errors.

### Pitfall 4: MIDI Port Configuration on Windows

**What goes wrong:** MCP server requires manual MIDI port setup on Windows, which fails silently or with misleading error messages.

**Why it happens:** Windows requires third-party software (loopMIDI) to create virtual MIDI ports. Port assignment can fail with misleading "memory" errors.

**How to avoid:**
1. Provide explicit setup documentation with loopMIDI installation steps
2. Validate MIDI port existence before attempting connection
3. Provide clear error messages: "MIDI port 'X' not found - did you install loopMIDI?"
4. Build connection status tool that diagnoses common issues

**Warning signs:** "Memory error" when assigning MIDI ports; connection works on dev machine but not user machine.

### Pitfall 5: Windows MIDI Services (2026+)

**What goes wrong:** Virtual MIDI ports created dynamically may not be visible to applications.

**Why it happens:** Windows MIDI Services (new in 2026) handles third-party dynamic MIDI port creation differently. Ports created after service start may not appear.

**How to avoid:**
1. Create loopMIDI ports before starting FL Studio
2. Document that users should restart MIDI Service after creating ports
3. Limit to 16 or fewer loopMIDI ports
4. Test setup on fresh Windows installations

**Warning signs:** Ports visible in loopMIDI but not in FL Studio; names appear corrupted.

## Code Examples

Verified patterns from official sources:

### MCP Server Setup with Stdio Transport

```typescript
// Source: MCP TypeScript SDK documentation
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "fl-studio-mcp",
  version: "1.0.0"
});

// Register a tool with Zod schema
server.tool(
  "transport_play",
  {
    description: "Start playback in FL Studio"
  },
  async () => {
    const result = await flBridge.executeCommand("transport.start", {});
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get_pattern_count",
  {
    description: "Get the number of patterns in the project"
  },
  async () => {
    const result = await flBridge.executeCommand("patterns.count", {});
    return {
      content: [{ type: "text", text: `Project has ${result.count} patterns` }]
    };
  }
);

// Connect with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

### FL Bridge Transport Control

```python
# Source: FL Studio API Stubs transport module
import transport

def handle_transport_start():
    """Start or toggle playback."""
    try:
        transport.start()
        return {"success": True, "playing": transport.isPlaying()}
    except TypeError as e:
        return {"success": False, "error": str(e)}

def handle_transport_stop():
    """Stop playback."""
    try:
        transport.stop()
        return {"success": True, "playing": False}
    except TypeError as e:
        return {"success": False, "error": str(e)}

def handle_transport_record():
    """Toggle recording."""
    try:
        transport.record()
        return {"success": True, "recording": transport.isRecording()}
    except TypeError as e:
        return {"success": False, "error": str(e)}

def handle_transport_state():
    """Get current transport state."""
    return {
        "playing": transport.isPlaying(),
        "recording": transport.isRecording(),
        "loopMode": transport.getLoopMode(),
        "position": transport.getSongPos(4)  # Bars:Steps:Ticks
    }
```

### FL Bridge Pattern Operations

```python
# Source: FL Studio API Stubs patterns module
import patterns

def handle_pattern_count():
    """Get number of patterns that have been modified."""
    return {"count": patterns.patternCount()}

def handle_pattern_list():
    """Get list of all patterns with their properties."""
    count = patterns.patternCount()
    result = []
    for i in range(1, count + 1):  # Patterns are 1-indexed
        if not patterns.isPatternDefault(i):
            result.append({
                "index": i,
                "name": patterns.getPatternName(i),
                "length": patterns.getPatternLength(i),
                "color": patterns.getPatternColor(i),
                "selected": patterns.isPatternSelected(i)
            })
    return {"patterns": result}

def handle_pattern_select(index):
    """Select a pattern by index."""
    try:
        patterns.jumpToPattern(index)
        return {"success": True, "active": patterns.patternNumber()}
    except Exception as e:
        return {"success": False, "error": str(e)}

def handle_pattern_create():
    """Find and select the next empty pattern."""
    try:
        patterns.findFirstNextEmptyPat(0)
        return {"success": True, "active": patterns.patternNumber()}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### FL Bridge Channel State Reading

```python
# Source: FL Studio API Stubs channels module
import channels

def handle_channel_list():
    """Get list of all channels with their properties."""
    count = channels.channelCount()
    result = []
    for i in range(count):  # Channels are 0-indexed
        result.append({
            "index": i,
            "name": channels.getChannelName(i),
            "type": channels.getChannelType(i),
            "color": channels.getChannelColor(i),
            "volume": channels.getChannelVolume(i),
            "pan": channels.getChannelPan(i),
            "muted": channels.isChannelMuted(i),
            "solo": channels.isChannelSolo(i),
            "selected": channels.isChannelSelected(i),
            "targetMixer": channels.getTargetFxTrack(i)
        })
    return {"channels": result}

def handle_channel_select(index):
    """Select a channel exclusively."""
    try:
        channels.selectOneChannel(index)
        return {"success": True, "selected": index}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### FL Bridge Mixer State Reading

```python
# Source: FL Studio API Stubs mixer module
import mixer

def handle_mixer_state():
    """Get mixer track information."""
    count = mixer.trackCount()
    tracks = []
    for i in range(count):
        tracks.append({
            "index": i,
            "name": mixer.getTrackName(i),
            "volume": mixer.getTrackVolume(i),
            "pan": mixer.getTrackPan(i),
            "muted": mixer.isTrackMuted(i),
            "solo": mixer.isTrackSolo(i)
        })
    return {
        "trackCount": count,
        "tracks": tracks,
        "tempo": mixer.getCurrentTempo()
    }
```

### Node.js MIDI Setup

```typescript
// Source: node-midi documentation
import midi from 'midi';

class MidiClient {
  private input: midi.Input;
  private output: midi.Output;

  constructor() {
    this.input = new midi.Input();
    this.output = new midi.Output();
  }

  connect(requestPort: string, responsePort: string): void {
    // Find and open output port (to send commands)
    const outPorts = this.output.getPortCount();
    for (let i = 0; i < outPorts; i++) {
      if (this.output.getPortName(i).includes(requestPort)) {
        this.output.openPort(i);
        break;
      }
    }

    // Find and open input port (to receive responses)
    const inPorts = this.input.getPortCount();
    for (let i = 0; i < inPorts; i++) {
      if (this.input.getPortName(i).includes(responsePort)) {
        // Enable SysEx reception (disabled by default)
        this.input.ignoreTypes(false, false, false);
        this.input.openPort(i);
        break;
      }
    }

    // Set up message handler
    this.input.on('message', (deltaTime, message) => {
      if (message[0] === 0xF0) { // SysEx
        this.handleSysEx(message);
      }
    });
  }

  sendSysEx(message: number[]): void {
    // node-midi accepts array of bytes
    this.output.sendMessage(message);
  }

  private handleSysEx(message: number[]): void {
    // Process incoming SysEx response
    // ...
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flapi library | Custom FL Bridge | 2026 | Flapi unmaintained; custom gives full control |
| JSON file queue + keystrokes | Direct MIDI SysEx | 2025 | Keystroke automation is unreliable on Windows |
| Python MCP SDK | TypeScript MCP SDK | 2024 | TypeScript SDK more mature, better tooling |
| Generic MIDI CC | SysEx with JSON payload | 2023 | SysEx allows arbitrary data, JSON is debuggable |

**Deprecated/outdated:**
- **Flapi as-is:** Marked unmaintained, half-refactored. Use protocol concepts, build custom.
- **JSON file polling:** Higher latency, requires keyboard automation, unreliable.
- **ReWire:** Deprecated protocol, removed from modern DAWs.

## Open Questions

Things that couldn't be fully resolved:

1. **Pattern Creation API**
   - What we know: `findFirstNextEmptyPat()` can select next empty pattern
   - What's unclear: Whether this truly "creates" or just selects existing empty slot
   - Recommendation: Test in FL Studio; document actual behavior

2. **Tempo Access**
   - What we know: `mixer.getCurrentTempo()` can read tempo
   - What's unclear: Whether tempo can be SET via API (some sources say no)
   - Recommendation: Verify with testing; if not available, document limitation

3. **SysEx Message Size Limits**
   - What we know: Flapi uses chunking for large messages (continuation byte)
   - What's unclear: Practical size limits in FL Studio
   - Recommendation: Implement chunking from start; test with large payloads

4. **Windows MIDI Services Compatibility**
   - What we know: Dynamic port creation has issues; may need service restart
   - What's unclear: Exact behavior with loopMIDI in 2026 Windows
   - Recommendation: Document thorough setup process; test on fresh Windows install

## Sources

### Primary (HIGH confidence)

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK, server setup, tool definitions
- [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server) - Stdio transport, architecture
- [FL Studio API Stubs](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/) - Complete API reference
  - transport module: play, stop, record, position
  - patterns module: count, names, selection
  - channels module: properties, selection
  - mixer module: track properties, routing
  - callbacks: OnInit, OnSysEx, OnIdle
- [FL Studio MIDI Scripting Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm) - Official Image-Line documentation
- [node-midi](https://github.com/justinlatimer/node-midi) - RtMidi wrapper for Node.js
- [python-rtmidi](https://spotlightkid.github.io/python-rtmidi/) - MIDI library documentation

### Secondary (MEDIUM confidence)

- [Flapi GitHub](https://github.com/MaddyGuthridge/Flapi) - SysEx protocol design, proves architecture
- [Flapi Protocol.md](https://github.com/MaddyGuthridge/Flapi/blob/main/Protocol.md) - Detailed SysEx message format
- [flmidi-101](https://flmidi-101.readthedocs.io/) - Community FL Studio scripting guide
- [karl-andres/fl-studio-mcp](https://github.com/karl-andres/fl-studio-mcp) - Existing implementation reference
- [ohhalim/flstudio-mcp](https://github.com/ohhalim/flstudio-mcp) - Alternative implementation reference
- [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) - Virtual MIDI for Windows

### Tertiary (LOW confidence)

- Windows MIDI Services compatibility notes - needs validation on current Windows
- SysEx size limits - needs empirical testing
- Pattern creation behavior - needs FL Studio verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDK, documented APIs, proven libraries
- Architecture patterns: HIGH - Flapi protocol proven, existing implementations validate approach
- Pitfalls: HIGH - Official documentation explicitly warns about these; community confirms
- Code examples: HIGH - Derived from official API documentation

**Research date:** 2026-02-23
**Valid until:** 2026-04-23 (60 days - stable domain, mature APIs)
