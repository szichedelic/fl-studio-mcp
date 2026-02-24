# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Natural language to human-sounding music in FL Studio
**Current focus:** Phase 3 - Humanization Engine

## Current Position

Phase: 3 of 7 (Humanization Engine)
Plan: 2 of 3 (Velocity, Note-Length, Presets)
Status: In progress
Last activity: 2026-02-24 - Completed 03-02-PLAN.md

Progress: [#######░░░] 67% (v1.0 complete, 03-01 + 03-02 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~10 min
- Total execution time: ~79 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | ~64 min | ~21 min |
| 02 | 3 | ~10 min | ~3 min |
| 03 | 2 | ~5 min | ~2.5 min |

## Accumulated Context

### Decisions

- [v1.0]: Single loopMIDI port for bidirectional communication
- [v1.0]: Embedded .pyscript approach — Node.js writes note data as Python literals
- [v1.0]: Velocity as 0.0-1.0 float, timing in beats (quarter notes)
- [v1.0]: Tonal chroma is root-relative, not C-relative
- [v2.0]: Humanization is pure TypeScript pre-processing (zero FL Studio API)
- [v2.0]: Shadow state for plugin params (getParamValue unreliable for VSTs)
- [v2.0]: Audio rendering is guided manual workflow + chokidar file watcher
- [v2.0]: SoX CLI for audio processing (not browser JS libs)
- [03-01]: Box-Muller hand-rolled instead of Gaussian RNG library (6 lines)
- [03-01]: All transforms accept optional rng parameter for seeded reproducibility
- [03-01]: Transform signature pattern: (notes, params?, rng?) => NoteData[]
- [03-02]: Drums dual-path velocity: ghost clamping below threshold, accent blending above midpoint
- [03-02]: Note-length variation hard-capped at +-30% regardless of amount parameter
- [03-02]: Presets deep-copied via JSON.parse/stringify so callers can safely mutate

### Blockers/Concerns

- FL Studio plugin parameter API needs hands-on testing (Phase 4 spike)
- Serum 2 actual parameter names unknown until runtime discovery (Phase 5 spike)
- Audio rendering has no programmatic API — manual Ctrl+R required (Phase 6)
- Sample loading into channels has no API — user drag-and-drop required (Phase 7)

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 03-02-PLAN.md (velocity, note-length, presets)
Resume file: None
