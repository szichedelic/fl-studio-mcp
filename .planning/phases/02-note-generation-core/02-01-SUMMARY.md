---
phase: 02-note-generation-core
plan: 01
subsystem: music-theory
tags: [tonal, music-theory, scales, chords, melody, bass, midi, typescript]

# Dependency graph
requires:
  - phase: 01-foundation-communication
    provides: "MCP server infrastructure, TypeScript project setup, bridge types"
provides:
  - "NoteData interface for all note generation"
  - "Music theory helpers (noteToMidi, getScaleMidiNotes, romanNumeralToChord, getChordNotes)"
  - "Scale utilities (snapToScale, isInScale, getAvailableScales)"
  - "Chord progression generator from roman numerals"
  - "Melody generator with density/direction controls"
  - "Bass line generator with whole/half/walking/eighth styles"
affects:
  - 02-note-generation-core (plans 02, 03 consume these modules)
  - 03-piano-roll-integration (sends NoteData to FL Bridge)
  - 05-humanization (will modify NoteData velocity/timing)
  - 09-generation-expansion (will enhance melody/bass algorithms)

# Tech tracking
tech-stack:
  added: ["tonal ^6.x"]
  patterns: ["Pure function music generation", "Scale-locked note output", "Roman numeral chord resolution via tonal Key module"]

key-files:
  created:
    - src/music/types.ts
    - src/music/theory.ts
    - src/music/scales.ts
    - src/music/chords.ts
    - src/music/melody.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Tonal chroma is root-relative, not C-relative -- isInScale must offset by root chroma"
  - "Velocity stored as 0-1 float matching FL Studio piano roll format (not MIDI 0-127)"
  - "Time/duration in beats (quarter notes), converted to ticks only in FL Bridge .pyscript"

patterns-established:
  - "NoteData as universal note format across all generators"
  - "Roman numeral -> tonal Key.majorKey/minorKey.triads for chord resolution"
  - "snapToScale as safety net in all note generators"
  - "Slight velocity variation (+-0.03 to 0.05) for natural feel"

# Metrics
duration: 7min
completed: 2026-02-23
---

# Phase 2 Plan 01: Music Theory Engine Summary

**Scale/chord/melody/bass generation using tonal library with NoteData output format**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-23T23:02:51Z
- **Completed:** 2026-02-23T23:10:19Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Full music theory engine with types, scale utilities, chord progression, melody, and bass line generators
- All generators produce scale-locked NoteData arrays (no accidental out-of-key notes)
- Chord voicings verified correct: I-V-vi-IV in C major produces C, G, Am, F with proper MIDI numbers
- Bass line follows chord roots with 4 rhythmic styles (whole, half, walking, eighth)
- Melody uses weighted random walk (70% step, 30% leap) with density and direction controls

## Task Commits

Each task was committed atomically:

1. **Task 1: Install tonal and create NoteData types + theory helpers** - `0cf061c` (feat)
2. **Task 2: Create chord progression, melody, and bass line generators** - `26c45a8` (feat)

## Files Created/Modified
- `src/music/types.ts` - NoteData, ChordProgressionParams, MelodyParams, BassLineParams, AddNotesRequest interfaces
- `src/music/theory.ts` - noteToMidi, midiToNoteName, getScaleMidiNotes, romanNumeralToChord, getChordNotes
- `src/music/scales.ts` - snapToScale, isInScale, getAvailableScales, getScaleInfo
- `src/music/chords.ts` - generateChordProgression from roman numeral notation
- `src/music/melody.ts` - generateMelody and generateBassLine algorithms
- `package.json` - Added tonal dependency

## Decisions Made
- Tonal's chroma string is root-relative (index 0 = scale root), not absolute from C. The isInScale function must compute `((midiNote % 12) - rootChroma + 12) % 12` to get the correct chroma index.
- Velocity stored as 0.0-1.0 float to match FL Studio's flpianoroll.Note.velocity format directly. No MIDI 0-127 conversion needed.
- Time and duration expressed in beats (quarter notes). Conversion to ticks happens in the .pyscript using `score.PPQ`.
- Used readonly type annotations for tonal Key module return types (tonal returns readonly arrays).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed isInScale chroma comparison for non-C root scales**
- **Found during:** Task 2 (smoke testing melody in A minor)
- **Issue:** isInScale assumed tonal's chroma string was indexed from C (absolute pitch class 0=C). Actually, tonal's chroma is relative to the scale root (index 0 = root). This caused all non-C scales to report incorrect membership.
- **Fix:** Changed isInScale to compute relative chroma offset: `((midiNote % 12) - rootChroma + 12) % 12` before indexing into the chroma string.
- **Files modified:** src/music/scales.ts
- **Verification:** A minor melody notes (A=69, B=71, C=72, etc.) now correctly identified as in-scale
- **Committed in:** 26c45a8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness. Without it, scale locking would fail for any key other than C.

## Issues Encountered
None beyond the chroma bug documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Music theory engine complete and ready for Plan 02 (piano roll handler in FL Bridge)
- NoteData interface matches the JSON format expected by the pianoroll handler
- All five modules are pure functions with no side effects or FL Studio dependencies
- Plan 03 (MCP tools) can import from these modules directly

---
*Phase: 02-note-generation-core*
*Completed: 2026-02-23*
