---
phase: 03-humanization-engine
plan: 01
subsystem: music-engine
tags: [humanization, ornstein-uhlenbeck, swing, mpc, timing-drift, box-muller, alea, simplex-noise]

# Dependency graph
requires:
  - phase: 02-music-theory
    provides: NoteData type, music theory engine
provides:
  - HumanizationParams and all sub-types (TimingDrift, Swing, Velocity, NoteLength)
  - gaussianRandom (Box-Muller), clampVelocity, clampTime, createSeededRng, getBeatPosition utilities
  - applySwing (MPC-style swing with grid tolerance)
  - applyTimingDrift (Ornstein-Uhlenbeck with optional context-aware sigma)
  - calculateContextSigmas (density-aware sigma scaling)
affects: [03-02 velocity/note-length transforms, 03-03 humanize pipeline/presets, 03-04 MCP tool integration]

# Tech tracking
tech-stack:
  added: [simplex-noise@4.0.3, alea@1.0.1]
  patterns: [Ornstein-Uhlenbeck timing drift, MPC-style swing formula, Box-Muller Gaussian RNG, spread-copy immutability, seeded PRNG injection]

key-files:
  created:
    - src/music/humanize/util.ts
    - src/music/humanize/swing.ts
    - src/music/humanize/timing.ts
  modified:
    - src/music/types.ts
    - package.json

key-decisions:
  - "Box-Muller transform hand-rolled (6 lines) instead of external Gaussian RNG library"
  - "All transform functions accept optional rng parameter for deterministic seeded behavior"
  - "Swing uses 10% grid tolerance for floating-point-safe subdivision detection"
  - "O-U process uses dt=1.0 (one step per note) for simplicity"

patterns-established:
  - "Transform signature: (notes: NoteData[], params?: XParams, rng?: () => number) => NoteData[]"
  - "All transforms return spread-copied notes, never mutate input arrays"
  - "All time/velocity values clamped and rounded to 3 decimal places"
  - "Beat position classification via epsilon-based grid comparison"

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 3 Plan 1: Humanization Foundation Summary

**Ornstein-Uhlenbeck timing drift and MPC swing transforms with Box-Muller RNG, seeded PRNG, and full humanization type system**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T05:37:15Z
- **Completed:** 2026-02-24T05:40:02Z
- **Tasks:** 2
- **Files modified:** 5 (types.ts, package.json, util.ts, swing.ts, timing.ts)

## Accomplishments
- Defined complete humanization type system (HumanizationParams, TimingDriftParams, SwingParams, VelocityParams, NoteLengthParams, HumanizationPreset, HumanizationResult)
- Built utility library with Gaussian RNG (Box-Muller), seeded PRNG (alea), velocity/time clamping, and beat-position classification
- Implemented MPC-style swing with Roger Linn formula and floating-point-safe grid detection
- Implemented Ornstein-Uhlenbeck timing drift with Euler-Maruyama discretization and optional context-aware sigma scaling

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps and add humanization types + utilities** - `f12f279` (feat)
2. **Task 2: Implement MPC-style swing and O-U timing drift** - `90d23b8` (feat)

## Files Created/Modified
- `src/music/types.ts` - Added 7 humanization interfaces/types at bottom of file
- `src/music/humanize/util.ts` - gaussianRandom, clampVelocity, clampTime, createSeededRng, getBeatPosition
- `src/music/humanize/swing.ts` - applySwing with MPC formula, grid tolerance, off-beat detection
- `src/music/humanize/timing.ts` - applyTimingDrift (O-U process), calculateContextSigmas (density scaling)
- `package.json` - Added simplex-noise@4.0.3 and alea@1.0.1 dependencies

## Decisions Made
- Hand-rolled Box-Muller Gaussian RNG (6 lines) instead of adding a dependency -- too simple to warrant a library
- All transform functions accept an optional `rng: () => number` parameter so seeded PRNG can be injected for reproducibility
- Swing uses `gridSize * 0.1` tolerance for grid detection to handle floating-point imprecision (per RESEARCH.md pitfall 6)
- O-U process uses `dt = 1.0` (one step per note) for simplicity; actual beat intervals not needed since sigma already expressed in beats

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Type system complete for all four humanization transforms
- Utility functions ready for velocity.ts and note-length.ts (Plan 03-02)
- Transform pipeline signature pattern established: `(notes, params?, rng?) => NoteData[]`
- simplex-noise available for velocity variation in next plan

---
*Phase: 03-humanization-engine*
*Completed: 2026-02-24*
