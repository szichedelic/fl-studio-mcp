# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Natural language to human-sounding music in FL Studio
**Current focus:** v2.1 Song Building & Mixing

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v2.1
Last activity: 2026-02-25 — Milestone v2.1 started

Progress: [░░░░░░░░░░░░░░░░░░░░] 0%

## Session Continuity

Last session: 2026-02-25
Stopped at: Defining v2.1 milestone scope
Resume file: None

## Accumulated Context

### From v2.0
- FL Studio piano roll subinterpreter has no file I/O — must use embedded .pyscript approach
- VST parameter indexing is positional, not stable IDs — need name-based resolution
- FL Studio has no programmatic render/export API — guided manual workflow required
- `getParamValue` unreliable for VSTs — use shadow state
- SysEx payload size limited — chunk large responses
