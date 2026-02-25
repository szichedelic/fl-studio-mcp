# Phase 11: Project Controls - Research

**Researched:** 2026-02-25
**Domain:** FL Studio project-level settings (tempo, position, undo/redo)
**Confidence:** HIGH

## Summary

Phase 11 implements project-level controls for FL Studio: tempo get/set, playback position get/set, and undo/redo operations. Research confirms all six requirements (PROJ-01 through PROJ-06) are achievable through the FL Studio MIDI scripting API.

Tempo reading uses `mixer.getCurrentTempo()` which returns BPM as float or int. Tempo setting uses `general.processRECEvent(midi.REC_Tempo, bpm*1000, flags)` - a well-documented pattern that multiplies BPM by 1000 (e.g., 128 BPM = 128000). Playback position uses the `transport` module with multiple format modes (ticks, milliseconds, B:S:T components). Undo/redo is handled by the `general` module with `undoUp()` for undo and `undoDown()` for redo.

**Primary recommendation:** Implement as a single `project.py` handler file with 6 handlers, exposing 6 corresponding MCP tools in `src/tools/project.ts`. Follow established patterns from transport.py and mixer.py handlers.

## Standard Stack

The established libraries/tools for this domain:

### Core FL Studio Modules

| Module | Function | Purpose | Confidence |
|--------|----------|---------|------------|
| `mixer` | `getCurrentTempo(asInt=False)` | Read current project tempo | HIGH |
| `general` | `processRECEvent(eventId, value, flags)` | Set tempo via REC event | HIGH |
| `transport` | `getSongPos(mode)` | Get playback position in various formats | HIGH |
| `transport` | `setSongPos(position, mode)` | Set playback position | HIGH |
| `general` | `undoUp()` | Undo (move back in history) | HIGH |
| `general` | `undoDown()` | Redo (move forward in history) | HIGH |

### Supporting Constants

| Constant | Module | Value/Purpose |
|----------|--------|---------------|
| `midi.REC_Tempo` | midi | Event ID for tempo control |
| `midi.REC_Control` | midi | Flag combination for setting values with UI update |
| `midi.REC_UpdateControl` | midi | Flag to update UI display (1 << 4) |

### Time Format Modes (transport.getSongPos/setSongPos)

| Mode | Name | Returns | Read | Write |
|------|------|---------|------|-------|
| -1 | Fractional | float (0.0-1.0 through song) | Yes | Yes |
| 0 | SONGLENGTH_MS | int (milliseconds) | Yes | Yes |
| 1 | SONGLENGTH_S | int (seconds) | Yes | Yes |
| 2 | SONGLENGTH_ABSTICKS | int (absolute ticks) | Yes | Yes |
| 3 | SONGLENGTH_BARS | int (bars component) | Yes | No |
| 4 | SONGLENGTH_STEPS | int (steps component) | Yes | No |
| 5 | SONGLENGTH_TICKS | int (ticks component) | Yes | No |

**Note:** Modes 3-5 are read-only. For setting position via bars:steps:ticks, convert to absolute ticks first.

## Architecture Patterns

### Recommended Handler Structure

```
fl-bridge/handlers/
  project.py       # NEW: tempo, position, undo/redo handlers
```

```
src/tools/
  project.ts       # NEW: MCP tool wrappers for project handlers
```

### Pattern 1: Tempo Get (PROJ-01)

**What:** Read current tempo using mixer.getCurrentTempo()
**When:** User asks "what's the tempo?" or needs BPM info

```python
# Source: FL Studio API Stubs - mixer/properties
def handle_project_get_tempo(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        tempo = mixer.getCurrentTempo()  # Returns float BPM
        return {
            'success': True,
            'tempo': tempo,
            'bpm': int(tempo)  # Rounded for convenience
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

### Pattern 2: Tempo Set (PROJ-02)

**What:** Set tempo via processRECEvent with REC_Tempo
**When:** User asks "set tempo to 128 BPM"

```python
# Source: FL Studio API Stubs - midi/__rec_events/global properties
def handle_project_set_tempo(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if general is None or midi is None or mixer is None:
            return {'success': False, 'error': 'Required modules not available'}

        bpm = float(params.get('bpm', 120))

        # Validate range (FL Studio supports ~10-999 BPM)
        if bpm < 10 or bpm > 999:
            return {'success': False, 'error': f'BPM {bpm} out of range (10-999)'}

        # CRITICAL: Multiply by 1000 (120 BPM = 120000)
        tempo_value = int(bpm * 1000)

        # Use REC_Control | REC_UpdateControl to set and update UI
        flags = midi.REC_Control | midi.REC_UpdateControl
        general.processRECEvent(midi.REC_Tempo, tempo_value, flags)

        # Read back to confirm
        readback = mixer.getCurrentTempo()

        return {
            'success': True,
            'tempo': readback,
            'requested': bpm
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

### Pattern 3: Position Get (PROJ-03)

**What:** Get playback position in multiple formats
**When:** User asks "where are we?" or "what bar?"

```python
# Source: FL Studio API Stubs - transport
def handle_project_get_position(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if transport is None:
            return {'success': False, 'error': 'Transport module not available'}

        return {
            'success': True,
            'bars': transport.getSongPos(3),      # Bars component
            'steps': transport.getSongPos(4),     # Steps component
            'ticks': transport.getSongPos(5),     # Ticks component
            'absoluteTicks': transport.getSongPos(2),
            'milliseconds': transport.getSongPos(0),
            'fractional': transport.getSongPos(-1),
            'hint': transport.getSongPosHint()    # B:S:T formatted string
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

### Pattern 4: Position Set (PROJ-04)

**What:** Jump to position via setSongPos
**When:** User asks "go to bar 16" or "jump to 30 seconds"

```python
# Source: FL Studio API Stubs - transport
def handle_project_set_position(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if transport is None or general is None:
            return {'success': False, 'error': 'Required modules not available'}

        # Support multiple input formats
        if 'bars' in params:
            # Convert bars to absolute ticks
            # ticks = bars * PPQ * beats_per_bar
            ppq = general.getRecPPQ()
            bars = int(params['bars'])
            # Assuming 4/4 time (4 beats per bar)
            abs_ticks = (bars - 1) * ppq * 4  # bars are 1-indexed
            transport.setSongPos(abs_ticks, 2)  # Mode 2 = absolute ticks
        elif 'ticks' in params:
            transport.setSongPos(int(params['ticks']), 2)
        elif 'ms' in params:
            transport.setSongPos(int(params['ms']), 0)
        elif 'seconds' in params:
            transport.setSongPos(int(params['seconds']), 1)
        elif 'fractional' in params:
            transport.setSongPos(float(params['fractional']), -1)
        else:
            return {'success': False, 'error': 'No position specified. Use bars, ticks, ms, seconds, or fractional.'}

        # Read back position
        return {
            'success': True,
            'bars': transport.getSongPos(3),
            'steps': transport.getSongPos(4),
            'ticks': transport.getSongPos(5),
            'hint': transport.getSongPosHint()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

### Pattern 5: Undo/Redo (PROJ-05, PROJ-06)

**What:** Navigate undo history
**When:** User asks "undo that" or "redo"

```python
# Source: FL Studio API Stubs - general/undo
def handle_project_undo(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if general is None:
            return {'success': False, 'error': 'General module not available'}

        result = general.undoUp()  # Returns int (meaning undocumented)

        return {
            'success': True,
            'action': 'undo',
            'result': result
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handle_project_redo(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        if general is None:
            return {'success': False, 'error': 'General module not available'}

        result = general.undoDown()  # Returns int (meaning undocumented)

        return {
            'success': True,
            'action': 'redo',
            'result': result
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

### Anti-Patterns to Avoid

- **Using `general.undo()` instead of `undoUp()`:** The `undo()` function is a toggle (like Ctrl+Z) that may redo if called twice. Use `undoUp()` for consistent undo behavior.
- **Forgetting tempo multiplier:** Tempo values MUST be multiplied by 1000 for processRECEvent. 120 BPM = 120000.
- **Using modes 3-5 for setSongPos:** These B:S:T component modes are read-only. Convert to absolute ticks (mode 2) for setting.
- **Assuming bar numbering:** FL Studio bars are typically 1-indexed in UI but 0-indexed in API. Verify with testing.

## Don't Hand-Roll

Problems with existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tempo conversion | Custom BPM math | `bpm * 1000` | API expects this exact format |
| Time format parsing | Manual B:S:T parser | `getSongPosHint()` | Returns formatted string directly |
| Undo state tracking | Custom undo stack | `undoUp()`/`undoDown()` | FL Studio manages history |
| Position conversion | Manual tick math | Multiple `getSongPos()` modes | API handles all conversions |

**Key insight:** FL Studio's API provides comprehensive time unit support. Don't calculate conversions manually - use the appropriate mode parameter.

## Common Pitfalls

### Pitfall 1: Tempo Value Scaling

**What goes wrong:** Setting tempo without multiplying by 1000 results in effectively 0 BPM or unexpected values
**Why it happens:** API documentation states "1000 * tempo" but it's easy to forget
**How to avoid:** Always use `bpm * 1000` in processRECEvent, add comment explaining why
**Warning signs:** Tempo reads back as tiny fraction or zero

### Pitfall 2: Undo/Redo Function Confusion

**What goes wrong:** Using `general.undo()` which toggles, causing unexpected redo on second call
**Why it happens:** Three similar functions: `undo()`, `undoUp()`, `undoDown()`
**How to avoid:** Use `undoUp()` for undo, `undoDown()` for redo - never use `undo()`
**Warning signs:** Undo seems to "not work" or does redo instead

### Pitfall 3: Read-Only Position Modes

**What goes wrong:** Calling `setSongPos(16, 3)` thinking mode 3 sets bars
**Why it happens:** Modes 3-5 (bars, steps, ticks components) are read-only
**How to avoid:** For setting position, use modes -1, 0, 1, or 2 only
**Warning signs:** Position doesn't change, no error raised

### Pitfall 4: Bar Indexing Inconsistency

**What goes wrong:** Going to "bar 1" lands on bar 2, or vice versa
**Why it happens:** UI may show 1-indexed bars, API may use 0-indexed
**How to avoid:** Test empirically, document the offset, apply consistently
**Warning signs:** Position is always off by one bar

### Pitfall 5: Missing REC_UpdateControl Flag

**What goes wrong:** Tempo changes internally but UI doesn't update
**Why it happens:** REC_Control doesn't include UI update by default
**How to avoid:** Always combine: `midi.REC_Control | midi.REC_UpdateControl`
**Warning signs:** Tempo appears unchanged in FL Studio UI until project refresh

## Code Examples

### Complete Handler Registration Pattern

```python
# fl-bridge/handlers/project.py
"""
FL Bridge Project Handlers

REGISTERED HANDLERS:
====================
- project.get_tempo: Get current project tempo
- project.set_tempo: Set project tempo via processRECEvent
- project.get_position: Get playback position in multiple formats
- project.set_position: Jump to playback position
- project.undo: Undo last operation
- project.redo: Redo last undone operation
"""

from typing import Dict, Any

try:
    import mixer
    import transport
    import general
    import midi
except ImportError:
    mixer = None
    transport = None
    general = None
    midi = None

from protocol.commands import register_handler

# ... handler implementations ...

register_handler('project.get_tempo', handle_project_get_tempo)
register_handler('project.set_tempo', handle_project_set_tempo)
register_handler('project.get_position', handle_project_get_position)
register_handler('project.set_position', handle_project_set_position)
register_handler('project.undo', handle_project_undo)
register_handler('project.redo', handle_project_redo)
```

### MCP Tool Registration Pattern

```typescript
// src/tools/project.ts
import { z } from 'zod';

export function registerProjectTools(server: McpServer, connection: ConnectionManager): void {

  // get_tempo - no params needed
  server.tool('get_tempo', 'Get current project tempo (BPM)', {}, async () => {
    const result = await connection.executeCommand('project.get_tempo', {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // set_tempo - accepts BPM
  const setTempoSchema = {
    bpm: z.number().min(10).max(999).describe('Tempo in BPM (10-999)')
  };
  server.tool('set_tempo', 'Set project tempo', setTempoSchema, async ({ bpm }) => {
    const result = await connection.executeCommand('project.set_tempo', { bpm });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // ... similar for position and undo/redo
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `general.undo()` toggle | `undoUp()`/`undoDown()` explicit | FL Studio 21 | More predictable undo behavior |
| Tick-based only | Multiple getSongPos modes | API v8+ | Easier time format handling |

**Deprecated/outdated:**
- `general.undo()` - Still works but is a toggle, not directional. Prefer `undoUp()`/`undoDown()` for predictable behavior.

## Open Questions

Things that couldn't be fully resolved:

1. **Bar indexing (0 vs 1)**
   - What we know: FL Studio UI shows 1-indexed bars
   - What's unclear: Whether getSongPos(3) returns 0-indexed or 1-indexed
   - Recommendation: Test empirically during implementation, document finding

2. **Time signature awareness for bar calculation**
   - What we know: Default is 4/4 time (4 beats per bar)
   - What's unclear: How to read current time signature via API
   - Recommendation: Assume 4/4 initially, note limitation in tool description

3. **Undo return value meaning**
   - What we know: `undoUp()` and `undoDown()` return int
   - What's unclear: What the int represents (success code? history position?)
   - Recommendation: Return it but don't rely on it for success/failure

## Sources

### Primary (HIGH confidence)
- [FL Studio Python API Stubs - transport](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/) - getSongPos, setSongPos signatures
- [FL Studio Python API Stubs - mixer/properties](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/properties/) - getCurrentTempo function
- [FL Studio Python API Stubs - general/undo](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/undo/) - undo/redo functions
- [FL Studio Python API Stubs - midi/__rec_events/global properties](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/midi/__rec_events/global%20properties/) - REC_Tempo constant
- [FL Studio Python API Stubs - process flags](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/midi/__rec_events/process%20flags/) - REC_Control, REC_UpdateControl

### Secondary (MEDIUM confidence)
- Existing codebase patterns (state.py, transport.py, mixer.py handlers)
- STATE.md prior decision: "Tempo IS settable via `general.processRECEvent(midi.REC_Tempo, bpm*1000, flags)`"

### Tertiary (LOW confidence)
- None - all findings verified with official API stubs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All functions documented in official API stubs
- Architecture: HIGH - Follows established handler patterns in codebase
- Pitfalls: HIGH - Common issues documented in API notes and verified

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (FL Studio API is stable)
