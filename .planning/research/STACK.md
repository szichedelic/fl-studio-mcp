# Technology Stack

**Project:** FL Studio MCP Server
**Researched:** 2026-02-23
**Overall Confidence:** MEDIUM (FL Studio communication is the critical unknown with viable but imperfect solutions)

## Executive Summary

Building an MCP server for FL Studio requires solving a fundamental challenge: FL Studio has no official external API. The solution is a **hybrid architecture** using:

1. **TypeScript MCP server** - Handles Claude communication via stdio transport
2. **Python bridge** - Communicates with FL Studio via Flapi (SysEx over virtual MIDI)
3. **FL Studio MIDI Controller Script** - Receives commands and executes FL Studio API calls

This architecture is proven by existing implementations (karl-andres/fl-studio-mcp, calvinw/fl-studio-mcp) but has significant limitations.

---

## Recommended Stack

### MCP Server Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 20.x LTS | Runtime | Stable, well-supported by MCP SDK | HIGH |
| TypeScript | 5.5+ | Language | Type safety, MCP SDK is TypeScript-first | HIGH |
| @modelcontextprotocol/sdk | 1.26.x | MCP implementation | Official SDK, v2 expected Q1 2026 | HIGH |
| zod | 3.x | Schema validation | MCP SDK uses zod for tool input schemas | HIGH |

**Source:** [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [npm @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

### FL Studio Communication Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Python | 3.9-3.11 | FL Studio bridge | FL Studio uses Python 3.9.x internally; Flapi requires 3.9+ | HIGH |
| Flapi | 1.0.1 | FL Studio remote control | Only viable external API solution; uses SysEx over MIDI | MEDIUM |
| loopMIDI | Latest | Virtual MIDI ports (Windows) | Required for Flapi on Windows; creates "Flapi Request" and "Flapi Response" ports | HIGH |
| python-rtmidi | 1.5.x | MIDI communication | Required by Flapi for SysEx message passing | HIGH |

**Source:** [Flapi PyPI](https://pypi.org/project/flapi/), [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)

### FL Studio Internal Scripts

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| FL Studio MIDI Controller Script | Python 3.9 | Command execution | Runs inside FL Studio, accesses full API | HIGH |
| FL Studio Piano Roll Script | Python 3.9 | Note manipulation | .pyscript format for piano roll operations | HIGH |
| fl-studio-api-stubs | 24.x | Development support | Type hints and documentation for FL Studio API | HIGH |

**Source:** [FL Studio API Stubs](https://il-group.github.io/FL-Studio-API-Stubs/), [FL Studio MIDI Scripting](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm)

### Inter-Process Communication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| child_process (Node.js) | Built-in | Python subprocess management | Launch Python bridge from TypeScript MCP server | HIGH |
| JSON over stdin/stdout | N/A | TypeScript-Python IPC | Simple, reliable serialization between processes | HIGH |

---

## FL Studio Communication: Critical Architecture Decision

### The Core Problem

FL Studio does NOT expose a traditional external API. The MIDI Controller Scripting API is designed for hardware controllers, not external software control. There is no TCP/HTTP server, no command-line interface, no pipe-based IPC.

### The Solution: Flapi + Virtual MIDI

**How it works:**
1. MCP server receives tool call from Claude
2. MCP server sends command to Python bridge via stdin/stdout
3. Python bridge uses Flapi to send SysEx MIDI message via virtual MIDI port
4. FL Studio's MIDI Controller Script receives SysEx, parses command
5. Script executes FL Studio API calls
6. Response returns via same SysEx pathway

**Why Flapi:**
- Only viable solution for external control (beyond piano roll scripts)
- Uses SysEx messages which can carry arbitrary data
- Maintained community project (though marked "unmaintained" with half-finished refactor)
- Proven architecture used by existing FL Studio MCP implementations

**Source:** [Flapi GitHub](https://github.com/MaddyGuthridge/Flapi), [karl-andres/fl-studio-mcp](https://github.com/karl-andres/fl-studio-mcp)

### Alternative Considered: Direct JSON File Queue

Some implementations (calvinw/fl-studio-mcp) use JSON file queues with keystroke triggers instead of Flapi:
- Write commands to JSON file
- Send keystroke (Ctrl+Alt+Y) to trigger FL Studio script
- Script reads JSON, executes, writes response

**Why NOT recommended:**
- Requires accessibility permissions for keystroke automation
- Fragile on Windows (unreliable keystroke delivery)
- Higher latency (file I/O + keystroke delay)
- Less elegant than direct MIDI communication

---

## FL Studio API Capabilities

### What CAN Be Controlled (via MIDI Controller Scripting API)

| Module | Capabilities | Confidence |
|--------|--------------|------------|
| **transport** | Play/pause/stop, song position, loop mode, playback speed (0.25x-4x) | HIGH |
| **mixer** | Volume, pan, mute, solo, track names, colors, routing | HIGH |
| **channels** | Channel selection, properties, MIDI note triggering, step sequencer | HIGH |
| **plugins** | Get/set 4096 parameters (0.0-1.0), preset navigation, plugin info | HIGH |
| **patterns** | Pattern selection, properties, groups | HIGH |
| **playlist** | Track manipulation, performance mode | HIGH |
| **ui** | Window navigation, hints, dialogs | HIGH |

**Source:** [FL Studio API Stubs - MIDI Controller Scripting](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/)

### What CAN Be Controlled (via Piano Roll Scripting API)

| Capability | Details | Confidence |
|------------|---------|------------|
| **Note creation** | Full control: number (MIDI), time (ticks), length, velocity, pan | HIGH |
| **Humanization** | pitchofs (cents), fcut, fres, release, slide, porta | HIGH |
| **Note manipulation** | Clone, delete, modify, select | HIGH |
| **Markers** | Create and manipulate piano roll markers | HIGH |

**Source:** [FL Studio API Stubs - Piano Roll Scripting](https://il-group.github.io/FL-Studio-API-Stubs/piano_roll_scripting/flpianoroll/)

### What CANNOT Be Controlled

| Limitation | Impact | Workaround |
|------------|--------|------------|
| **Cannot load new plugins** | User must pre-load VSTs before automation | Document in workflow |
| **Cannot create new patterns** | Limited to existing patterns | Create patterns manually first |
| **No tempo/BPM access** | Cannot read or set project tempo | User must set tempo manually |
| **No time signature access** | Cannot read or set time signature | User must set manually |
| **Piano roll scripts can't be called externally** | MIDI scripts and piano roll scripts are separate | Two-script architecture |

**Source:** [karl-andres/fl-studio-mcp limitations](https://github.com/karl-andres/fl-studio-mcp)

---

## VST Plugin Control

### Serum 2 Control

| Approach | How | Confidence |
|----------|-----|------------|
| **FL Studio plugins module** | `plugins.setParamValue(index, slotIndex, paramIndex, value)` | HIGH |
| **Parameter range** | 4096 parameters available (0.0-1.0 normalized) | HIGH |
| **MIDI CC mapping** | Serum supports MIDI Learn for any parameter | MEDIUM |
| **Preset navigation** | `plugins.nextPreset()` / `plugins.prevPreset()` | HIGH |

**Note:** Parameter indices must be discovered empirically or via Serum's MIDI mapping documentation.

**Source:** [FL Studio plugins module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/), [Serum MIDI Mapping](https://xferrecords.com/forums/general/serum-midi-mapping-general)

### Addictive Drums 2 Control

| Approach | How | Confidence |
|----------|-----|------------|
| **MIDI note triggering** | Use channels module to send MIDI notes to AD2 | HIGH |
| **Velocity control** | Velocity values 0-127 control dynamics | HIGH |
| **Kit piece selection** | MIDI note mapping (kick=C1, snare=D1, etc.) | HIGH |
| **Parameter control** | Via FL Studio plugins module | MEDIUM |

**Source:** [Addictive Drums 2 MIDI Mapping](https://support.xlnaudio.com/hc/en-us/articles/16593408783389-MIDI-Mapping-Window)

---

## Development Dependencies

### Node.js / TypeScript

```bash
# Core
npm install @modelcontextprotocol/sdk@^1.26.0
npm install zod@^3

# Dev dependencies
npm install -D typescript@^5.5
npm install -D @types/node
```

### Python (FL Studio Bridge)

```bash
pip install flapi>=1.0.1
pip install python-rtmidi>=1.5.0
```

### FL Studio Scripts

```bash
# Install API stubs for development
pip install fl-studio-api-stubs>=24.0.0
```

---

## Project Structure Recommendation

```
fl-studio-mcp/
├── src/                          # TypeScript MCP server
│   ├── index.ts                  # Entry point, MCP server setup
│   ├── tools/                    # MCP tool definitions
│   │   ├── transport.ts          # Play, stop, position
│   │   ├── piano-roll.ts         # Note manipulation
│   │   ├── mixer.ts              # Mixer control
│   │   ├── plugins.ts            # VST parameter control
│   │   └── channels.ts           # Channel rack
│   └── bridge/                   # Python IPC
│       └── client.ts             # Subprocess management
├── python/                       # Python bridge
│   └── bridge.py                 # Flapi communication
├── fl-scripts/                   # FL Studio scripts
│   ├── device_FLStudioMCP.py     # MIDI Controller Script
│   └── ComposeWithLLM.pyscript   # Piano Roll Script
├── package.json
├── tsconfig.json
└── README.md
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| MCP SDK | TypeScript | Python | TypeScript has better ecosystem, official examples |
| FL Communication | Flapi | JSON file queue | More reliable, lower latency, no keystroke automation |
| FL Communication | Flapi | Protocol reverse-engineering | Flapi already does this; no need to reinvent |
| Virtual MIDI (Windows) | loopMIDI | rtpMIDI | loopMIDI is simpler, Flapi documentation recommends it |
| IPC | stdin/stdout JSON | WebSocket | Simpler, no port management, works with MCP stdio transport |

---

## Installation Requirements

### Windows

1. **loopMIDI** - Download and install from [tobias-erichsen.de](https://www.tobias-erichsen.de/software/loopmidi.html)
   - Create two ports: "Flapi Request" and "Flapi Response"

2. **FL Studio 20.7+** - MIDI Controller Scripting requires 20.7 or later

3. **Python 3.9-3.11** - Match FL Studio's internal Python version

4. **Node.js 20.x LTS** - For MCP server

### macOS

1. **IAC Driver** - Enable in Audio MIDI Setup (built-in)
   - Flapi creates virtual ports automatically

2. **FL Studio 20.7+**

3. **Python 3.9-3.11**

4. **Node.js 20.x LTS**

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Flapi is unmaintained | HIGH | Fork and maintain; architecture is sound, code is stable |
| FL Studio API changes | MEDIUM | Pin to known FL Studio version; API is stable |
| Virtual MIDI reliability | MEDIUM | Extensive testing; fallback to file queue if needed |
| Plugin parameter discovery | MEDIUM | Build parameter maps for Serum 2 and AD2 |
| Tempo/BPM limitation | LOW | Document manual setup; not critical for note generation |

---

## Sources

### Official Documentation
- [FL Studio MIDI Scripting Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm)
- [FL Studio API Stubs (Official)](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server)

### Community Resources
- [Flapi GitHub](https://github.com/MaddyGuthridge/Flapi) - FL Studio remote control
- [flmidi-101](https://flmidi-101.readthedocs.io/) - FL Studio MIDI scripting guide
- [karl-andres/fl-studio-mcp](https://github.com/karl-andres/fl-studio-mcp) - Existing MCP implementation
- [calvinw/fl-studio-mcp](https://github.com/calvinw/fl-studio-mcp) - Alternative implementation

### Package Registries
- [npm @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - v1.26.0
- [PyPI flapi](https://pypi.org/project/flapi/) - v1.0.1
- [PyPI fl-studio-api-stubs](https://pypi.org/project/fl-studio-api-stubs/)
- [PyPI python-rtmidi](https://pypi.org/project/python-rtmidi/)

---

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| **Python MCP SDK** | TypeScript SDK has better documentation, examples; Python adds complexity when already using Python for bridge |
| **WebSocket server** | MCP uses stdio transport; WebSocket adds unnecessary complexity |
| **HTTP server in FL Studio** | Not possible; FL Studio doesn't support network listeners in scripts |
| **Direct .flp file manipulation** | Dangerous; can corrupt projects; FL Studio must be running for real-time feedback |
| **OSC protocol** | FL Studio doesn't support OSC natively |
| **ReWire** | Deprecated; removed from modern DAWs |

---

## Version Pinning Recommendation

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
```

```
# Python requirements.txt
flapi>=1.0.1,<2.0.0
python-rtmidi>=1.5.0,<2.0.0
fl-studio-api-stubs>=24.0.0
```

**FL Studio:** Pin to 2025 version for stability. Test before upgrading.
