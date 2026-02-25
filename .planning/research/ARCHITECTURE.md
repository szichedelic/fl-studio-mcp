# Architecture Patterns: Production Pipeline (v2.0)

**Domain:** DAW Integration / FL Studio MCP Production Pipeline
**Researched:** 2026-02-23
**Milestone:** v2.0 Production Pipeline (humanization, Serum 2, audio rendering, sample manipulation)
**Confidence:** MEDIUM-HIGH (FL Studio API verified via official stubs; Serum 2 parameter specifics need hands-on testing)

## Executive Summary

The v2.0 Production Pipeline adds four major capability areas to the existing FL Studio MCP architecture: humanization, plugin parameter control (with Serum 2 as the primary target), audio rendering, and sample manipulation. Each area integrates differently with the existing bridge architecture, and some face hard constraints from FL Studio's Python API limitations.

**Key architectural finding:** Humanization should run entirely in Node.js (TypeScript) as a pre-processing step before notes reach FL Studio. Plugin control flows through the existing SysEx bridge with new Python handlers. Audio rendering has NO programmatic API -- it requires a UI-automation workaround or manual user step. Sample manipulation is best handled in Node.js using audio processing libraries, with FL Studio handling only the loading step.

## Existing Architecture (v1.0 Baseline)

```
+------------------+     MCP/JSON-RPC      +------------------+     SysEx/MIDI      +------------------+
|                  |        (stdio)         |                  |     (loopMIDI)      |                  |
|   Claude Code    | <------------------> |   MCP Server     | <------------------> |   FL Studio      |
|   (MCP Client)   |                      |   (TypeScript)   |                      |   + FL Bridge    |
|                  |                      |                  |                      |   (Python)       |
+------------------+                      +------------------+                      +------------------+
                                          |                  |
                                          | - Music theory   |
                                          | - Pyscript writer|
                                          | - Zod schemas    |
                                          +------------------+
```

### Current Components

| Component | Location | Technology | Role |
|-----------|----------|------------|------|
| MCP Server | `src/index.ts` | TypeScript/Node.js | MCP protocol, tool definitions |
| Bridge Connection | `src/bridge/` | TypeScript | MIDI client, SysEx codec, connection manager |
| Music Engine | `src/music/` | TypeScript (tonal) | Scales, chords, melody, bass generation |
| Tool Definitions | `src/tools/` | TypeScript (Zod) | transport, patterns, state, notes |
| Pyscript Writer | `src/music/pyscript-writer.ts` | TypeScript | Writes .pyscript with embedded note data |
| FL Bridge | `fl-bridge/device_FLBridge.py` | Python | SysEx listener, command router |
| Bridge Handlers | `fl-bridge/handlers/` | Python | transport, state, patterns, pianoroll |
| Protocol Layer | `fl-bridge/protocol/` | Python | SysEx parsing, command registration |

### Current Data Flows

**Note creation flow:**
1. Claude calls MCP tool (e.g., `create_chord_progression`)
2. MCP Server generates notes via music theory engine
3. Pyscript writer embeds note data as Python literals in `.pyscript` file
4. MCP Server sends `pianoroll.addNotes` command via SysEx to FL Bridge
5. FL Bridge opens piano roll, selects channel
6. User manually triggers ComposeWithBridge script in FL Studio

**State reading flow:**
1. Claude calls MCP tool (e.g., `get_channels`)
2. MCP Server sends command via SysEx
3. FL Bridge reads FL Studio state via Python API
4. FL Bridge sends response via SysEx
5. MCP Server returns result to Claude

---

## v2.1 Architecture: Mixer, Playlist & Project Controls

**Researched:** 2026-02-25
**Confidence:** HIGH for mixer/playlist track control, MEDIUM for project settings, LOW for pattern placement

### System Overview

```
                              v2.1 ARCHITECTURE
     +----------------------------------------------------------------------+
     |                        MCP Tool Layer                                 |
     |  +---------+  +----------+  +----------+  +---------+               |
     |  | mixer/  |  | playlist/|  | project/ |  |existing |               |
     |  | *.ts    |  | *.ts     |  | *.ts     |  | tools   |               |
     |  +----+----+  +----+-----+  +----+-----+  +----+----+               |
     |       |            |             |             |                     |
     +-------+------------+-------------+-------------+---------------------+
     |                     ConnectionManager (bridge/)                       |
     |                executeCommand(action, params) -> Promise<FLResponse>  |
     +----------------------------------------------------------------------+
     |                      SysEx Codec + MIDI Client                        |
     |                     loopMIDI bidirectional port                       |
     +----------------------------------------------------------------------+
                                    |
                                    | SysEx
                                    v
     +----------------------------------------------------------------------+
     |                        FL Bridge (Python)                             |
     |                     device_FLBridge.py                                |
     +----------------------------------------------------------------------+
     |  +-----------+  +------------+  +-----------+  +------------------+ |
     |  | mixer.py  |  | playlist.py|  | project.py|  | existing handlers| |
     |  | (NEW)     |  | (NEW)      |  | (NEW)     |  | transport,state, | |
     |  |           |  |            |  |           |  | patterns,plugins | |
     |  +-----+-----+  +-----+------+  +-----+-----+  +--------+---------+ |
     |        |              |               |                  |           |
     +--------+--------------+---------------+------------------+-----------+
     |                        FL Studio Python API                           |
     |  import mixer    import playlist    import general    import ui      |
     +----------------------------------------------------------------------+
                                    |
                                    v
     +----------------------------------------------------------------------+
     |                        FL Studio 2025                                 |
     |    +---------+    +----------+    +----------+                       |
     |    |  Mixer  |    | Playlist |    | Project  |                       |
     |    | Tracks  |    | Tracks   |    | Settings |                       |
     |    +---------+    +----------+    +----------+                       |
     +----------------------------------------------------------------------+
```

### New Python Handlers (fl-bridge/handlers/)

| Handler | Responsibility | FL Studio Module |
|---------|----------------|------------------|
| `mixer.py` (NEW) | Mixer track control: volume, pan, mute, solo, routing, EQ | `mixer` |
| `playlist.py` (NEW) | Playlist track management, pattern placement | `playlist` |
| `project.py` (NEW) | Tempo, time signature, markers, metronome | `general`, `transport`, `arrangement` |

### New TypeScript Tools (src/tools/)

| Module | Responsibility | Depends On |
|--------|----------------|------------|
| `mixer.ts` (NEW) | MCP tools for mixer control | `ConnectionManager` |
| `playlist.ts` (NEW) | MCP tools for arrangement | `ConnectionManager` |
| `project.ts` (NEW) | MCP tools for project settings | `ConnectionManager` |

### Modified Files

| File | Modification |
|------|--------------|
| `fl-bridge/handlers/__init__.py` | Import new handlers: mixer, playlist, project |
| `fl-bridge/device_FLBridge.py` | Import new handlers in OnInit() |
| `src/tools/index.ts` | Register new tool modules |

---

## Recommended Project Structure

```
fl-bridge/
+-- handlers/
|   +-- __init__.py        # Add imports: mixer, playlist, project
|   +-- transport.py       # (existing)
|   +-- state.py           # (existing) - has basic mixer/playlist read
|   +-- patterns.py        # (existing)
|   +-- pianoroll.py       # (existing)
|   +-- plugins.py         # (existing)
|   +-- mixer.py           # NEW: mixer track control handlers
|   +-- playlist.py        # NEW: playlist/arrangement handlers
|   +-- project.py         # NEW: project-level settings handlers
+-- device_FLBridge.py     # Add handler imports in OnInit()

src/tools/
+-- index.ts               # Register new tool modules
+-- transport.ts           # (existing)
+-- state.ts               # (existing)
+-- patterns.ts            # (existing)
+-- notes.ts               # (existing)
+-- humanize.ts            # (existing)
+-- plugins.ts             # (existing)
+-- serum.ts               # (existing)
+-- render.ts              # (existing)
+-- sample.ts              # (existing)
+-- mixer.ts               # NEW: mixer control tools
+-- playlist.ts            # NEW: arrangement tools
+-- project.ts             # NEW: project settings tools
```

### Structure Rationale

- **One handler per domain:** Keeps handlers focused and testable
- **Matches existing pattern:** New handlers follow exact same structure as transport.py, plugins.py
- **FL module alignment:** Each handler maps to 1-2 FL Studio API modules for clarity

---

## Architectural Patterns

### Pattern 1: Handler Registration (Follow Existing)

**What:** Each handler module registers its functions with the command router on import
**When to use:** Always for FL Bridge handlers
**Trade-offs:** Simple, but requires explicit import in `__init__.py`

**Example (existing pattern to follow):**
```python
# fl-bridge/handlers/mixer.py
from protocol.commands import register_handler

def handle_mixer_set_volume(params):
    index = params.get('index', 0)
    volume = params.get('volume', 0.8)
    mixer.setTrackVolume(index, volume)
    return {
        'success': True,
        'index': index,
        'volume': mixer.getTrackVolume(index)
    }

register_handler('mixer.set_volume', handle_mixer_set_volume)
```

### Pattern 2: MCP Tool Thin Wrapper (Follow Existing)

**What:** TypeScript tools are thin wrappers that delegate to FL Bridge
**When to use:** For operations that need FL Studio API
**Trade-offs:** Simple, but adds round-trip latency

**Example (existing pattern to follow):**
```typescript
// src/tools/mixer.ts
server.tool(
  'mixer_set_volume',
  'Set a mixer track volume (0.0-1.0)',
  {
    track: z.number().int().min(0).describe('Mixer track index (0=Master)'),
    volume: z.number().min(0).max(1).describe('Volume level (0.0-1.0)')
  },
  async ({ track, volume }) => {
    const result = await connection.executeCommand('mixer.set_volume', { index: track, volume });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);
```

### Pattern 3: State Read vs Action Separation

**What:** Separate handlers for reading state (state.*) vs taking action (mixer.*, playlist.*)
**When to use:** Distinguishes query from mutation
**Trade-offs:** More handlers, but clearer intent

**Example:**
- `state.mixer` (existing): Returns all track info (read-only)
- `mixer.set_volume` (new): Mutates a specific track (action)

### Pattern 4: Validation in Handler, Not Bridge

**What:** Validate parameters inside Python handlers, not TypeScript
**When to use:** Always
**Trade-offs:** Catches invalid params closer to API, better error messages

```python
def handle_mixer_set_volume(params):
    index = params.get('index')
    if index is None:
        return {'success': False, 'error': 'Missing required parameter: index'}
    if index < 0 or index >= mixer.trackCount():
        return {'success': False, 'error': f'Track index {index} out of range'}
    # ... proceed
```

---

## Data Flow

### Mixer Volume Change Flow

```
User: "Set track 2 volume to 80%"
         |
         v
+---------------------+
| MCP tool invocation |  mixer_set_volume({ track: 2, volume: 0.8 })
+----------+----------+
           |
           v
+---------------------+
|  mixer.ts           |  await connection.executeCommand('mixer.set_volume', ...)
+----------+----------+
           |
           v
+---------------------+
|  MidiClient         |  Encode JSON -> SysEx -> loopMIDI port
+----------+----------+
           | SysEx over MIDI
           v
+---------------------+
|  device_FLBridge.py |  OnSysEx() -> parse -> execute_command()
+----------+----------+
           |
           v
+---------------------+
|  mixer.py handler   |  mixer.setTrackVolume(2, 0.8)
+----------+----------+
           |
           v
+---------------------+
|  FL Studio Mixer    |  Track 2 fader moves to 80%
+----------+----------+
           | response
           v
   {'success': True, 'index': 2, 'volume': 0.8}
```

### Playlist Pattern Placement Flow

```
User: "Place Pattern 1 at bar 5 on track 2"
         |
         v
+-------------------------+
| playlist_place_pattern  |  playlist_place_pattern({ pattern: 1, track: 2, bar: 5 })
+----------+--------------+
           |
           v
+-------------------------+
|  playlist.py handler    |  ui.setFocused(6)  # Focus playlist
|                         |  ... (investigate API for clip placement)
+----------+--------------+
           |
           v
   NOTE: FL Studio API may not support programmatic clip placement!
   Research needed during implementation.
```

---

## Integration Points with Existing Components

### Existing Handler: state.py

`state.py` already has `handle_get_mixer()` that reads mixer track state. The new `mixer.py` will handle **mutations** (set volume, mute, solo, etc.). No conflict.

| state.py (existing) | mixer.py (new) |
|---------------------|----------------|
| `state.mixer` - read all tracks | `mixer.set_volume` - set one track's volume |
| Returns: { tracks: [...], tempo } | `mixer.mute_track` - toggle mute |
| Read-only | `mixer.solo_track` - toggle solo |
|  | `mixer.set_pan` - set pan |
|  | `mixer.set_routing` - route to destination |

### Existing Handler: transport.py

`transport.py` handles play/stop/record. The new `project.py` will handle **tempo** and **time signature**. Tempo is currently read via `mixer.getCurrentTempo()` in `state.py`, but setting tempo uses `transport` module.

| transport.py (existing) | project.py (new) |
|-------------------------|------------------|
| `transport.start/stop/record` | `project.set_tempo` |
| `transport.state` | `project.get_tempo` |
|  | `project.set_time_signature` |
|  | `project.set_marker` |

### Handler Registration Order

`device_FLBridge.py` OnInit() currently imports:
```python
from handlers import transport, state, patterns, pianoroll
from handlers import plugins
```

Add new handlers:
```python
from handlers import transport, state, patterns, pianoroll
from handlers import plugins
from handlers import mixer, playlist, project  # NEW
```

---

## FL Studio API Mapping

### Mixer Module Functions (to implement)

| MCP Tool | FL API Function | Notes |
|----------|-----------------|-------|
| `mixer_set_volume` | `mixer.setTrackVolume(index, volume)` | volume 0.0-1.0, default 0.8 |
| `mixer_set_pan` | `mixer.setTrackPan(index, pan)` | pan -1.0 to 1.0 |
| `mixer_mute_track` | `mixer.muteTrack(index, value)` | value -1 toggles |
| `mixer_solo_track` | `mixer.soloTrack(index, value, mode)` | mode for solo behavior |
| `mixer_arm_track` | `mixer.armTrack(index)` | toggles armed state |
| `mixer_set_name` | `mixer.setTrackName(index, name)` | rename track |
| `mixer_set_color` | `mixer.setTrackColor(index, color)` | 0x--BBGGRR format |
| `mixer_set_routing` | `mixer.setRouteTo(index, dest, value)` | route track to destination |
| `mixer_set_send_level` | `mixer.setRouteToLevel(index, dest, level)` | API v36+ |
| `mixer_set_eq_band` | `mixer.setEqGain/Freq/Bandwidth(...)` | per-band EQ control |

### Playlist Module Functions (to implement)

| MCP Tool | FL API Function | Notes |
|----------|-----------------|-------|
| `playlist_mute_track` | `playlist.muteTrack(index)` | 1-indexed tracks! |
| `playlist_solo_track` | `playlist.soloTrack(index)` | 1-indexed |
| `playlist_set_name` | `playlist.setTrackName(index, name)` | |
| `playlist_set_color` | `playlist.setTrackColor(index, color)` | |
| `playlist_select_track` | `playlist.selectTrack(index)` | |

**WARNING:** Pattern placement on playlist may not have programmatic API. Need to investigate:
- `arrangement` module for timeline/marker control
- May require UI automation via `ui` module (less reliable)

### General/Transport Module Functions (to implement)

| MCP Tool | FL API Function | Notes |
|----------|-----------------|-------|
| `project_set_tempo` | `transport.setTempo(tempo)` or REC event | Need to verify API |
| `project_get_tempo` | `mixer.getCurrentTempo()` | Already used in state.py |
| `project_get_ppq` | `general.getRecPPQ()` | Ticks per quarter note |

**WARNING:** Time signature setting may not have API. Need to investigate.

---

## New Components Detail

### mixer.py Handler (fl-bridge/handlers/mixer.py)

```python
"""
FL Bridge Mixer Handlers

Handles mixer track control: volume, pan, mute, solo, routing, EQ.

REGISTERED HANDLERS:
====================
- mixer.set_volume: Set mixer track volume
- mixer.set_pan: Set mixer track pan
- mixer.mute_track: Mute/unmute mixer track
- mixer.solo_track: Solo/unsolo mixer track
- mixer.arm_track: Arm/disarm track for recording
- mixer.set_name: Rename mixer track
- mixer.set_color: Set mixer track color
- mixer.set_routing: Route track to destination
- mixer.set_send_level: Set send level to destination
- mixer.get_peaks: Get current audio peak levels
"""

# Estimated: ~200 lines
# Pattern: Same as transport.py, plugins.py
```

### playlist.py Handler (fl-bridge/handlers/playlist.py)

```python
"""
FL Bridge Playlist Handlers

Handles playlist track management and arrangement.

REGISTERED HANDLERS:
====================
- playlist.mute_track: Mute/unmute playlist track
- playlist.solo_track: Solo/unsolo playlist track
- playlist.set_name: Rename playlist track
- playlist.set_color: Set playlist track color
- playlist.select_track: Select playlist track
- playlist.get_activity: Get track activity level
"""

# Estimated: ~150 lines
# NOTE: Pattern placement may require separate investigation
```

### project.py Handler (fl-bridge/handlers/project.py)

```python
"""
FL Bridge Project Handlers

Handles project-level settings: tempo, time signature, markers.

REGISTERED HANDLERS:
====================
- project.set_tempo: Set project tempo (BPM)
- project.get_info: Get project info (tempo, PPQ, etc.)
- project.set_marker: Add/modify timeline marker
"""

# Estimated: ~100 lines
# NOTE: Time signature API access unconfirmed
```

---

## Build Order / Phase Recommendations

Based on dependency analysis and risk:

### Phase 1: Mixer Control (Low Risk)

**Rationale:** Mixer API is well-documented, existing `state.py` already reads mixer state. Mutations are straightforward.

1. Create `mixer.py` handler
2. Create `mixer.ts` tools
3. Register in `__init__.py` and `index.ts`

**Commands to implement:**
- `mixer.set_volume` / `mixer_set_volume`
- `mixer.set_pan` / `mixer_set_pan`
- `mixer.mute_track` / `mixer_mute_track`
- `mixer.solo_track` / `mixer_solo_track`
- `mixer.arm_track` / `mixer_arm_track`
- `mixer.set_name` / `mixer_set_name`

### Phase 2: Mixer Routing & EQ (Medium Risk)

**Rationale:** Routing API (v36+) may not be available in all FL versions. EQ bands are numerous.

1. Add routing handlers to `mixer.py`
2. Add EQ handlers to `mixer.py`

**Commands to implement:**
- `mixer.set_routing` / `mixer_set_routing`
- `mixer.set_send_level` / `mixer_set_send_level`
- `mixer.set_eq_gain` / `mixer_set_eq_gain`

### Phase 3: Project Settings (Medium Risk)

**Rationale:** Tempo is confirmed, but time signature API needs investigation.

1. Create `project.py` handler
2. Create `project.ts` tools

**Commands to implement:**
- `project.set_tempo` / `project_set_tempo`
- `project.get_info` / `project_get_info`

### Phase 4: Playlist Track Control (Low Risk)

**Rationale:** Playlist track properties are straightforward, similar to mixer tracks.

1. Create `playlist.py` handler
2. Create `playlist.ts` tools

**Commands to implement:**
- `playlist.mute_track` / `playlist_mute_track`
- `playlist.solo_track` / `playlist_solo_track`
- `playlist.set_name` / `playlist_set_name`

### Phase 5: Playlist Pattern Placement (HIGH RISK)

**Rationale:** FL Studio API may not support programmatic pattern/clip placement. Requires investigation.

**Risk mitigation:**
- Research `arrangement` module thoroughly
- Consider UI automation as fallback
- May need to defer to future milestone

---

## Anti-Patterns

### Anti-Pattern 1: Mixing Read and Write in One Handler

**What people do:** Single handler that both reads state and writes changes
**Why it's wrong:** Makes it unclear whether operation is idempotent
**Do this instead:** Separate `state.*` handlers (read) from `mixer.*` handlers (write)

### Anti-Pattern 2: Assuming All API Functions Exist

**What people do:** Design tools assuming FL Studio API has all needed functions
**Why it's wrong:** Some operations (like placing clips) may not be possible
**Do this instead:** Verify each function exists in API stubs before designing tool

### Anti-Pattern 3: Ignoring Index Boundaries

**What people do:** Pass track indices without validation
**Why it's wrong:** Mixer is 0-indexed, playlist is 1-indexed; out-of-range crashes
**Do this instead:** Validate indices in handler using `trackCount()` functions

### Anti-Pattern 4: Hardcoding Color Values

**What people do:** Pass color as hex string or RGB tuple
**Why it's wrong:** FL Studio uses 0x--BBGGRR format (BGR, not RGB)
**Do this instead:** Document format clearly, consider helper function

---

## Risk Assessment

| Component | Risk | Mitigation |
|-----------|------|------------|
| Mixer volume/pan/mute | LOW | API well-documented, existing read works |
| Mixer routing | MEDIUM | API v36+, may need version check |
| Mixer EQ | LOW | API documented, just many parameters |
| Project tempo | LOW | API exists, verify correct function |
| Project time signature | HIGH | API may not exist, research needed |
| Playlist track properties | LOW | Similar to mixer, 1-indexed |
| Playlist pattern placement | HIGH | API may not exist, major blocker |

---

## Sources

### HIGH Confidence
- [FL Studio API Stubs (Official)](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/)
- [Mixer Tracks API](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/tracks/)
- [Playlist Tracks API](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/playlist/tracks/)
- Existing codebase: `fl-bridge/handlers/state.py`, `fl-bridge/handlers/transport.py`

### MEDIUM Confidence
- [FL MIDI 101 Guide](https://flmidi-101.readthedocs.io/en/latest/scripting/fl_midi_api.html)
- [Time Units Documentation](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/tutorials/time_units/)

### LOW Confidence
- Pattern placement API existence (needs investigation)
- Time signature API existence (needs investigation)

---
*Architecture research for: FL Studio MCP v2.1 -- Song Building & Mixing*
*Researched: 2026-02-25*
*Confidence: HIGH for mixer/playlist track control, MEDIUM for project settings, LOW for pattern placement*
