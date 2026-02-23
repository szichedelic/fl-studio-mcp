# Architecture Patterns: FL Studio MCP Server

**Domain:** DAW Integration / MCP Server for FL Studio
**Researched:** 2026-02-23
**Confidence:** MEDIUM (verified architecture patterns, but FL Studio API gaps exist)

## Executive Summary

Building an MCP server for FL Studio requires a multi-layer architecture that bridges three distinct systems: Claude (via MCP protocol), the MCP server, and FL Studio. The critical challenge is that FL Studio doesn't expose a traditional external API - it uses an internal Python scripting system designed for MIDI controllers.

The recommended architecture uses a **bridge pattern** similar to the proven AbletonOSC/ableton-osc-mcp approach, but adapted for FL Studio's MIDI Controller Scripting API. This requires:
1. A Python script running inside FL Studio (the "FL Bridge")
2. Communication over virtual MIDI ports (loopMIDI on Windows)
3. A TypeScript/Node.js MCP server translating between MCP tools and FL Studio commands

## Recommended Architecture

```
+------------------+     MCP/JSON-RPC      +------------------+     Virtual MIDI     +------------------+
|                  |        (stdio)        |                  |      (loopMIDI)      |                  |
|   Claude Code    | <------------------> |   MCP Server     | <------------------> |   FL Studio      |
|   (MCP Client)   |                      |   (TypeScript)   |                      |   + FL Bridge    |
|                  |                      |                  |                      |   (Python)       |
+------------------+                      +------------------+                      +------------------+
                                                 ^
                                                 |
                                          Tool Definitions
                                          (Zod schemas)
```

### Data Flow

**Request Flow (Claude -> FL Studio):**
1. Claude sends tool call via MCP protocol (JSON-RPC over stdio)
2. MCP Server receives tool call, validates with Zod
3. MCP Server encodes command as MIDI SysEx message
4. Message sent to "FL Request" virtual MIDI port
5. FL Bridge (Python script inside FL Studio) receives message
6. FL Bridge decodes and executes FL Studio API calls
7. FL Bridge sends response to "FL Response" virtual MIDI port
8. MCP Server receives response, formats as MCP tool result
9. Claude receives result

**Response Flow (FL Studio -> Claude):**
- Same path in reverse for read operations
- Uses structured response format (JSON encoded in SysEx)

## Component Boundaries

| Component | Responsibility | Technology | Communicates With |
|-----------|---------------|------------|-------------------|
| **MCP Server** | MCP protocol handling, tool definitions, command encoding/decoding | TypeScript/Node.js | Claude (stdio), FL Bridge (MIDI) |
| **FL Bridge** | FL Studio API execution, MIDI message handling, state reading | Python (FL Studio embedded) | MCP Server (MIDI), FL Studio APIs |
| **Virtual MIDI Ports** | Bidirectional IPC between MCP Server and FL Bridge | loopMIDI (Windows) | MCP Server, FL Bridge |
| **Tool Definitions** | Schema for all MCP tools exposed to Claude | Zod schemas | MCP Server |

### Component Details

#### 1. MCP Server (TypeScript)

**Purpose:** Bridge between MCP protocol and FL Studio
**Location:** Standalone Node.js process
**Key Responsibilities:**
- Implement MCP server protocol (stdio transport)
- Define tools using Zod schemas
- Encode commands into MIDI SysEx messages
- Decode responses from FL Bridge
- Handle timeouts and error recovery

**Key Files:**
```
src/
  index.ts              # Entry point, MCP server setup
  tools/                # Tool definitions
    piano-roll.ts       # Note creation/manipulation tools
    patterns.ts         # Pattern management tools
    mixer.ts            # Mixer control tools
    transport.ts        # Playback control tools
    plugins.ts          # Plugin parameter control tools
  bridge/
    midi-client.ts      # MIDI communication layer
    message-codec.ts    # SysEx encoding/decoding
    connection.ts       # Connection management
  types/
    fl-studio.ts        # FL Studio domain types
```

#### 2. FL Bridge (Python)

**Purpose:** Execute commands inside FL Studio's Python environment
**Location:** FL Studio Hardware scripts folder
**Key Responsibilities:**
- Listen for MIDI messages on request port
- Decode SysEx messages into commands
- Execute FL Studio API calls (channels, patterns, mixer, etc.)
- Read project state
- Encode responses as SysEx
- Handle Piano Roll operations

**Key Files:**
```
fl-bridge/
  device_FLBridge.py       # Main entry point (FL Studio naming convention)
  handlers/
    piano_roll.py          # Note operations
    patterns.py            # Pattern operations
    mixer.py               # Mixer operations
    transport.py           # Transport operations
    plugins.py             # Plugin operations
  protocol/
    message.py             # SysEx message parsing
    response.py            # Response encoding
  utils/
    state.py               # Project state reading
```

#### 3. Virtual MIDI Ports

**Purpose:** IPC between MCP Server and FL Bridge
**Implementation:** loopMIDI (Windows free tool)
**Configuration:**
- Port 1: "FL MCP Request" (MCP Server -> FL Bridge)
- Port 2: "FL MCP Response" (FL Bridge -> MCP Server)

## FL Studio API Capabilities

Based on official Image-Line documentation, here are the available APIs:

### MIDI Controller Scripting API (Primary)

| Module | Capabilities | Limitations |
|--------|-------------|-------------|
| **channels** | Trigger notes, quantize, get/set properties | Cannot directly add notes to patterns |
| **patterns** | Get/set name, color, length, count | Read-only note data |
| **mixer** | Track properties, EQ, routing, effects | Some parameters read-only |
| **transport** | Play, stop, record, tempo, position | Full control |
| **playlist** | Track management, clips | Limited clip manipulation |
| **ui** | Window focus, navigation | UI automation only |
| **arrangement** | Markers, time selection | Limited |
| **plugins** | Parameter access via events | Requires parameter discovery |

### Piano Roll Scripting API (Secondary)

| Object | Capabilities | Limitations |
|--------|-------------|-------------|
| **score** | Add/remove notes, markers, clear | Only works when piano roll is open |
| **Note** | All properties (pitch, time, velocity, etc.) | Clone and modify pattern |

**Critical Finding:** Piano Roll Scripting only works when the piano roll is open for a pattern. This is a significant constraint for automated note creation.

### Plugin Parameter Control

For Serum 2 and Addictive Drums 2:
- Parameters must be "linked" in FL Studio first
- Control via `plugins` module using event IDs
- Real-time automation possible via MIDI CC

## Communication Protocol

### SysEx Message Format

Using MIDI SysEx for arbitrary data transfer:

```
SysEx Start: 0xF0
Manufacturer ID: 0x7D (non-commercial/educational)
Message Type: 1 byte (0x01 = command, 0x02 = response)
Message ID: 2 bytes (for request/response correlation)
Payload Length: 2 bytes
Payload: JSON encoded, 7-bit safe
Checksum: 1 byte
SysEx End: 0xF7
```

**Rationale:** SysEx allows arbitrary-length messages (unlike CC/Note), enables JSON payloads, and works with FL Studio's MIDI scripting.

### Message Types

**Commands (MCP Server -> FL Bridge):**
```json
{
  "type": "command",
  "id": "uuid",
  "action": "piano_roll.add_notes",
  "params": {
    "pattern": 1,
    "channel": 0,
    "notes": [
      {"pitch": 60, "time": 0, "length": 96, "velocity": 100}
    ]
  }
}
```

**Responses (FL Bridge -> MCP Server):**
```json
{
  "type": "response",
  "id": "uuid",
  "success": true,
  "data": { ... }
}
```

## Patterns to Follow

### Pattern 1: Command-Response Correlation

**What:** Every command gets a unique ID; responses include that ID
**When:** All FL Bridge communications
**Why:** MIDI is asynchronous; need to match responses to requests

```typescript
// MCP Server
async function executeCommand(action: string, params: object): Promise<Result> {
  const id = crypto.randomUUID();
  const command = { type: 'command', id, action, params };

  await midiClient.send(encodeToSysEx(command));

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, timeout: setTimeout(...) });
  });
}
```

### Pattern 2: State Snapshot Before Mutation

**What:** Read current state before making changes
**When:** Any operation that modifies project state
**Why:** Enables undo context, validation, and conflict detection

```typescript
// Tool definition
server.registerTool("add_melody", {
  description: "Add a melody to the current pattern",
  inputSchema: { ... },
}, async (params) => {
  // 1. Get current state
  const currentPattern = await flBridge.getPattern(params.pattern);
  const existingNotes = await flBridge.getNotes(params.pattern, params.channel);

  // 2. Validate against existing state
  if (hasConflicts(existingNotes, params.notes)) {
    return { error: "Notes would overlap with existing melody" };
  }

  // 3. Execute mutation
  return await flBridge.addNotes(params.pattern, params.channel, params.notes);
});
```

### Pattern 3: Graceful Degradation

**What:** Provide fallback behaviors when optimal approach isn't available
**When:** Piano Roll operations (requires open piano roll)
**Why:** FL Studio API has context-dependent limitations

```python
# FL Bridge
def add_notes(pattern_id, channel_id, notes):
    # Try Piano Roll API first (best quality)
    if is_piano_roll_open(pattern_id, channel_id):
        return add_notes_via_score(notes)

    # Fallback: use MIDI note triggering + recording
    # (requires transport to be in record mode)
    return add_notes_via_recording(notes)
```

### Pattern 4: Tool Composition

**What:** Complex operations built from simple tool primitives
**When:** High-level musical operations ("write a chord progression")
**Why:** Claude handles composition; MCP server handles atomic operations

```typescript
// Expose atomic tools
"pattern.create"
"pattern.set_length"
"channel.select"
"notes.add"
"notes.humanize"

// Claude composes:
// 1. Create pattern
// 2. Set length to 4 bars
// 3. Select piano channel
// 4. Add chord notes
// 5. Humanize timing
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking MIDI Operations

**What:** Waiting synchronously for MIDI responses
**Why bad:** MIDI is unreliable; FL Studio may not respond; deadlocks
**Instead:** Use async/await with timeouts and retry logic

### Anti-Pattern 2: Exposing FL Studio API Directly

**What:** Mapping MCP tools 1:1 to FL Studio API functions
**Why bad:** FL API is low-level, verbose, context-dependent
**Instead:** Create musical-intent tools ("add_chord", "humanize_pattern")

### Anti-Pattern 3: Stateless Operations

**What:** Assuming each command is independent
**Why bad:** FL Studio state affects what operations are valid
**Instead:** Maintain state cache, validate before mutations

### Anti-Pattern 4: Large SysEx Messages

**What:** Sending entire arrangements in single messages
**Why bad:** MIDI SysEx has practical limits; buffer overflows
**Instead:** Chunk large operations; use streaming for reads

## Build Order (Dependencies)

Based on component dependencies, the recommended build order is:

### Phase 1: Foundation (Week 1-2)
**Build:** Virtual MIDI communication layer
**Why First:** All other components depend on this
**Components:**
- loopMIDI setup and configuration
- MCP Server: MIDI client with send/receive
- FL Bridge: Basic MIDI message handler
- Test: Bidirectional message passing

### Phase 2: Core Protocol (Week 2-3)
**Build:** SysEx encoding/decoding + command protocol
**Why Second:** Needed before any FL Studio integration
**Components:**
- Message codec (JSON <-> SysEx)
- Command/response correlation
- Error handling and timeouts
- Test: Round-trip JSON messages

### Phase 3: FL Studio Read Operations (Week 3-4)
**Build:** Project state reading
**Why Third:** Safer than writes; validates API understanding
**Components:**
- FL Bridge: State reading handlers
- MCP Server: Read-only tools (get_patterns, get_mixer_state)
- Test: Read real FL Studio project data

### Phase 4: Transport Control (Week 4)
**Build:** Play/stop/record/tempo
**Why Fourth:** Simple writes, immediate feedback
**Components:**
- FL Bridge: Transport handlers
- MCP Server: Transport tools
- Test: Control playback from Claude

### Phase 5: Pattern/Note Writing (Week 5-6)
**Build:** Note creation and manipulation
**Why Fifth:** Core creative functionality
**Components:**
- FL Bridge: Piano roll handlers
- MCP Server: Note creation tools
- Humanization algorithms
- Test: Create melodies from natural language

### Phase 6: Plugin Control (Week 6-7)
**Build:** Serum 2, Addictive Drums 2 parameter control
**Why Sixth:** Requires understanding of parameter discovery
**Components:**
- FL Bridge: Plugin parameter handlers
- MCP Server: Plugin control tools
- Test: Tweak synth parameters from Claude

### Phase 7: Mixer/Routing (Week 7-8)
**Build:** Sidechain, buses, effects chains
**Why Seventh:** Complex routing requires solid foundation
**Components:**
- FL Bridge: Mixer routing handlers
- MCP Server: Routing tools
- Test: Set up sidechain from natural language

## Critical Architecture Decisions

### Decision 1: MIDI vs. Other IPC

**Options Considered:**
- MIDI SysEx (chosen)
- Named pipes
- TCP sockets
- Shared memory

**Decision:** MIDI SysEx
**Rationale:**
- FL Studio's Python environment can access MIDI but not network/filesystem
- MIDI is the only reliable IPC available inside FL Studio
- loopMIDI is stable and widely used
- SysEx allows arbitrary data transfer

### Decision 2: Flapi vs. Custom Bridge

**Options Considered:**
- Use Flapi (existing project)
- Build custom FL Bridge

**Decision:** Build custom FL Bridge
**Rationale:**
- Flapi is unmaintained (stated on GitHub)
- Flapi uses function call forwarding (complex, fragile)
- Custom bridge allows purpose-built message protocol
- More control over error handling and recovery

### Decision 3: TypeScript vs. Python for MCP Server

**Options Considered:**
- TypeScript/Node.js (chosen)
- Python

**Decision:** TypeScript
**Rationale:**
- Official MCP SDK is mature for TypeScript
- Better async/await patterns for MIDI timing
- Type safety with Zod for tool schemas
- Easier deployment (npm package)

## Open Questions / Research Flags

1. **Piano Roll Context:** Can we programmatically open a piano roll, or must we guide the user to open it?

2. **Plugin Parameter Discovery:** How do we enumerate available parameters for Serum 2 / AD2 without manual mapping?

3. **Timing Precision:** What's the actual latency through MIDI? Is it acceptable for real-time feedback?

4. **State Synchronization:** How do we detect when user makes manual changes in FL Studio?

5. **Error Recovery:** How do we handle FL Studio crashes or disconnects mid-operation?

## Sources

### HIGH Confidence (Official Documentation)
- [FL Studio MIDI Scripting Official Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm)
- [FL Studio Piano Roll Scripting API](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_scripting_api.htm)
- [FL Studio Python API Stubs (Official)](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server)

### MEDIUM Confidence (Verified Community Sources)
- [Flapi Project](https://github.com/MaddyGuthridge/Flapi) - Proves MIDI bridge concept
- [AbletonOSC MCP](https://github.com/nozomi-koborinai/ableton-osc-mcp) - Reference architecture
- [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) - Virtual MIDI for Windows
- [FL MIDI 101 Guide](https://flmidi-101.readthedocs.io/) - Community documentation

### LOW Confidence (WebSearch Only)
- Plugin parameter automation specifics (need hands-on verification)
- Exact SysEx size limits (need testing)
- Real-time latency characteristics (need benchmarking)
