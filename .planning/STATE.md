# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Natural language to human-sounding music in FL Studio
**Current focus:** Phase 2 - Note Generation Core

## Current Position

Phase: 2 of 10 (Note Generation Core)
Plan: 02-02 of 3 in current phase
Status: In progress
Last activity: 2026-02-23 - Completed 02-01-PLAN.md

Progress: [####------] 40%

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

- [Phase 1]: Single loopMIDI port can work but dual ports (FL Bridge In/Out) are cleaner
- [Phase 1]: Port numbers must match between Input and Output in FL Studio MIDI settings
- [Phase 1]: OnIdle not reliable — send responses immediately in OnSysEx
- [Phase 1]: device.midiOutSysex() takes 1 argument only
- [Phase 1]: Script needs `# name=` metadata comment on line 1
- [Phase 1]: Env vars renamed to FL_PORT_TO_FL / FL_PORT_FROM_FL
- [Phase 2]: JSON file-based IPC between FL Bridge handler and .pyscript (only viable approach)
- [Phase 2]: Note timing in beats (quarter notes) in JSON, converted to ticks via PPQ at runtime
- [Phase 2]: Velocity as 0.0-1.0 float (FL Studio native) not 0-127 MIDI
- [Phase 2]: createDialog() entry point for piano roll scripts (FL Studio convention)
- [Phase 2]: Tonal chroma is root-relative, not C-relative -- isInScale must offset by root chroma

### Blockers/Concerns

- [Phase 2]: Piano Roll API only works when piano roll is open — need fallback strategies
- [Phase 2]: ComposeWithBridge.pyscript must be manually copied to FL Studio Piano roll scripts directory
- [Phase 5]: Humanization research spike needed before implementation
- [Phase 7-8]: VST parameter discovery for Serum 2 and AD2 requires dedicated research

## Session Continuity

Last session: 2026-02-23T23:10:19Z
Stopped at: Completed 02-01-PLAN.md (music theory engine)
Resume file: None
