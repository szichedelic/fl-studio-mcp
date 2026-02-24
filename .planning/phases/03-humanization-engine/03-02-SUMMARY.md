---
phase: 03-humanization-engine
plan: 02
subsystem: music-engine
tags: [humanization, velocity, note-length, presets, simplex-noise, instrument-profiles]

# Dependency graph
requires:
  - phase: 03-01
    provides: HumanizationParams types, util.ts (getBeatPosition, clampVelocity), simplex-noise dependency
provides:
  - applyVelocityVariation with 5 instrument profiles (drums, piano, bass, synth, default)
  - applyNoteLengthVariation with beat-position-aware legato/staccato
  - HUMANIZATION_PRESETS and getPresetParams for 4 named presets (tight, loose, jazz, lo-fi)
  - VELOCITY_PROFILES with researched per-instrument dynamic ranges
affects: [03-03 humanize pipeline/index.ts, 03-04 MCP tool integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [simplex-noise 2D for correlated velocity, instrument velocity profiles, named preset bundles]

key-files:
  created:
    - src/music/humanize/velocity.ts
    - src/music/humanize/note-length.ts
    - src/music/humanize/presets.ts
  modified: []

key-decisions:
  - "Drums use dual-path velocity: ghost note clamping below threshold, accent blending above midpoint"
  - "Piano phrase-arc uses sine wave over ~12 notes (not time-based) for breathing effect"
  - "Note-length variation hard-capped at +-30% regardless of parameter values to prevent extreme durations"
  - "Presets return deep copies via JSON.parse/stringify so callers can safely mutate"

patterns-established:
  - "All velocity profiles use consistent shape: baseVelocityRange, downbeatBoost, variationAmount"
  - "Preset distinctiveness via orthogonal parameter axes: theta, sigma, swing, emphasis, legato"

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 3 Plan 2: Velocity, Note-Length, and Presets Summary

**Instrument-aware velocity variation (5 profiles with simplex noise), beat-position note-length articulation, and 4 named humanization presets (tight/loose/jazz/lo-fi)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T05:41:32Z
- **Completed:** 2026-02-24T05:43:28Z
- **Tasks:** 2
- **Files modified:** 3 (velocity.ts, note-length.ts, presets.ts)

## Accomplishments
- Built velocity variation engine with 5 instrument profiles using simplex-noise 2D for smooth correlated variation
- Drums produce ghost notes (0.24-0.39) and accents (0.78-0.94) with wide dynamic range; piano breathes with phrase-arc shaping; bass stays narrow (0.63-0.82)
- Note-length variation adds articulation with downbeat legato bias and off-beat staccato, capped at +-30%
- Four named presets (tight, loose, jazz, lo-fi) bundle all humanization parameters into distinct musical characters

## Task Commits

Each task was committed atomically:

1. **Task 1: Instrument-aware velocity variation with simplex noise** - `c1722d7` (feat)
2. **Task 2: Note-length variation and named presets** - `127b7e4` (feat)

## Files Created/Modified
- `src/music/humanize/velocity.ts` - applyVelocityVariation with VELOCITY_PROFILES for 5 instrument types
- `src/music/humanize/note-length.ts` - applyNoteLengthVariation with beat-position-aware duration changes
- `src/music/humanize/presets.ts` - HUMANIZATION_PRESETS (4 presets) and getPresetParams deep-copy accessor

## Decisions Made
- Drums use a dual-path velocity approach: notes below ghostNoteThreshold get clamped into ghostNoteRange, notes above the baseVelocityRange midpoint blend toward accentRange. This produces the wide dynamic contrast characteristic of real drum performances.
- Piano phrase-arc uses note-index-based sine modulation (period ~12 notes) rather than time-based, so phrasing breathes relative to note density regardless of tempo.
- Note-length variation is hard-capped at +-30% of original duration regardless of the amount parameter, preventing extreme changes that would destroy musical timing.
- Presets use JSON.parse/stringify deep copy for safety; callers can override individual fields (e.g., swap instrument profile) without affecting the preset definitions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All four humanization transforms complete: swing, timing, velocity, note-length
- Named presets ready for pipeline orchestration (Plan 03-03 index.ts)
- Transform signature pattern consistent: `(notes, params?, rng?) => NoteData[]`
- Pipeline composition order established: swing -> timing -> velocity -> note-length

---
*Phase: 03-humanization-engine*
*Completed: 2026-02-24*
