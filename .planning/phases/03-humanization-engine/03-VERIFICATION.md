---
phase: 03-humanization-engine
verified: 2026-02-24T06:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 3: Humanization Engine Verification Report

**Phase Goal:** Generated music sounds human -- timing breathes, dynamics vary, groove feels alive
**Verified:** 2026-02-24T06:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can humanize a pattern and hear Brownian-walk timing drift that sounds organic | VERIFIED | timing.ts implements O-U Euler-Maruyama; correlated offsets confirmed at runtime (0.002, -0.005, -0.010, -0.009...) |
| 2 | User can apply velocity variation with instrument-appropriate profiles | VERIFIED | VELOCITY_PROFILES confirmed; drum ghost notes at 0.262-0.272 within [0.24, 0.39]; accents at 0.852 in [0.78, 0.94] |
| 3 | User can apply swing (50-75%) and hear groove shift on off-beat notes | VERIFIED | MPC formula confirmed at runtime: on-beat unchanged, off-beat shifted 0.250->0.410 at swing=66 |
| 4 | User can get context-aware humanization where fast passages stay tight and slow passages breathe | VERIFIED | calculateContextSigmas confirmed: sparse=0.0120 (1.5x), dense=0.0040 (0.5x) |
| 5 | User can select named presets and hear distinctly different humanization character | VERIFIED | 4 presets with distinct params; seed reproducibility confirmed |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| src/music/types.ts | HumanizationParams and all sub-types | VERIFIED | All 7 humanization types at lines 100-158 |
| src/music/humanize/util.ts | gaussianRandom, clampVelocity, clampTime, createSeededRng, getBeatPosition | VERIFIED | 104 lines; all 5 functions; Box-Muller + beat classification |
| src/music/humanize/swing.ts | MPC-style swing with grid tolerance | VERIFIED | 68 lines; applySwing; Roger Linn formula; 10% gridSize tolerance |
| src/music/humanize/timing.ts | O-U timing drift with context-aware scaling | VERIFIED | 132 lines; applyTimingDrift + calculateContextSigmas |
| src/music/humanize/velocity.ts | Instrument-aware velocity with simplex noise | VERIFIED | 158 lines; VELOCITY_PROFILES; 5 profiles; ghost/accent/phrase-arc |
| src/music/humanize/note-length.ts | Beat-position-aware duration variation | VERIFIED | 86 lines; applyNoteLengthVariation; downbeat-legato + offbeat-staccato; 30% cap |
| src/music/humanize/presets.ts | Named humanization presets | VERIFIED | 87 lines; HUMANIZATION_PRESETS + getPresetParams; 4 distinct presets; deep-copy |
| src/music/humanize/index.ts | Humanize pipeline orchestrator | VERIFIED | 109 lines; humanize(); pipeline order swing->timing->velocity->noteLength; seeded RNG |
| src/tools/humanize.ts | humanize_notes MCP tool | VERIFIED | 130 lines; registerHumanizeTools; zod schema with preset, instrument, swing, timing_amount, seed |
| src/tools/index.ts | Updated tool registry | VERIFIED | imports + calls registerHumanizeTools (lines 15, 31) |
| src/tools/notes.ts | Generator tools with optional humanize param | VERIFIED | humanize + humanize_instrument on 3 generators; humanizeNotes called at lines 223, 287, 360 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| timing.ts | util.ts | import gaussianRandom | WIRED | Line 17: imports gaussianRandom, clampTime from util.js |
| swing.ts | types.ts | import NoteData, SwingParams | WIRED | Line 11: imports NoteData, SwingParams from types.js |
| velocity.ts | util.ts | import getBeatPosition, clampVelocity | WIRED | Line 15: imports getBeatPosition, clampVelocity from util.js |
| presets.ts | types.ts | import HumanizationParams | WIRED | Line 22: imports HumanizationParams, HumanizationPreset from types.js |
| humanize/index.ts | swing.ts | import applySwing | WIRED | Line 19: imports applySwing from swing.js |
| humanize/index.ts | timing.ts | import applyTimingDrift | WIRED | Line 20: imports applyTimingDrift from timing.js |
| humanize/index.ts | velocity.ts | import applyVelocityVariation | WIRED | Line 21: imports applyVelocityVariation from velocity.js |
| humanize/index.ts | note-length.ts | import applyNoteLengthVariation | WIRED | Line 22: imports applyNoteLengthVariation from note-length.js |
| tools/humanize.ts | humanize/index.ts | import humanize | WIRED | Line 15: imports humanize from music/humanize/index.js |
| tools/index.ts | tools/humanize.ts | import registerHumanizeTools | WIRED | Line 15 import; line 31 call |
| tools/notes.ts | humanize/index.ts | import humanize as humanizeNotes | WIRED | Line 23; called in 3 generator handlers at lines 223, 287, 360 |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| HUM-01: Brownian-walk timing push/pull | SATISFIED | O-U process in timing.ts; correlated drift confirmed at runtime |
| HUM-02: Velocity variation with per-instrument profiles | SATISFIED | VELOCITY_PROFILES; 5 profiles; ghost notes and accents verified |
| HUM-03: Swing/groove (50-75% range) | SATISFIED | swing.ts MPC formula; schema min(50) max(75); jazz preset uses 66 |
| HUM-04: Note-length variation per beat position | SATISFIED | note-length.ts downbeatLegato logic; downbeats longer, off-beats shorter |
| HUM-05: Context-aware humanization | SATISFIED | calculateContextSigmas; 3x sigma range confirmed at runtime |
| HUM-06: Named presets with beat-position awareness | SATISFIED | 4 presets in presets.ts; all velocity transforms use getBeatPosition |

### Anti-Patterns Found

No stub patterns, TODO/FIXME comments, placeholder content, or empty implementations found in any humanization file. All 9 source files contain complete real implementations.

### Human Verification Required

#### 1. Perceptual Quality of Timing Drift

**Test:** Generate a 2-bar melody, apply humanize with preset jazz, write to FL Studio and play back.
**Expected:** Timing should feel organic -- notes settle around the grid but breathe.
**Why human:** Algorithmic correctness is verified; perceptual quality requires ears.

#### 2. Swing Groove Feel at 66%

**Test:** Generate a 4-bar chord progression, apply swing=66, write to FL Studio and play back.
**Expected:** Should feel like a shuffle -- off-beat notes clearly delayed creating a swung groove.
**Why human:** Runtime confirms shift ratio is correct; auditory feel requires playback.

#### 3. Drum Ghost Notes and Accents Sound Natural

**Test:** Apply instrument drums velocity humanization to a drum pattern.
**Expected:** Ghost notes noticeably quieter, accents prominently louder.
**Why human:** Velocity values are mathematically verified; musical naturalness requires listening.

#### 4. Preset Character Distinction

**Test:** Apply the same 8-note melody with each of the 4 presets back-to-back and listen.
**Expected:** tight feels clean/electronic, loose relaxed, jazz swung and expressive, lo-fi wandering and degraded.
**Why human:** Parameter values are verified as mathematically distinct; perceptual distinction requires listening.

#### 5. write_pyscript Integration with FL Studio

**Test:** Call humanize_notes with write_pyscript=true and then run ComposeWithBridge in FL Studio.
**Expected:** Humanized notes appear in the piano roll with varied timing and velocity values.
**Why human:** Requires FL Studio running with the MIDI bridge configured.


---

## Summary

Phase 3 goal achievement is fully verified at the code level. All 5 observable truths are supported by substantive, wired implementations:

1. The Ornstein-Uhlenbeck process in timing.ts produces correlated drift confirmed at runtime (offsets: 0.002, -0.005, -0.010, -0.009... showing drift and mean reversion)
2. Instrument velocity profiles in velocity.ts produce correct ghost notes (0.262, 0.272 within [0.24, 0.39]) and accents (0.852) verified at runtime
3. MPC swing in swing.ts leaves on-beat notes unchanged and shifts off-beat notes by correct ratio (0.250->0.410 at swing=66)
4. Context-aware sigma scaling produces 3x difference between sparse (0.012) and dense (0.004) passages
5. Four named presets with distinct theta/sigma/swing/velocity parameters; seed-reproducible output confirmed

The entire pipeline (swing -> timing -> velocity -> note-length) composes correctly in humanize/index.ts, builds cleanly (npx tsc --noEmit zero errors), and is exposed via humanize_notes MCP tool and optional humanize params on all three generator tools.

5 human verification items identified for perceptual and FL Studio integration testing -- these are quality checks, not correctness gaps.

---

_Verified: 2026-02-24T06:00:00Z_
_Verifier: Claude (gsd-verifier)_
