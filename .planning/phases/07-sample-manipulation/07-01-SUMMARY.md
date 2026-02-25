---
phase: 07-sample-manipulation
plan: 01
subsystem: audio
tags: [sox, audio-processing, cli-wrapper, file-resolution]

# Dependency graph
requires:
  - phase: 06-audio-rendering
    provides: "RenderRegistry for filename-based file lookup"
provides:
  - "SoxRunner class wrapping all SoX CLI operations"
  - "resolveInputFile utility connecting renders to sample tools"
  - "generateOutputFilename for descriptive output naming"
  - "SoxResult and SampleInfo type definitions"
affects: [07-02 sample tools, 07-03 sample tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "execFile-based CLI wrapper with safe arg arrays (no shell interpolation)"
    - "Multi-strategy file resolution: registry -> absolute -> renders dir -> samples dir"

key-files:
  created:
    - src/audio/sox-runner.ts
  modified:
    - src/audio/types.ts

key-decisions:
  - "SoX path from SOX_PATH env var or falls back to 'sox' on PATH"
  - "120s timeout on all SoX operations for large file safety"
  - "Tempo uses -m (music mode) for synthesizer content quality"
  - "Mix auto-balances at 1/N volume when no volumes specified"

patterns-established:
  - "SoxRunner singleton pattern: import { soxRunner } from './sox-runner.js'"
  - "File resolution chain: renderRegistry -> absolute -> renders dir -> samples dir"
  - "Output naming: base_operation_suffix.wav via generateOutputFilename"

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 7 Plan 1: SoxRunner Foundation Summary

**SoX CLI wrapper with pitch/reverse/tempo/mix/merge/normalize/info methods, file resolution linking Phase 6 renders to sample operations**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T15:04:36Z
- **Completed:** 2026-02-25T15:06:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- SoxResult and SampleInfo types added to shared audio types module
- SoxRunner class with 8 methods covering all Phase 7 audio operations
- File resolution utility bridging Phase 6 render registry to Phase 7 sample tools
- Output filename generator producing descriptive WAV names

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SoxResult and SampleInfo types** - `16b0773` (feat)
2. **Task 2: Create SoxRunner class with utilities** - `e4a0633` (feat)

## Files Created/Modified
- `src/audio/types.ts` - Added SoxResult and SampleInfo interfaces (existing RenderInfo/WatcherConfig unchanged)
- `src/audio/sox-runner.ts` - SoxRunner class, soxRunner singleton, resolveInputFile, generateOutputFilename, getDefaultSampleDir

## Decisions Made
- SoX path resolution: `process.env.SOX_PATH ?? 'sox'` for flexibility across environments
- 120 second timeout covers large WAV files without indefinite hangs
- Tempo uses `-m` flag (music mode) optimized for synthesizer/musical content
- Mix auto-balance divides volume equally (1/N) when no explicit volumes given
- File resolution checks 4 locations in priority order before throwing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. SoX must be installed on the system for runtime use (verified via `soxRunner.verify()`).

## Next Phase Readiness
- SoxRunner ready for Plan 02 (sample manipulation MCP tools)
- resolveInputFile connects Phase 6 renders seamlessly
- All types exported for tool handler consumption

---
*Phase: 07-sample-manipulation*
*Completed: 2026-02-25*
