# Phase 9: Mixer Routing & Advanced - Research

**Researched:** 2026-02-25
**Domain:** FL Studio Mixer Routing, EQ Bands, and Effect Slot Access via Python API
**Confidence:** HIGH

## Summary

Phase 9 implements mixer routing between tracks (sends), per-track parametric EQ control, and access to plugins in mixer effect slots. The FL Studio Python API provides complete, well-documented functions for all these operations since API versions 1 (routing), 32 (slot colors), 35 (EQ bands), and 36 (route levels with UI update).

The key implementation considerations are:
1. **Routing**: Use `setRouteTo()` to create/remove routes and `setRouteToLevel()` for send levels. Must call `afterRoutingChanged()` after batch operations, OR use `updateUI=True` parameter (API v36+).
2. **EQ Bands**: FL Studio has 3 built-in EQ bands per track (low, mid, high) with gain, frequency, and bandwidth controls. All values are normalized 0.0-1.0 with optional mode parameter for real units (dB, Hz).
3. **Effect Slots**: The existing plugin control system already supports mixer effect slots via `slotIndex` parameter. No new handlers needed - just MCP tools that expose the mixer track + slot combination.

**Primary recommendation:** Add routing and EQ handlers to the existing `mixer.py`. Effect slot access is already implemented in `plugins.py` with `slotIndex` support - create MCP convenience tools that simplify mixer effect discovery by accepting track index + slot index.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FL Studio `mixer` module | API v36+ | All routing, EQ, and slot operations | Official FL Studio Python API |
| FL Studio `plugins` module | API v1+ | Plugin parameter control (existing) | Already implemented in codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `midi` module | API v1+ | Pickup mode constants (PIM_*) | When setting route levels |
| Existing `paramCache` | N/A | Parameter name resolution | Reuse for effect slot plugins |
| Existing `shadowState` | N/A | Reliable value tracking | Reuse for effect slot plugins |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-call `afterRoutingChanged()` | `updateUI=True` parameter | v36+ required, but cleaner for single operations |
| Normalized 0-1 EQ values | dB/Hz mode parameter | User-friendlier but adds conversion complexity |
| Track index only | Track name lookup | More user-friendly, requires name resolution helper |

**Installation:**
```bash
# No new npm packages required - uses existing FL Studio Python API
```

## Architecture Patterns

### Recommended Project Structure
```
fl-bridge/handlers/
+-- mixer.py           # EXTEND: Add routing and EQ handlers
+-- plugins.py         # EXISTING: Already has slotIndex support
+-- state.py           # EXTEND: Add routing state query

src/tools/
+-- mixer.ts           # EXTEND: Add routing and EQ tools
+-- routing.ts         # NEW: Dedicated routing tools (optional)
+-- index.ts           # UPDATE: Import new tools
```

### Pattern 1: Track Name Resolution (Follow Phase 8 Decision)
**What:** Support BOTH track name lookup and direct index
**When to use:** All routing and EQ tools
**Example:**
```python
# Source: Phase 8 patterns + user decisions
def _resolve_track(track_ref):
    """
    Resolve track reference to index.
    Accepts: int (direct index) OR str (track name for lookup)
    Returns: int index or None if not found
    """
    if isinstance(track_ref, int):
        return track_ref

    # Name lookup - case-insensitive partial match
    track_ref_lower = track_ref.lower()
    for i in range(mixer.trackCount()):
        name = mixer.getTrackName(i).lower()
        if track_ref_lower in name or name in track_ref_lower:
            return i
    return None
```

### Pattern 2: Routing with UI Update
**What:** Use `updateUI` parameter for single operations, batch with explicit `afterRoutingChanged()`
**When to use:** Creating/removing routes
**Example:**
```python
# Source: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm
# Single route - use updateUI=True
mixer.setRouteTo(source_index, dest_index, 1, True)

# Batch routes - call afterRoutingChanged() at end
for src, dest in routes_to_create:
    mixer.setRouteTo(src, dest, 1, False)
mixer.afterRoutingChanged()  # Single UI update at end
```

### Pattern 3: Dual Unit Support for Levels
**What:** Accept both percentage (0-100) and decibels, normalize internally
**When to use:** Send level setting (per user decision)
**Example:**
```python
# Source: User decision - accept BOTH percentage and decibels
def normalize_send_level(value, unit='percent'):
    """
    Convert user input to FL Studio normalized value.
    - percent: 0-100 maps to 0.0-1.0
    - db: dB value (needs conversion - 0dB = 0.8)
    """
    if unit == 'percent':
        return value / 100.0
    elif unit == 'db':
        # FL Studio: 0.8 = 0dB, 1.0 = +5.6dB
        # Approximate conversion: normalized = 10^(dB/50) * 0.8
        # Simplified: use linear mapping for usability
        return 0.8 * (10 ** (value / 50))
    return value
```

### Pattern 4: EQ Band Access
**What:** Expose all 3 EQ bands with gain, frequency, bandwidth
**When to use:** Per-track EQ control
**Example:**
```python
# Source: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm
# EQ bands are 0-indexed: 0=low, 1=mid, 2=high
band_count = mixer.getEqBandCount()  # Returns 3

# Get EQ parameters (normalized 0-1 or real units with mode=1)
gain = mixer.getEqGain(track_index, band, mode=0)     # 0-1 normalized
gain_db = mixer.getEqGain(track_index, band, mode=1)  # dB
freq = mixer.getEqFrequency(track_index, band, mode=0)  # 0-1 normalized
freq_hz = mixer.getEqFrequency(track_index, band, mode=1)  # Hz
bandwidth = mixer.getEqBandwidth(track_index, band)     # 0-1 normalized

# Set EQ parameters (normalized only)
mixer.setEqGain(track_index, band, 0.5)
mixer.setEqFrequency(track_index, band, 0.5)
mixer.setEqBandwidth(track_index, band, 0.5)
```

### Pattern 5: Effect Slot Plugin Access (Reuse Existing)
**What:** Use existing plugin handlers with mixer track index and slot index
**When to use:** Accessing effects in mixer slots
**Example:**
```python
# Source: Existing plugins.py already supports this!
# Channel rack: index=channel, slotIndex=-1
# Mixer slots: index=mixer_track, slotIndex=0-9

# The existing plugin handlers work:
result = handle_plugin_discover({
    'index': 5,      # Mixer track index
    'slotIndex': 0   # First effect slot (0-9)
})
# Returns plugin name, parameters, etc.
```

### Anti-Patterns to Avoid
- **Forgetting afterRoutingChanged():** After batch routing changes, UI won't update. Use `updateUI=True` for single ops.
- **Mixing channel index with mixer index:** For effect slots, `index` is MIXER track, not channel rack index.
- **EQ band out of range:** Only 3 bands (0, 1, 2). Validate band parameter.
- **Setting route level before route exists:** Must create route with `setRouteTo()` before setting level with `setRouteToLevel()`.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Effect slot plugin control | New handlers | Existing `plugins.py` with `slotIndex` | Already implemented and tested |
| EQ band count | Hardcoded 3 | `mixer.getEqBandCount()` | Future-proof if FL Studio adds bands |
| Track name resolution | Complex matching | Simple `in` check on names | Per existing mixer.py patterns |
| dB to normalized | Custom formula | Accept percentage primarily | dB conversion is approximate anyway |
| Routing state query | Track-by-track loops | Single `getRouteSendActive()` per route | API provides direct query |

**Key insight:** The existing plugin control system (`plugins.py` + `plugins.ts`) already handles mixer effect slots. Phase 9 just needs MCP tools that make the mixer-track+slot pattern discoverable.

## Common Pitfalls

### Pitfall 1: Route Must Exist Before Setting Level
**What goes wrong:** Calling `setRouteToLevel()` on non-existent route has no effect.
**Why it happens:** FL Studio requires explicit route creation first.
**How to avoid:** Always check `getRouteSendActive()` or call `setRouteTo()` before `setRouteToLevel()`.
**Warning signs:** Send level setting appears to succeed but audio doesn't route.

### Pitfall 2: UI Not Updating After Routing Changes
**What goes wrong:** Routes created programmatically don't appear in FL Studio mixer until window is refocused.
**Why it happens:** Missing `afterRoutingChanged()` call or `updateUI=True` parameter.
**How to avoid:** Use `updateUI=True` for single operations, or call `afterRoutingChanged()` after batch operations.
**Warning signs:** Routes work (audio flows) but mixer visualization doesn't show send cables.

### Pitfall 3: EQ Values Are Normalized, Not Real Units
**What goes wrong:** Setting `setEqFrequency(index, band, 1000)` doesn't set 1000 Hz.
**Why it happens:** API expects 0.0-1.0 normalized values, not Hz or dB.
**How to avoid:** Document normalized ranges. Use `mode=1` getter to show real units for user feedback.
**Warning signs:** EQ sounds extreme or silent when setting "reasonable" values like 1000 Hz.

### Pitfall 4: Mixer Index vs Channel Index Confusion
**What goes wrong:** Trying to access effect slot on channel 5 doesn't work.
**Why it happens:** For mixer effect slots, `index` parameter is MIXER track index, not channel rack index.
**How to avoid:** Clearly document in tool descriptions: "For mixer effects, use mixer track index (0=Master, 1+=inserts)."
**Warning signs:** "No valid plugin at index X" errors.

### Pitfall 5: Send Level 0.8 = Unity (Same as Volume)
**What goes wrong:** Setting send to "100%" (1.0) causes gain boost.
**Why it happens:** FL Studio uses 0.8 = 0dB for all level controls, not 1.0.
**How to avoid:** Document that 0.8 = unity (100%). Consider accepting percentage and mapping 100% to 0.8.
**Warning signs:** Sends sound too loud at "full" level.

### Pitfall 6: Pre/Post Fader Not Exposed in API
**What goes wrong:** User asks for pre-fader send but API doesn't provide mode parameter.
**Why it happens:** `setRouteToLevel()` doesn't have a pre/post mode parameter.
**How to avoid:** Check if this is controlled elsewhere (track settings) or document limitation.
**Warning signs:** Cannot find pre/post fader control in API.

## Code Examples

Verified patterns from official sources:

### Get Routing State
```python
# Source: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm
import mixer

def get_track_sends(track_index):
    """Get all tracks that this track sends to."""
    sends = []
    for dest in range(mixer.trackCount()):
        if dest != track_index and mixer.getRouteSendActive(track_index, dest):
            level = mixer.getRouteToLevel(track_index, dest)
            sends.append({
                'destination': dest,
                'destName': mixer.getTrackName(dest),
                'level': level
            })
    return sends
```

### Create Send Route
```python
# Source: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm
import mixer

def create_send(source_index, dest_index, level=0.8):
    """
    Create a send from source track to destination track.
    Level defaults to unity gain (0.8 = 0dB).
    """
    # Validate indices
    track_count = mixer.trackCount()
    if source_index < 0 or source_index >= track_count:
        return {'success': False, 'error': f'Invalid source index {source_index}'}
    if dest_index < 0 or dest_index >= track_count:
        return {'success': False, 'error': f'Invalid destination index {dest_index}'}

    # Create route with UI update
    mixer.setRouteTo(source_index, dest_index, 1, True)  # 1 = enable, True = updateUI

    # Set level
    mixer.setRouteToLevel(source_index, dest_index, level)

    # Read back for confirmation
    is_active = mixer.getRouteSendActive(source_index, dest_index)
    actual_level = mixer.getRouteToLevel(source_index, dest_index)

    return {
        'success': True,
        'source': source_index,
        'destination': dest_index,
        'active': is_active,
        'level': actual_level
    }
```

### Remove Send Route
```python
# Source: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm
import mixer

def remove_send(source_index, dest_index):
    """Remove a send route between two tracks."""
    # Set route value to 0 to remove
    mixer.setRouteTo(source_index, dest_index, 0, True)  # 0 = disable

    # Verify removal
    is_active = mixer.getRouteSendActive(source_index, dest_index)

    return {
        'success': not is_active,
        'source': source_index,
        'destination': dest_index
    }
```

### Set Send Level
```python
# Source: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm
import mixer

def set_send_level(source_index, dest_index, level):
    """
    Set the send level for an existing route.
    Level is normalized 0.0-1.0 where 0.8 = 0dB.
    """
    # Check route exists first
    if not mixer.getRouteSendActive(source_index, dest_index):
        return {
            'success': False,
            'error': f'No route exists from track {source_index} to {dest_index}'
        }

    # Set level
    mixer.setRouteToLevel(source_index, dest_index, level)

    # Read back
    actual_level = mixer.getRouteToLevel(source_index, dest_index)

    return {
        'success': True,
        'source': source_index,
        'destination': dest_index,
        'level': actual_level
    }
```

### Get Full Routing Table
```python
# Source: Official API
import mixer

def get_routing_table():
    """Get complete routing matrix for all tracks."""
    track_count = mixer.trackCount()
    routes = []

    for src in range(track_count):
        for dest in range(track_count):
            if src != dest and mixer.getRouteSendActive(src, dest):
                routes.append({
                    'source': src,
                    'sourceName': mixer.getTrackName(src),
                    'destination': dest,
                    'destName': mixer.getTrackName(dest),
                    'level': mixer.getRouteToLevel(src, dest)
                })

    return {
        'success': True,
        'trackCount': track_count,
        'routes': routes
    }
```

### Get/Set EQ Band
```python
# Source: https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm
import mixer

# Band names for clarity
EQ_BANDS = {0: 'Low', 1: 'Mid', 2: 'High'}

def get_track_eq(track_index):
    """Get all EQ band settings for a track."""
    band_count = mixer.getEqBandCount()  # 3
    bands = []

    for band in range(band_count):
        bands.append({
            'band': band,
            'name': EQ_BANDS.get(band, f'Band {band}'),
            'gain': mixer.getEqGain(track_index, band),        # 0-1 normalized
            'gainDb': mixer.getEqGain(track_index, band, 1),   # dB
            'frequency': mixer.getEqFrequency(track_index, band),  # 0-1 normalized
            'frequencyHz': mixer.getEqFrequency(track_index, band, 1),  # Hz
            'bandwidth': mixer.getEqBandwidth(track_index, band)   # 0-1 normalized
        })

    return {
        'success': True,
        'track': track_index,
        'trackName': mixer.getTrackName(track_index),
        'bands': bands
    }

def set_eq_band(track_index, band, gain=None, frequency=None, bandwidth=None):
    """
    Set EQ band parameters. All values are normalized 0.0-1.0.
    Only specified parameters are changed.
    """
    if band < 0 or band >= mixer.getEqBandCount():
        return {'success': False, 'error': f'Invalid band {band}. Use 0-2 (Low/Mid/High).'}

    if gain is not None:
        mixer.setEqGain(track_index, band, gain)
    if frequency is not None:
        mixer.setEqFrequency(track_index, band, frequency)
    if bandwidth is not None:
        mixer.setEqBandwidth(track_index, band, bandwidth)

    # Read back all values
    return {
        'success': True,
        'track': track_index,
        'band': band,
        'bandName': EQ_BANDS.get(band, f'Band {band}'),
        'gain': mixer.getEqGain(track_index, band),
        'gainDb': mixer.getEqGain(track_index, band, 1),
        'frequency': mixer.getEqFrequency(track_index, band),
        'frequencyHz': mixer.getEqFrequency(track_index, band, 1),
        'bandwidth': mixer.getEqBandwidth(track_index, band)
    }
```

### Access Mixer Effect Slot (Using Existing System)
```python
# Source: Existing plugins.py handler - already supports mixer slots!
# This shows how the EXISTING system works - no new code needed

# To access a plugin in mixer track 5, slot 0:
params = {
    'index': 5,       # MIXER track index (not channel!)
    'slotIndex': 0    # Effect slot (0-9)
}
result = handle_plugin_discover(params)
# Returns: {success, pluginName, parameters: [...]}

# To set a parameter on that effect:
params = {
    'paramIndex': 42,
    'value': 0.75,
    'index': 5,
    'slotIndex': 0
}
result = handle_plugin_set_param(params)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `afterRoutingChanged()` | `updateUI=True` parameter | API v36 | Cleaner single-operation code |
| No EQ API | Full EQ band control | API v35 | Can now control built-in EQ programmatically |
| No slot color API | `getSlotColor()`/`setSlotColor()` | API v32 | Visual organization of effects |

**Deprecated/outdated:**
- `trackCount()` is deprecated - use `getTrackCount()` (though both still work)

## FL Studio Mixer API Reference

### Routing Functions (Required for Phase 9)

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `setRouteTo` | `(index, destIndex, value, updateUI=False)` | None | value: 1=enable, 0=disable. updateUI added in v36 |
| `getRouteSendActive` | `(index, destIndex)` | bool | True if route is active |
| `setRouteToLevel` | `(index, destIndex, level)` | None | level: 0.0-1.0 (0.8=0dB). Route must exist first |
| `getRouteToLevel` | `(index, destIndex)` | float | Returns normalized level |
| `afterRoutingChanged` | `()` | None | Call after batch routing changes |

### EQ Functions (Required for Phase 9)

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `getEqBandCount` | `()` | int | Returns 3 (Low/Mid/High) |
| `getEqGain` | `(index, band, mode=0)` | float | mode=0: normalized, mode=1: dB |
| `setEqGain` | `(index, band, value)` | None | value: 0.0-1.0 normalized |
| `getEqFrequency` | `(index, band, mode=0)` | float | mode=0: normalized, mode=1: Hz |
| `setEqFrequency` | `(index, band, value)` | None | value: 0.0-1.0 normalized |
| `getEqBandwidth` | `(index, band)` | float | Returns normalized 0-1 |
| `setEqBandwidth` | `(index, band, value)` | None | value: 0.0-1.0 normalized |

### Effect Slot Functions (Informational)

| Function | Signature | Returns | Notes |
|----------|-----------|---------|-------|
| `isTrackSlotsEnabled` | `(index)` | bool | Check if slots are enabled |
| `enableTrackSlots` | `(index, value=-1)` | None | -1=toggle, 0=disable, 1=enable |
| `getSlotColor` | `(index, slot)` | int | RGBA color value |
| `setSlotColor` | `(index, slot, color)` | None | Set slot color |
| `isTrackPluginValid` | `(index, plugIndex)` | bool | Check if plugin exists in slot |
| `getTrackPluginId` | `(index, plugIndex)` | int | Get plugin ID for REC events |

## Open Questions

Things that couldn't be fully resolved:

1. **Pre/Post Fader Send Mode**
   - What we know: User decision says support BOTH modes, but `setRouteToLevel()` has no mode parameter
   - What's unclear: Is pre/post controlled elsewhere (track settings)? Or is it not exposed in API?
   - Recommendation: Research further during implementation. May be a track-level setting, not per-route.

2. **EQ Frequency Range Mapping**
   - What we know: Values are normalized 0.0-1.0, mode=1 returns Hz
   - What's unclear: Exact frequency range (20Hz-20kHz? Per band different?)
   - Recommendation: Use mode=1 to show Hz in responses. Let users work in normalized values for setting.

3. **Route Level Scale**
   - What we know: 0.8 = 0dB (unity) like mixer volume
   - What's unclear: Exact dB range (is 1.0 = +5.6dB like mixer?)
   - Recommendation: Document 0.8 = unity. Accept percentage and map 100% to 0.8.

## Sources

### Primary (HIGH confidence)
- [FL Studio Online Manual - MIDI Scripting](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm) - Complete mixer API reference with all routing and EQ functions
- Existing codebase: `fl-bridge/handlers/plugins.py` - Already has slotIndex support for mixer effect slots
- Existing codebase: `fl-bridge/handlers/mixer.py` - Phase 8 patterns for validation and readback

### Secondary (MEDIUM confidence)
- [FL Studio API Stubs GitHub](https://github.com/MaddyGuthridge/FL-Studio-API-Stubs) - Type stubs and documentation
- Phase 8 RESEARCH.md - Established patterns for this project

### Tertiary (LOW confidence)
- None - all critical information verified via official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses only official FL Studio API, patterns established in codebase
- Architecture: HIGH - Follows existing handler/tool patterns, reuses plugin system
- Pitfalls: HIGH - Documented in official API, consistent with Phase 8 volume/color patterns

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days - FL Studio API is stable)

## Implementation Checklist

For the planner, the following handlers and tools are needed:

### Plan 09-01: Mixer Routing

#### Python Handlers (fl-bridge/handlers/mixer.py - EXTEND)

| Handler | Purpose | Parameters | Returns |
|---------|---------|------------|---------|
| `mixer.get_routing` | Get full routing table | (none) | `{success, trackCount, routes: [{source, dest, level}]}` |
| `mixer.get_track_sends` | Get sends for one track | `index` or `name` | `{success, track, sends: [{dest, level}]}` |
| `mixer.set_route` | Create/remove route | `source`, `dest`, `enabled` | `{success, source, dest, active}` |
| `mixer.set_route_level` | Set send level | `source`, `dest`, `level` | `{success, source, dest, level}` |

#### MCP Tools (src/tools/mixer.ts - EXTEND or new routing.ts)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `get_mixer_routing` | Get full routing table | (none) |
| `get_track_sends` | Get sends for one track | `track` (index or name) |
| `create_send` | Create send route | `source`, `destination`, `level?` |
| `remove_send` | Remove send route | `source`, `destination` |
| `set_send_level` | Set send level | `source`, `destination`, `level` |

### Plan 09-02: Mixer EQ and Effect Slots

#### Python Handlers (fl-bridge/handlers/mixer.py - EXTEND)

| Handler | Purpose | Parameters | Returns |
|---------|---------|------------|---------|
| `mixer.get_eq` | Get track EQ bands | `index` | `{success, bands: [{gain, freq, bandwidth}]}` |
| `mixer.set_eq_band` | Set EQ band params | `index`, `band`, `gain?`, `freq?`, `bandwidth?` | `{success, band, ...values}` |

#### MCP Tools (src/tools/mixer.ts - EXTEND)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `get_mixer_eq` | Get track EQ | `track` |
| `set_mixer_eq_band` | Set EQ band | `track`, `band`, `gain?`, `frequency?`, `bandwidth?` |
| `discover_mixer_effect` | Discover effect in slot | `track`, `slot` |
| `get_mixer_effect_param` | Get effect param | `track`, `slot`, `name` |
| `set_mixer_effect_param` | Set effect param | `track`, `slot`, `name`, `value` |

### Existing (No Changes Needed to Handlers)
- `plugins.discover` - Already supports slotIndex for mixer effects
- `plugins.get_param` - Already supports slotIndex
- `plugins.set_param` - Already supports slotIndex

### Note on Effect Slot Tools
The "mixer effect" tools can be thin wrappers that translate user-friendly `track + slot` to the existing plugin system's `index + slotIndex`. This provides better UX without duplicating handler code.
