# Phase 8: Mixer Core - Research

**Researched:** 2026-02-25
**Domain:** FL Studio Mixer Control via Python API (volume, pan, mute, solo, naming, color)
**Confidence:** HIGH

## Summary

Phase 8 implements the fundamental mixer track controls: reading state (volume, pan, mute, solo) and mutations (setting those same properties plus track naming and coloring). The FL Studio Python API's `mixer` module provides complete, well-documented functions for all these operations. This phase is LOW RISK because the existing codebase already has a working `state.mixer` handler that reads mixer track information, and the mutation patterns follow the same architecture as `plugins.py`.

The primary implementation challenge is correctly handling FL Studio's volume scale (0.8 = unity/0dB, not 1.0) and color format (BGR, not RGB). Secondary concerns include proper mute/solo semantics (explicit set vs toggle) and index validation (track 0 = Master).

**Primary recommendation:** Follow the existing handler pattern from `plugins.py` and `state.py`. Create a new `mixer.py` handler for mutations and new `mixer.ts` MCP tools. Keep state reading in `state.py` (already working) and add mutation-only handlers to `mixer.py`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FL Studio `mixer` module | API v1+ | All mixer track operations | Official FL Studio Python API |
| FL Studio `midi` module | API v1+ | Pickup mode constants (PIM_*) | Official FL Studio Python API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `utils` (FL Studio) | API v1+ | Color conversion (ColorToRGB, RGBToColor) | When converting between RGB and BGR formats |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct 0.0-1.0 volume API | dB-based helper functions | dB is more intuitive for users but adds conversion overhead |
| Explicit mute/unmute tools | Single toggle tool | Toggle is simpler code but unpredictable UX when user says "mute" |

**Installation:**
```bash
# No new npm packages required - uses existing FL Studio Python API
```

## Architecture Patterns

### Recommended Project Structure
```
fl-bridge/handlers/
+-- mixer.py           # NEW: mixer track mutation handlers
+-- state.py           # EXISTING: has mixer read (keep as-is)
+-- __init__.py        # ADD: import mixer

src/tools/
+-- mixer.ts           # NEW: MCP tools for mixer control
+-- state.ts           # EXISTING: has get_mixer (keep as-is)
+-- index.ts           # ADD: import registerMixerTools
```

### Pattern 1: Handler Registration (Follow Existing)
**What:** Each handler module registers its functions with the command router on import
**When to use:** Always for FL Bridge handlers
**Example:**
```python
# Source: Established pattern from fl-bridge/handlers/plugins.py
from protocol.commands import register_handler

def handle_mixer_set_volume(params):
    index = params.get('index', 0)
    volume = params.get('volume', 0.8)
    mixer.setTrackVolume(index, volume, midi.PIM_None)
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
**Example:**
```typescript
// Source: Established pattern from src/tools/plugins.ts
server.tool(
  'set_mixer_volume',
  'Set a mixer track volume (0.0-1.0, where 0.8 = unity/0dB)',
  {
    track: z.number().int().min(0).describe('Mixer track index (0=Master, 1+=insert tracks)'),
    volume: z.number().min(0).max(1).describe('Volume level (0.0-1.0, where 0.8 = 0dB)')
  },
  async ({ track, volume }) => {
    const result = await connection.executeCommand('mixer.set_volume', { index: track, volume });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);
```

### Pattern 3: Validation in Handler
**What:** Validate parameters inside Python handlers for better error messages
**When to use:** Always
**Example:**
```python
# Source: Established pattern from fl-bridge/handlers/plugins.py
def handle_mixer_set_volume(params):
    index = params.get('index')
    if index is None:
        return {'success': False, 'error': 'Missing required parameter: index'}
    if index < 0 or index >= mixer.trackCount():
        return {'success': False, 'error': f'Track index {index} out of range (0 to {mixer.trackCount() - 1})'}
    # ... proceed with validated params
```

### Anti-Patterns to Avoid
- **Caching mixer track values:** Mixer state changes frequently via user interaction. Always read fresh before relative operations.
- **Using toggle for explicit commands:** When user says "mute track 3", use `muteTrack(3, 1)` not `muteTrack(3, -1)`. Toggle behavior is unpredictable.
- **Assuming RGB color format:** FL Studio uses BGR (0x--BBGGRR). Always convert.
- **Forgetting pickup mode:** Use `midi.PIM_None` (0) for immediate programmatic changes.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Volume dB conversion | Custom math | `mixer.getTrackVolume(index, mode=1)` returns dB directly | FL Studio handles the conversion internally |
| Color format conversion | Manual bit shifting | `utils.RGBToColor(r,g,b)` / `utils.ColorToRGB(color)` | FL Studio utilities exist for this |
| Track count validation | Hardcoded 127 | `mixer.trackCount()` | Track count may vary by FL Studio version |
| Master track index | Hardcoded 0 | `mixer.getTrackInfo(midi.TN_Master)` | Dynamic lookup is more robust |
| First insert track | Hardcoded 1 | `mixer.getTrackInfo(midi.TN_FirstIns)` | Dynamic lookup is more robust |

**Key insight:** The FL Studio API provides helper functions and dynamic lookups. Use them instead of hardcoding values.

## Common Pitfalls

### Pitfall 1: Volume 0.8 = Unity Gain (0dB), Not 1.0
**What goes wrong:** Setting volume to 0.5 expecting "half volume" results in much quieter than expected (well below unity).
**Why it happens:** FL Studio's volume scale is non-linear: 0.8 = 0dB (unity), 1.0 = ~+5.6dB (amplification).
**How to avoid:** Document in tool descriptions that 0.8 = 0dB. Consider offering dB-based alternative.
**Warning signs:** Users complain "set to 50%" sounds very quiet.

### Pitfall 2: BGR Color Format, Not RGB
**What goes wrong:** Setting track color to red (0xFF0000) produces blue, and vice versa.
**Why it happens:** FL Studio uses 0x--BBGGRR format, not 0x--RRGGBB.
**How to avoid:** Either accept BGR directly or provide conversion in the handler.
**Warning signs:** Colors are red/blue swapped.

### Pitfall 3: Track 0 is Master
**What goes wrong:** User says "set track 1 volume" expecting the first insert track, but if using 0-based user input, you modify Master.
**Why it happens:** Mixer tracks are 0-indexed where 0 = Master, 1+ = inserts.
**How to avoid:** Document index convention clearly. For user-facing tools, consider 1-based numbering for insert tracks.
**Warning signs:** "Track 1" operations affect wrong track.

### Pitfall 4: Mute/Solo Toggle vs Explicit
**What goes wrong:** User says "mute track 3" when track 3 is already muted, and toggle behavior unmutes it.
**Why it happens:** `muteTrack(index, -1)` toggles. User expects explicit mute.
**How to avoid:** Use `muteTrack(index, 1)` for explicit mute, `muteTrack(index, 0)` for explicit unmute. Provide separate toggle tool if needed.
**Warning signs:** "Mute" sometimes unmutes.

### Pitfall 5: Large Mixer Track Count Responses
**What goes wrong:** Requesting all mixer state returns 127 tracks, potentially exceeding SysEx payload limits.
**Why it happens:** FL Studio has 127 mixer slots (1 master + 125 inserts + 1 current).
**How to avoid:** The existing `state.mixer` handler already works - it uses chunking. For Phase 8 mutations, responses are small (single track info).
**Warning signs:** Timeout or truncated JSON for full mixer state queries.

## Code Examples

Verified patterns from official sources:

### Reading Mixer Track State
```python
# Source: https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/tracks/
import mixer

# Get track info
volume = mixer.getTrackVolume(index)           # 0.0-1.0 (default 0.8)
volume_db = mixer.getTrackVolume(index, 1)     # Returns dB value
pan = mixer.getTrackPan(index)                 # -1.0 to 1.0 (default 0.0)
muted = mixer.isTrackMuted(index)              # bool
soloed = mixer.isTrackSolo(index)              # bool
name = mixer.getTrackName(index)               # str
color = mixer.getTrackColor(index)             # int (0x--BBGGRR)
armed = mixer.isTrackArmed(index)              # bool
```

### Setting Mixer Track Properties
```python
# Source: https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/tracks/
import mixer
import midi

# Set volume (use PIM_None for immediate programmatic change)
mixer.setTrackVolume(index, 0.8, midi.PIM_None)  # 0.8 = 0dB

# Set pan
mixer.setTrackPan(index, 0.0, midi.PIM_None)     # 0.0 = center

# Mute/unmute (explicit values, not toggle)
mixer.muteTrack(index, 1)    # 1 = mute
mixer.muteTrack(index, 0)    # 0 = unmute
mixer.muteTrack(index, -1)   # -1 = toggle (avoid for explicit commands)

# Solo/unsolo
mixer.soloTrack(index, 1)    # 1 = solo
mixer.soloTrack(index, 0)    # 0 = unsolo
mixer.soloTrack(index, -1)   # -1 = toggle

# Set name and color
mixer.setTrackName(index, "Drums")
mixer.setTrackColor(index, 0x0000FF)  # Blue in BGR = 0x0000FF (not red!)
```

### Index Validation
```python
# Source: https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/properties/
import mixer

# Get track count for validation
track_count = mixer.trackCount()

# Special track indices
master_idx = mixer.getTrackInfo(midi.TN_Master)     # Usually 0
first_ins = mixer.getTrackInfo(midi.TN_FirstIns)   # Usually 1
last_ins = mixer.getTrackInfo(midi.TN_LastIns)     # Usually 125
selected = mixer.getTrackInfo(midi.TN_Sel)         # Currently selected

# Validate index
if index < 0 or index >= track_count:
    return {'success': False, 'error': f'Invalid track index {index}'}
```

### Color Conversion
```python
# Convert RGB to FL Studio BGR format
def rgb_to_fl_color(r, g, b):
    """Convert RGB (0-255 each) to FL Studio BGR integer."""
    return (b << 16) | (g << 8) | r

def fl_color_to_rgb(color):
    """Convert FL Studio BGR integer to RGB tuple."""
    r = color & 0xFF
    g = (color >> 8) & 0xFF
    b = (color >> 16) & 0xFF
    return (r, g, b)

# Example: Set track to red
red_bgr = rgb_to_fl_color(255, 0, 0)  # = 0x0000FF in BGR
mixer.setTrackColor(index, red_bgr)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | This is new implementation | Phase 8 | First mixer control implementation |

**Deprecated/outdated:**
- None - this is new functionality being added

## FL Studio API Reference

### Mixer Track Functions (All Required for Phase 8)

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `getTrackVolume` | `(index, mode=0)` | `float` | mode=0 for 0.0-1.0, mode=1 for dB |
| `setTrackVolume` | `(index, volume, pickupMode)` | `None` | pickupMode from midi.PIM_* |
| `getTrackPan` | `(index)` | `float` | -1.0 (L) to 1.0 (R), 0.0 = center |
| `setTrackPan` | `(index, pan, pickupMode)` | `None` | |
| `isTrackMuted` | `(index)` | `bool` | |
| `muteTrack` | `(index, value=-1)` | `None` | 1=mute, 0=unmute, -1=toggle |
| `isTrackSolo` | `(index)` | `bool` | |
| `soloTrack` | `(index, value=-1, mode=-1)` | `None` | mode controls solo behavior (1-4) |
| `getTrackName` | `(index)` | `str` | |
| `setTrackName` | `(index, name)` | `None` | Empty string resets to default |
| `getTrackColor` | `(index)` | `int` | BGR format (0x--BBGGRR) |
| `setTrackColor` | `(index, color)` | `None` | BGR format |
| `trackCount` | `()` | `int` | Total mixer track count (127 typical) |
| `getTrackInfo` | `(mode)` | `int` | TN_Master=0, TN_FirstIns=1, TN_LastIns=2, TN_Sel=3 |
| `isTrackArmed` | `(index)` | `bool` | Recording arm state |
| `armTrack` | `(index)` | `None` | Toggles arm state |
| `getTrackPeaks` | `(index, mode)` | `float` | mode: 0=L, 1=R, 2=max |

### Pickup Mode Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `midi.PIM_None` | 0 | Immediate jump to value |
| `midi.PIM_Jump` | 1 | Jump after touch pickup |
| `midi.PIM_Takeover` | 2 | Gradual takeover |

## Open Questions

Things that couldn't be fully resolved:

1. **Solo mode behavior with complex routing**
   - What we know: `soloTrack()` has `mode` parameter (1-4) affecting which related tracks also play
   - What's unclear: Exact behavior of each mode with send routing
   - Recommendation: Start with default mode (-1), add mode parameter later if users request finer control

2. **Stereo separation control**
   - What we know: `getTrackStereoSep()` and `setTrackStereoSep()` exist (API v12+)
   - What's unclear: Whether this is needed in Phase 8 scope
   - Recommendation: Defer to Phase 9 (advanced mixer features) unless explicitly requested

## Sources

### Primary (HIGH confidence)
- [FL Studio API Stubs - Mixer Tracks](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/tracks/) - All track functions
- [FL Studio API Stubs - Mixer Properties](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/properties/) - trackCount, getTrackInfo
- [FL Studio API Stubs - Mixer Selection](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/selection/) - Track selection functions

### Secondary (MEDIUM confidence)
- Existing project codebase: `fl-bridge/handlers/state.py` (working mixer read pattern)
- Existing project codebase: `fl-bridge/handlers/plugins.py` (handler pattern to follow)
- `.planning/research/v2.1-PITFALLS.md` - Known issues and workarounds

### Tertiary (LOW confidence)
- None - all critical information verified via official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only official FL Studio API, patterns established in codebase
- Architecture: HIGH - Follows existing handler/tool patterns exactly
- Pitfalls: HIGH - Documented in official API and verified in project research

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days - FL Studio API is stable)

## Implementation Checklist

For the planner, the following handlers and tools are needed:

### Python Handlers (fl-bridge/handlers/mixer.py)

| Handler | Purpose | Parameters | Returns |
|---------|---------|------------|---------|
| `mixer.set_volume` | Set track volume | `index`, `volume` | `{success, index, volume}` |
| `mixer.set_pan` | Set track pan | `index`, `pan` | `{success, index, pan}` |
| `mixer.mute` | Mute track (explicit) | `index`, `mute` (bool) | `{success, index, muted}` |
| `mixer.solo` | Solo track (explicit) | `index`, `solo` (bool) | `{success, index, soloed}` |
| `mixer.set_name` | Rename track | `index`, `name` | `{success, index, name}` |
| `mixer.set_color` | Set track color | `index`, `color` | `{success, index, color}` |

### MCP Tools (src/tools/mixer.ts)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `set_mixer_volume` | Set track volume | `track`, `volume` |
| `set_mixer_pan` | Set track pan | `track`, `pan` |
| `mute_mixer_track` | Mute/unmute track | `track`, `mute` (bool) |
| `solo_mixer_track` | Solo/unsolo track | `track`, `solo` (bool) |
| `set_mixer_track_name` | Rename track | `track`, `name` |
| `set_mixer_track_color` | Set track color | `track`, `color` (RGB hex string or int) |

### Existing (No Changes Needed)
- `state.mixer` handler - Already reads all track info
- `get_mixer` tool - Already provides mixer state
