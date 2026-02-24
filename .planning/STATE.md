# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Natural language to human-sounding music in FL Studio
**Current focus:** Milestone v2.0 — Production Pipeline (defining requirements)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-23 — Milestone v2.0 started

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~14 min
- Total execution time: ~74 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | ~64 min | ~21 min |
| 02 | 2 | ~10 min | ~5 min |

## Accumulated Context

### Decisions

- [v1.0]: Single loopMIDI port for bidirectional communication
- [v1.0]: Port numbers must match between Input and Output in FL Studio MIDI settings
- [v1.0]: OnIdle not reliable — send responses immediately in OnSysEx
- [v1.0]: device.midiOutSysex() takes 1 argument only
- [v1.0]: Script needs `# name=` metadata comment on line 1
- [v1.0]: Env vars renamed to FL_PORT_TO_FL / FL_PORT_FROM_FL
- [v1.0]: Note timing in beats (quarter notes), converted to ticks via PPQ at runtime
- [v1.0]: Velocity as 0.0-1.0 float (FL Studio native)
- [v1.0]: Tonal chroma is root-relative, not C-relative
- [v1.0]: Embedded .pyscript approach — Node.js writes note data as Python literals
- [v1.0]: FL Studio piano roll subinterpreter has NO file I/O (open, os.open, os.popen all fail)
- [v1.0]: MIDI controller script CAN write files via __file__-relative paths but NOT to sibling directories
- [v1.0]: os.environ[]=... (putenv) fails in both MIDI scripts and .pyscripts

### Blockers/Concerns

- Piano Roll API only works when piano roll is open — need fallback strategies
- ComposeWithBridge.pyscript requires manual trigger (user clicks script in Tools menu)
- FL Studio plugin parameter API needs hands-on research (getParamValue may be broken)
- Audio rendering programmatic control needs discovery
- Sample loading into channels needs discovery

## Session Continuity

Last session: 2026-02-23
Stopped at: Milestone v2.0 initialization
Resume file: None
