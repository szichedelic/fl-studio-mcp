---
phase: 11-project-controls
plan: 01
subsystem: project-controls
tags: [tempo, position, transport, playback]
completed: 2026-02-25
duration: 5m

dependency-graph:
  requires:
    - 08-mixer-core (mixer module available)
  provides:
    - project.get_tempo handler
    - project.set_tempo handler
    - project.get_position handler
    - project.set_position handler
    - get_tempo MCP tool
    - set_tempo MCP tool
    - get_position MCP tool
    - set_position MCP tool
  affects:
    - 11-02 (undo/redo will use same project.py)

tech-stack:
  added: []
  patterns:
    - processRECEvent with REC_Tempo for tempo control
    - Multiple getSongPos modes for position formats
    - Mode-based setSongPos for position jumping

key-files:
  created:
    - fl-bridge/handlers/project.py
    - src/tools/project.ts
  modified:
    - fl-bridge/handlers/__init__.py
    - src/tools/index.ts

decisions:
  - key: tempo-multiplier
    choice: "bpm * 1000 for processRECEvent"
    reason: "FL Studio API expects tempo in millibeats (120 BPM = 120000)"
  - key: position-modes
    choice: "Use modes 0/1/2/-1 for setSongPos, 3/4/5 read-only"
    reason: "API restricts modes 3-5 (B:S:T components) to read operations"
  - key: bar-indexing
    choice: "1-indexed bars (bar 1 = tick 0)"
    reason: "Matches FL Studio UI convention, user expectation"

metrics:
  tasks: 2
  commits: 2
  files-created: 2
  files-modified: 2
---

# Phase 11 Plan 01: Tempo and Position Control Summary

**One-liner:** Project tempo read/write via mixer.getCurrentTempo and processRECEvent, position read/write via transport.getSongPos/setSongPos with multi-format support.

## What Was Built

### Python Handlers (fl-bridge/handlers/project.py)

1. **handle_project_get_tempo** - Reads BPM via `mixer.getCurrentTempo()`, returns both float and rounded int
2. **handle_project_set_tempo** - Sets tempo via `general.processRECEvent(midi.REC_Tempo, bpm*1000, flags)` with UI update
3. **handle_project_get_position** - Returns position in 7 formats: bars, steps, ticks, absoluteTicks, milliseconds, fractional, hint
4. **handle_project_set_position** - Jumps to position via bars/ticks/ms/seconds/fractional using appropriate setSongPos mode

### TypeScript MCP Tools (src/tools/project.ts)

1. **get_tempo** - No params, returns current BPM
2. **set_tempo** - Accepts bpm (10-999), sets project tempo
3. **get_position** - No params, returns all position formats
4. **set_position** - Accepts one of: bars, ticks, ms, seconds

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6b7b804 | feat | Create Python handlers for tempo and position |
| cc9aabb | feat | Create TypeScript MCP tools for tempo and position |

## Key Implementation Details

### Tempo Setting
```python
# CRITICAL: Multiply by 1000 for processRECEvent (120 BPM = 120000)
tempo_value = int(bpm * 1000)
flags = midi.REC_Control | midi.REC_UpdateControl  # Updates UI
general.processRECEvent(midi.REC_Tempo, tempo_value, flags)
```

### Position Modes
- **Read (getSongPos):** All modes -1 through 5 work
- **Write (setSongPos):** Only modes -1, 0, 1, 2 work
- **Bar conversion:** `(bars - 1) * ppq * 4` for 4/4 time

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] fl-bridge/handlers/project.py exists with 4 handlers
- [x] src/tools/project.ts exists with 4 MCP tools
- [x] TypeScript compiles without errors (npm run build)
- [x] Handlers registered in __init__.py
- [x] Tools registered in index.ts
- [x] Tempo setting uses * 1000 multiplier
- [x] Position setting uses correct modes (not 3-5)

## Next Phase Readiness

Plan 11-02 (undo/redo) can proceed - will add handlers to same project.py file.

## Files Changed

```
fl-bridge/handlers/project.py      (NEW - 204 lines)
fl-bridge/handlers/__init__.py     (MODIFIED - added import)
src/tools/project.ts               (NEW - 82 lines)
src/tools/index.ts                 (MODIFIED - added registration)
```
