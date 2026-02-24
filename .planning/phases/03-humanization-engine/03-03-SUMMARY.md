---
phase: 03-humanization-engine
plan: 03
subsystem: music-engine
tags: [humanization, mcp-tools, pipeline, preset, swing, timing, velocity, note-length]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Swing + timing drift transforms, seeded PRNG, utility functions"
  - phase: 03-02
    provides: "Velocity variation, note-length variation, named presets"
provides:
  - "humanize() pipeline orchestrator composing all 4 transforms"
  - "humanize_notes MCP tool with preset and custom param support"
  - "Inline humanization for create_melody, create_chord_progression, create_bass_line"
affects: [04-plugin-control, 05-sound-design, 06-audio-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pipeline orchestrator pattern: resolve preset -> merge overrides -> apply transforms in order"
    - "MCP tool param flattening: flat schema maps to nested HumanizationParams"
    - "Import aliasing to avoid naming collisions (humanize as humanizeNotes)"

key-files:
  created:
    - "src/music/humanize/index.ts"
    - "src/tools/humanize.ts"
  modified:
    - "src/tools/index.ts"
    - "src/tools/notes.ts"

key-decisions:
  - "Preset deep-merge: preset defaults + per-field explicit overrides (explicit wins)"
  - "Auto-generated seed format: Date.now base36 + random suffix for uniqueness"
  - "humanize_notes timing_amount maps 0-1 to sigma 0.001-0.025 for user-friendly control"
  - "Humanize param added to generators but NOT to add_notes (use humanize_notes for raw notes)"

patterns-established:
  - "Pipeline orchestrator: resolve preset -> seed RNG -> apply transforms in fixed order -> return result with metadata"
  - "MCP tool schema flattening: flat params in tool schema -> nested domain params in handler"

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 3 Plan 3: Pipeline + MCP Tools Summary

**Humanize pipeline orchestrator composing swing/timing/velocity/note-length with MCP tool exposure and inline generator humanization**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T05:45:20Z
- **Completed:** 2026-02-24T05:48:24Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created humanize() pipeline that composes all 4 transforms in correct order (swing -> timing -> velocity -> note-length)
- Built humanize_notes MCP tool supporting both named presets and custom parameter control
- Added optional humanize/humanize_instrument params to create_melody, create_chord_progression, and create_bass_line
- Seed returned in all results for reproducible humanization

## Task Commits

Each task was committed atomically:

1. **Task 1: Create humanize pipeline orchestrator** - `02cae4a` (feat)
2. **Task 2: Create humanize_notes MCP tool and wire into existing tools** - `b7c0de5` (feat)

## Files Created/Modified
- `src/music/humanize/index.ts` - Pipeline orchestrator: preset resolution, seeded RNG, 4-stage transform chain
- `src/tools/humanize.ts` - humanize_notes MCP tool with flat-to-nested param mapping
- `src/tools/index.ts` - Updated tool registry with registerHumanizeTools
- `src/tools/notes.ts` - Added humanize/humanize_instrument params to 3 generator tools

## Decisions Made
- Preset resolution uses shallow-merge per sub-object (explicit params override preset defaults at the field level)
- Auto-generated seed uses `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)` for compact uniqueness
- timing_amount (0-1 user-facing) maps linearly to sigma (0.001-0.025 internal) for intuitive control
- humanize param added to generators (melody, chords, bass) but NOT to add_notes -- users should use humanize_notes for raw note humanization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3 (Humanization Engine) is now complete -- all transforms, presets, pipeline, and MCP tools are wired
- Ready for Phase 4 (Plugin & Mixer Control) which builds on note generation + humanization
- Humanization can be applied to any NoteData[] from any source (generated or user-provided)

---
*Phase: 03-humanization-engine*
*Completed: 2026-02-24*
