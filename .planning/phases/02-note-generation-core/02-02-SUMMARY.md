---
phase: 02-note-generation-core
plan: 02
subsystem: bridge
tags: [flpianoroll, piano-roll-script, pyscript, json-ipc, note-creation, fl-bridge]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: FL Bridge handler registration pattern, protocol.commands.register_handler, device_FLBridge.py OnInit import pattern
provides:
  - pianoroll.addNotes handler that stages note data as JSON
  - pianoroll.clearNotes handler that stages clear action as JSON
  - pianoroll.readState handler that reads exported piano roll state
  - ComposeWithBridge.pyscript that creates notes via flpianoroll.score.addNote()
  - Shared data directory (fl-bridge/shared/) for JSON IPC between handlers and .pyscript
affects: [02-note-generation-core/02-03, 03-piano-roll-editing, 04-drum-patterns]

# Tech tracking
tech-stack:
  added: [flpianoroll (FL Studio built-in, .pyscript only)]
  patterns: [JSON file-based IPC between MIDI controller script and piano roll script]

key-files:
  created:
    - fl-bridge/handlers/pianoroll.py
    - fl-bridge/shared/.gitkeep
    - piano-roll-scripts/ComposeWithBridge.pyscript
  modified:
    - fl-bridge/device_FLBridge.py
    - fl-bridge/handlers/__init__.py
    - .gitignore

key-decisions:
  - "Used JSON file-based IPC between FL Bridge handler and .pyscript (only viable approach since flpianoroll is unavailable in MIDI controller scripts)"
  - "Note timing in beats (quarter notes) in JSON, converted to ticks via PPQ in .pyscript at runtime"
  - "Velocity as 0.0-1.0 float (FL Studio native) not 0-127 MIDI"
  - "createDialog() as entry point name (FL Studio piano roll script convention)"
  - "Fallback path resolution in .pyscript for non-standard FL Bridge installation locations"

patterns-established:
  - "JSON IPC pattern: handler writes note_request.json, .pyscript reads and applies, then exports piano_roll_state.json"
  - "Piano roll script pattern: createDialog() + apply(form) entry points with flpianoroll module"

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 2 Plan 02: FL Bridge Pianoroll Handler + ComposeWithBridge.pyscript Summary

**JSON-based IPC bridge between FL Bridge MIDI controller script and piano roll script for full-fidelity note creation via flpianoroll.score.addNote()**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T23:04:03Z
- **Completed:** 2026-02-23T23:06:43Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- FL Bridge pianoroll handler with three commands (addNotes, clearNotes, readState) following existing handler registration pattern
- ComposeWithBridge.pyscript that reads staged JSON data and creates notes in FL Studio piano roll with proper tick conversion
- Shared data directory with .gitignore for runtime JSON files, enabling clean separation between FL Bridge and piano roll script

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FL Bridge pianoroll handler and shared data directory** - `77ec836` (feat)
2. **Task 2: Create ComposeWithBridge.pyscript for FL Studio Piano Roll** - `75633cc` (feat)

## Files Created/Modified
- `fl-bridge/handlers/pianoroll.py` - Three registered handlers for addNotes, clearNotes, readState commands
- `fl-bridge/shared/.gitkeep` - Shared data directory for JSON IPC between handler and .pyscript
- `piano-roll-scripts/ComposeWithBridge.pyscript` - FL Studio piano roll script that reads JSON and creates notes via flpianoroll
- `fl-bridge/device_FLBridge.py` - Updated OnInit to import pianoroll handler module
- `fl-bridge/handlers/__init__.py` - Added pianoroll to handler imports
- `.gitignore` - Added fl-bridge/shared/*.json to exclude runtime data files

## Decisions Made
- **createDialog() vs createForm()**: Used `createDialog()` as the dialog creation entry point, matching FL Studio's piano roll script convention (`ScriptDialog` constructor). The plan mentioned `createForm()` but the FL Studio API uses `createDialog()`.
- **Fallback path resolution**: Added secondary path resolution in .pyscript relative to the script's own location, in case FL Bridge is installed in a non-standard directory.
- **Error resilience**: Made request file cleanup and state export non-critical (wrapped in try/except) so script completion isn't blocked by file I/O issues.
- **clearNotes fallback**: Implemented `flp.score.clearNotes(False)` with fallback to reverse-order deletion for older FL Studio versions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

To use the ComposeWithBridge.pyscript, users need to:
1. Copy `piano-roll-scripts/ComposeWithBridge.pyscript` to `Documents/Image-Line/FL Studio/Settings/Piano roll scripts/`
2. The FL Bridge handler and shared directory are already part of the fl-bridge installation

## Next Phase Readiness
- Pianoroll handler ready to receive commands from MCP tools (Plan 02-03)
- JSON data format established for note exchange between MCP server and FL Studio
- Piano roll state export enables MCP to read what's currently in the piano roll
- Needs Plan 02-01 (music theory engine) and Plan 02-03 (MCP tool wiring) to complete the end-to-end flow

---
*Phase: 02-note-generation-core*
*Completed: 2026-02-23*
