# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Natural language to human-sounding music in FL Studio
**Current focus:** v2.1 SHIPPED - ready for next milestone

## Current Position

Phase: All phases complete through v2.1
Plan: —
Status: Milestone v2.1 shipped
Last activity: 2026-02-25 - Completed v2.1 Song Building & Mixing

Progress: [####################] v1.0 | [####################] v2.0 | [####################] v2.1

## Performance Metrics

**Milestones shipped:**

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 Foundation & Note Generation | 1-2 | 6 | 2026-02-23 |
| v2.0 Production Pipeline | 3-7 | 14 | 2026-02-25 |
| v2.1 Song Building & Mixing | 8-11 | 9 | 2026-02-25 |

**Total:** 11 phases, 29 plans, ~14,000 lines of code

## Accumulated Context

### Key Decisions (Carry Forward)

Technical decisions that inform future work:

**Communication:**
- SysEx-over-MIDI bridge via loopMIDI for FL Studio integration
- FL Studio piano roll subinterpreter has no file I/O - must use embedded .pyscript approach
- SysEx payload size limited - chunk large responses

**Plugin Control:**
- VST parameter indexing is positional - need name-based resolution
- `getParamValue` unreliable for VSTs - use shadow state
- 3-tier fuzzy name matching (exact, prefix, contains) for param names

**Mixer:**
- Mixer is 0-indexed (0=Master, 1+=inserts)
- Volume 0.8 = unity gain (0dB), not 1.0
- Color format is BGR (0x--BBGGRR) internally, RGB hex in MCP tools
- Must call `mixer.afterRoutingChanged()` after batch routing operations

**Playlist:**
- Playlist tracks are 1-indexed (different from mixer!)
- NO API for playlist clip placement - track management only
- Use explicit 1/0 for mute/solo, NOT -1 (toggle mode is stateless)

**Project:**
- Tempo: `bpm * 1000` for processRECEvent, `REC_Control | REC_UpdateControl` for UI update
- Position setSongPos: only modes -1, 0, 1, 2 work for writing (3-5 are read-only)
- Undo/Redo: use `undoUp()`/`undoDown()`, NOT `undo()` (undo toggles unpredictably)

**Rendering:**
- FL Studio has no programmatic render API - guided manual workflow required
- SoX CLI for audio processing (pitch, reverse, timestretch, layer)

### Out of Scope (Future Candidates)

- Automation clips (AUTO-01, AUTO-02)
- Guided pattern placement workflow (ARR-01, ARR-02)
- Addictive Drums 2 integration
- Mixing/mastering plugins (Neutron, Ozone)
- Drum pattern generation

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: v2.1 milestone shipped
Resume file: None
