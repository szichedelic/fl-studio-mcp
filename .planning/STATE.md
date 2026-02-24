# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Natural language to human-sounding music in FL Studio
**Current focus:** Phase 4 - Generic Plugin Control

## Current Position

Phase: 4 of 7 (Generic Plugin Control)
Plan: 2 of 3
Status: In progress
Last activity: 2026-02-24 — Completed 04-02-PLAN.md (Plugin Parameter Backend)

Progress: [########░░] 85% (11/13 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: ~8 min
- Total execution time: ~87 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | ~64 min | ~21 min |
| 02 | 3 | ~10 min | ~3 min |
| 03 | 3 | ~8 min | ~2.7 min |
| 04 | 2 | ~5 min | ~2.5 min |

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
- [03-03]: Preset deep-merge: per-field explicit overrides win over preset defaults
- [03-03]: timing_amount 0-1 maps to sigma 0.001-0.025 for user-friendly control
- [03-03]: humanize param on generators but NOT on add_notes (use humanize_notes instead)
- [04-01]: MAX_PAYLOAD_BYTES=1800 for SysEx chunking (conservative under 2048 RtMidi buffer)
- [04-01]: Chunking transparent to SysExCodec — reassembly builds synthetic message before decode
- [04-01]: build_sysex_response preserved unchanged; chunked version is additive
- [04-02]: setParamValue arg order enforced: value FIRST, then paramIndex (FL Studio API)
- [04-02]: Three-tier param name resolution: exact -> prefix -> contains (case-insensitive)
- [04-02]: Shadow state preserves user-set values over discovered values on re-scan

### Blockers/Concerns

- FL Studio plugin parameter API needs hands-on testing (Phase 4 spike)
- Serum 2 actual parameter names unknown until runtime discovery (Phase 5 spike)
- Audio rendering has no programmatic API — manual Ctrl+R required (Phase 6)
- Sample loading into channels has no API — user drag-and-drop required (Phase 7)

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 04-02-PLAN.md (Plugin Parameter Backend)
Resume file: None
