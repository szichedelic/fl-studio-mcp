---
phase: 08-mixer-core
plan: 01
subsystem: fl-bridge-handlers
tags: [mixer, python, fl-bridge, mutations]

dependency-graph:
  requires:
    - Phase 4 (Plugin Control) - handler pattern established
  provides:
    - 6 mixer mutation handlers (set_volume, set_pan, mute, solo, set_name, set_color)
    - Extended state.mixer with color field
  affects:
    - Plan 08-02 (MCP tools that call these handlers)
    - Future mixing automation workflows

tech-stack:
  added: []
  patterns:
    - Explicit mute/solo (1/0 not -1 toggle)
    - Readback confirmation on all mutations
    - Index validation helper function

key-files:
  created:
    - fl-bridge/handlers/mixer.py
  modified:
    - fl-bridge/handlers/state.py
    - fl-bridge/handlers/__init__.py

decisions:
  - decision: "Use explicit 1/0 for mute/solo instead of -1 toggle"
    rationale: "Toggle mode is stateless and unpredictable; explicit mode ensures idempotent operations"
  - decision: "Return readback values on all mutations"
    rationale: "Confirms actual state after FL Studio applies the change"
  - decision: "Share validation helper _validate_track_index()"
    rationale: "DRY pattern across all 6 handlers"

metrics:
  duration: "1m 33s"
  completed: "2026-02-25"
---

# Phase 8 Plan 1: Mixer Mutation Handlers Summary

**One-liner:** Six FL Bridge handlers for mixer track mutations (volume/pan/mute/solo/name/color) plus state.mixer color extension.

## What Was Built

### 1. Extended state.mixer with Color Field
Added `'color': mixer.getTrackColor(i)` to the mixer state response, returning track color in FL Studio's BGR format (0x--BBGGRR).

### 2. Mixer Mutation Handlers (mixer.py)
Created 6 new handlers following the established pattern from plugins.py:

| Handler | Parameters | Notes |
|---------|------------|-------|
| `mixer.set_volume` | index, volume (0.0-1.0) | 0.8 = unity gain (0dB) |
| `mixer.set_pan` | index, pan (-1.0 to 1.0) | 0.0 = center |
| `mixer.mute` | index, mute (bool) | Explicit 1/0, NOT toggle |
| `mixer.solo` | index, solo (bool) | Explicit 1/0, NOT toggle |
| `mixer.set_name` | index, name (str) | Sets track label |
| `mixer.set_color` | index, color (int) | BGR format |

All handlers:
- Validate track index is in range (0 to trackCount-1)
- Return readback values confirming actual state
- Use `midi.PIM_None` for immediate volume/pan changes

### 3. Handler Registration
Added `from handlers import mixer` to `__init__.py` to auto-register handlers on FL Bridge startup.

## Key Implementation Details

```python
# CRITICAL: Explicit mute/solo, not toggle
mixer.muteTrack(index, 1 if mute else 0)  # NOT -1
mixer.soloTrack(index, 1 if solo else 0)  # NOT -1

# Volume range note
# 0.8 = unity gain (0dB), NOT 1.0

# Color format
# BGR: 0x--BBGGRR (not RGB)
```

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `7c5b5ed` | feat | Extend state.mixer to include track color |
| `38bc8ee` | feat | Create mixer mutation handlers (6 handlers) |
| `a232463` | feat | Register mixer handlers in __init__.py |

## Deviations from Plan

None - plan executed exactly as written.

## Testing Notes

These handlers cannot be tested until:
1. Files are synced to FL Studio runtime directory (`C:/Users/jared/Documents/Image-Line/FL Studio/Settings/Hardware/FLBridge/`)
2. FL Studio reloads the MIDI script
3. MCP tools are created (Plan 08-02) to call these handlers

## Next Phase Readiness

**Ready for:** Plan 08-02 (MCP Tools)
- All 6 handlers are registered and ready
- state.mixer includes color for state queries
- Handlers follow established pattern from plugins.py

**Blockers:** None
