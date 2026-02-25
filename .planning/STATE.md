# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Natural language to human-sounding music in FL Studio
**Current focus:** Phase 10 - Playlist & Markers

## Current Position

Phase: 10 of 11 (Playlist & Markers)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-25 - Completed 10-01-PLAN.md

Progress: [####################] 100% v2.0 | [██████░░░░] 56% v2.1 (5/9 plans)

## Performance Metrics

**Velocity (v2.0):**
- Total plans completed: 14
- Total execution time: ~3 days (2026-02-23 to 2026-02-25)

**By Phase (v2.1):**

| Phase | Plans | Status |
|-------|-------|--------|
| 8. Mixer Core | 2/2 | Complete |
| 9. Mixer Routing | 2/2 | Complete |
| 10. Playlist & Markers | 1/3 | In progress |
| 11. Project Controls | 0/2 | Not started |

## Accumulated Context

### Decisions

Recent decisions affecting v2.1 work:
- Mixer is 0-indexed (0=Master, 1+=inserts), playlist is 1-indexed
- Volume 0.8 = unity gain (0dB), not 1.0
- Color format is BGR (0x--BBGGRR), not RGB
- Tempo IS settable via `general.processRECEvent(midi.REC_Tempo, bpm*1000, flags)`
- Must call `mixer.afterRoutingChanged()` after batch routing operations
- NO API for playlist clip placement - track management only
- Use explicit 1/0 for mute/solo, NOT -1 (toggle mode is stateless/unpredictable)
- MCP tools accept RGB hex (#RRGGBB) for colors, convert to BGR internally
- Validation helper `_validate_track_index()` shared across handlers
- Track resolution supports both index (int) and name (str) via _resolve_track_ref
- Routes must exist before setting level (use set_route first)
- EQ values returned in both normalized (0-1) and real units (dB, Hz)
- Level normalization: 0dB = 0.8, using 10^(dB/50) * 0.8 formula for dB conversion
- MCP tools accept level in normalized (0-1), percentage (0-100), OR decibels
- Effect slot tools: track param = channelIndex for paramCache integration

### From v2.0

- FL Studio piano roll subinterpreter has no file I/O - must use embedded .pyscript approach
- VST parameter indexing is positional - need name-based resolution
- FL Studio has no programmatic render API - guided manual workflow required
- `getParamValue` unreliable for VSTs - use shadow state
- SysEx payload size limited - chunk large responses

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 10-01-PLAN.md (Playlist track management)
Resume file: None
