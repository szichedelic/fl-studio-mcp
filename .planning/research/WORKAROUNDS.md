# FL Studio Python API: Critical Gap Workarounds Research

**Research Date:** 2026-02-25
**Confidence Level:** HIGH (verified against official IL-Group FL-Studio-API-Stubs documentation)

## Executive Summary

| Gap | Verdict | Workaround Available |
|-----|---------|---------------------|
| Tempo Setting | **POSSIBLE** | `general.processRECEvent()` with `midi.REC_Tempo` |
| Time Signature (Read) | **POSSIBLE** | `score.tsnum` / `score.tsden` (Piano Roll scripts only) |
| Time Signature (Set) | **NOT POSSIBLE** | No API function exists |
| Playlist Pattern Placement | **NOT POSSIBLE** | No API function exists |

---

## 1. Tempo Setting

### Verdict: POSSIBLE via processRECEvent

**Confidence:** HIGH (documented in official API stubs with example code)

### Solution

```python
import general
import midi

# Set tempo to 120 BPM
general.processRECEvent(
    midi.REC_Tempo,           # Target: global tempo
    120000,                    # Value: BPM * 1000 (120 BPM = 120000)
    midi.REC_Control | midi.REC_UpdateControl  # Flags: set and update display
)

# Set tempo to 85.5 BPM (supports decimal precision)
general.processRECEvent(
    midi.REC_Tempo,
    85500,  # 85.5 * 1000
    midi.REC_Control | midi.REC_UpdateControl
)
```

### Key Details

| Aspect | Detail |
|--------|--------|
| Module | `general` (FL State submodule) |
| Event ID | `midi.REC_Tempo` (equals `REC_Global_First + 5`) |
| Value Format | Integer = BPM * 1000 |
| Precision | Supports 0.001 BPM precision |
| Flags | `midi.REC_Control | midi.REC_UpdateControl` |

### Flag Reference

| Flag | Purpose |
|------|---------|
| `REC_UpdateValue` | Update the value |
| `REC_UpdateControl` | Update UI (tempo display) |
| `REC_Control` | Composite flag for MIDI controller values |
| `REC_ShowHint` | Show hint message in FL Studio |
| `REC_Store` | Store for automation recording |

### Reading Current Tempo

Already implemented in your project at `fl-bridge/handlers/state.py`:

```python
# Returns float BPM
tempo = mixer.getCurrentTempo()

# Can also request integer
tempo_int = mixer.getCurrentTempo(asInt=True)
```

### Implementation for FL Bridge

```python
# handlers/tempo.py (new file)
from typing import Dict, Any

try:
    import general
    import midi
    import mixer
except ImportError:
    general = None
    midi = None
    mixer = None

from protocol.commands import register_handler

def handle_tempo_set(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set project tempo.

    Args:
        params: {bpm: float}  # e.g., 120.0 or 85.5

    Returns:
        dict: {success: True, bpm: float}
    """
    try:
        if general is None or midi is None:
            return {'success': False, 'error': 'Required modules not available'}

        bpm = params.get('bpm')
        if bpm is None:
            return {'success': False, 'error': 'bpm parameter required'}

        # Convert to API format (BPM * 1000)
        tempo_value = int(float(bpm) * 1000)

        # Set tempo via REC event
        general.processRECEvent(
            midi.REC_Tempo,
            tempo_value,
            midi.REC_Control | midi.REC_UpdateControl
        )

        # Verify by reading back
        actual_tempo = mixer.getCurrentTempo()

        return {
            'success': True,
            'bpm': actual_tempo,
            'requested': bpm
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def handle_tempo_get(params: Dict[str, Any]) -> Dict[str, Any]:
    """Get current project tempo."""
    try:
        if mixer is None:
            return {'success': False, 'error': 'Mixer module not available'}

        return {
            'success': True,
            'bpm': mixer.getCurrentTempo()
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

register_handler('tempo.set', handle_tempo_set)
register_handler('tempo.get', handle_tempo_get)
```

### Sources

- [Global Properties REC Events](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/midi/__rec_events/global%20properties/) - Official documentation with example
- [Process Flags Reference](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/midi/__rec_events/process%20flags/)
- [Mixer Properties](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/properties/) - `getCurrentTempo()`

---

## 2. Time Signature

### Verdict: READ-ONLY in Piano Roll scripts; NOT ACCESSIBLE in MIDI scripts

**Confidence:** HIGH (verified read-only in official documentation)

### What's Available

**Piano Roll Scripts ONLY** (`.pyscript` files via `flpianoroll` module):

```python
# In a Piano Roll script (.pyscript)
import flpianoroll

# Read time signature (READ-ONLY)
numerator = flpianoroll.score.tsnum    # e.g., 4
denominator = flpianoroll.score.tsden  # e.g., 4

# Note: These are READ-ONLY properties
# "The project's overall time signature numerator, as per the project settings.
#  This does not reflect time signature markers."
```

**MIDI Controller Scripts** (what FL Bridge uses):

- `general.getRecPPB()` - Returns timebase * beats per bar (affected by time signature)
- `general.getRecPPQ()` - Returns PPQN (ticks per quarter note)
- No direct time signature access

### What's NOT Available

| Operation | Status | Notes |
|-----------|--------|-------|
| Read time signature in MIDI scripts | **NO** | Only available in Piano Roll scripts |
| Set time signature programmatically | **NO** | Not exposed in any API |
| Read time signature markers | **NO** | Properties ignore markers |
| Create time signature markers | **NO** | No API function |

### Partial Workaround: Infer from PPQN

```python
import general

# PPB = PPQN * beats_per_bar
ppb = general.getRecPPB()  # e.g., 3840 at 4/4 with 960 PPQN
ppq = general.getRecPPQ()  # e.g., 960

# Infer beats per bar (assumes quarter note = 1 beat)
beats_per_bar = ppb // ppq  # e.g., 4

# This gives numerator IF denominator is 4
# Cannot determine actual denominator (3/4 vs 6/8 indistinguishable)
```

**Limitation:** This inference fails for non-quarter-note denominators.

### Guided Workflow Option

Since the API cannot set time signature, a "guided workflow" approach:

```python
def handle_time_signature_guide(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Guide user to set time signature manually.

    Returns instructions since API cannot set this directly.
    """
    numerator = params.get('numerator', 4)
    denominator = params.get('denominator', 4)

    return {
        'success': True,
        'manual_action_required': True,
        'instructions': [
            f'Set time signature to {numerator}/{denominator}:',
            '1. Press F10 to open Project Settings',
            '2. Click "Project" tab',
            f'3. Set "Time sig - Numerator" to {numerator}',
            f'4. Set "Time sig - Denominator" to {denominator}',
            '5. Close settings dialog'
        ],
        'keyboard_shortcut': 'F10'
    }
```

### Sources

- [Score Class (flpianoroll)](https://il-group.github.io/FL-Studio-API-Stubs/piano_roll_scripting/flpianoroll/score/) - tsnum/tsden properties documented as read-only
- [FL State Functions](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/fl%20state/) - getRecPPB()/getRecPPQ()

---

## 3. Playlist Pattern Placement

### Verdict: NOT POSSIBLE via API

**Confidence:** HIGH (exhaustive search of all API modules found no placement functions)

### Modules Investigated

| Module | Functions Found | Pattern Placement? |
|--------|-----------------|-------------------|
| `playlist` | Track management (name, color, mute, solo) | **NO** |
| `playlist.performance` | `triggerLiveClip()` for performance mode | **NO** (live triggering only) |
| `playlist.tracks` | Track count, names, colors, selection | **NO** |
| `patterns` | Select, rename, clone, find empty | **NO** |
| `patterns.properties` | Length, color, name getters/setters | **NO** |
| `arrangement` | Markers, time, selection | **NO** |
| `arrangement.live` | Live selection points | **NO** |
| REC Events | Global/Channel/Mixer/Playlist properties | **NO** (control parameters, not placement) |

### What `triggerLiveClip()` Actually Does

```python
# playlist.triggerLiveClip(index, subNum, flags, velocity)
#
# - ONLY works in Performance Mode
# - Triggers playback of existing clips
# - Does NOT place clips on the timeline
# - Does NOT create arrangement structure
```

From the documentation:
> "Triggers live clips for a track at block number, or stops clips with subNum = -1"

This is for **live performance triggering**, not arrangement composition.

### What the API CAN Do with Patterns

```python
import patterns

# Select pattern (jump to it in channel rack)
patterns.jumpToPattern(1)

# Get/set pattern properties
name = patterns.getPatternName(1)
patterns.setPatternName(1, "Verse 1")
patterns.setPatternColor(1, 0xFF0000)  # Red

# Find empty pattern slot
patterns.findFirstNextEmptyPat(0)

# Clone pattern (creates copy in pattern list, NOT on playlist)
patterns.clonePattern(1)

# Get pattern info
length = patterns.getPatternLength(1)
count = patterns.patternCount()
```

### What IS Missing

| Operation | API Function | Status |
|-----------|-------------|--------|
| Place pattern on playlist at position | None | **NOT AVAILABLE** |
| Create clip on playlist track | None | **NOT AVAILABLE** |
| Read clip positions from playlist | None | **NOT AVAILABLE** |
| Move/resize clips | None | **NOT AVAILABLE** |
| Delete clips from playlist | None | **NOT AVAILABLE** |

### Workarounds Considered

#### 1. MIDI Recording (Partial)

Write notes to a pattern via Piano Roll scripts, then user manually places:

```python
# This project's approach: write notes to pattern via flpianoroll
# User must manually drag pattern to playlist
```

**Limitation:** Requires manual placement step.

#### 2. FLP File Manipulation (External)

The [PyDaw library](https://github.com/andrewrk/PyDaw) can parse/write FLP files:

```python
# EXTERNAL approach (not via FL Studio API)
# Requires FL Studio to be closed, then file modified, then reopened
```

**Limitation:** Cannot operate while FL Studio has project open.

#### 3. Performance Mode Clips (Not a workaround)

Performance mode clips exist BEFORE the song start marker and are for live triggering, not traditional arrangement.

### Guided Workflow Option

```python
def handle_pattern_arrange_guide(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Guide user to place pattern on playlist manually.
    """
    pattern_index = params.get('pattern', 1)
    bar = params.get('bar', 1)
    track = params.get('track', 1)

    return {
        'success': True,
        'manual_action_required': True,
        'instructions': [
            f'Place Pattern {pattern_index} on the playlist:',
            f'1. In the Pattern Picker (left side), find Pattern {pattern_index}',
            f'2. Drag it to Track {track} at Bar {bar}',
            'OR',
            f'1. Select Pattern {pattern_index} in Channel Rack',
            f'2. In Playlist, Ctrl+Click at Bar {bar}, Track {track}',
            '(This creates a clip of the selected pattern)'
        ]
    }
```

### Sources

- [Playlist Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/playlist/)
- [Playlist Performance](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/playlist/performance/)
- [Playlist Tracks](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/playlist/tracks/)
- [Patterns Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/patterns/)
- [Arrangement Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/arrangement/)

---

## Summary: Implementation Recommendations

### Immediately Implementable

| Feature | Implementation | Effort |
|---------|---------------|--------|
| `tempo.set` | `general.processRECEvent()` with `midi.REC_Tempo` | Low |
| `tempo.get` | `mixer.getCurrentTempo()` (already in state.py) | Done |

### Requires Guided Workflow

| Feature | Approach | Notes |
|---------|----------|-------|
| Time signature | Return instructions for F10 > Project Settings | User must act |
| Pattern placement | Return instructions for drag-drop or Ctrl+Click | User must act |

### Not Possible

| Feature | Reason |
|---------|--------|
| Programmatic time signature setting | No API function exists |
| Programmatic playlist manipulation | No API functions for clip placement |

---

## Other Useful REC Events Discovered

For future reference, these global REC events exist:

| Event | Purpose | Value Format |
|-------|---------|--------------|
| `REC_MainVol` | Master volume | Standard range |
| `REC_MainShuffle` | Swing amount | Standard range |
| `REC_MainPitch` | Master pitch | Standard range |
| `REC_Tempo` | Project tempo | BPM * 1000 |

---

## Verification Status

| Claim | Verification Method | Status |
|-------|-------------------|--------|
| `REC_Tempo` sets tempo | Official API stubs documentation with example | VERIFIED |
| `mixer.getCurrentTempo()` reads tempo | Already working in project code | VERIFIED |
| `tsnum`/`tsden` are read-only | Documentation explicitly states this | VERIFIED |
| No playlist placement API | Exhaustive module search | VERIFIED |
| `triggerLiveClip` for performance only | Documentation describes behavior | VERIFIED |
