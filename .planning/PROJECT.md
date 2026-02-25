# FL Studio MCP Server

## What This Is

An MCP (Model Context Protocol) server that enables natural language control of FL Studio for music production. The north star: write and build complex music in any genre using natural language, with human feel. Now includes a full creative production toolkit -- humanization, sound design, rendering, and sample manipulation.

## Core Value

**Natural language → human-sounding music.** Stay in creative flow instead of clicking through menus. Produce professional-quality tracks 10x faster while maintaining the imperfections that make music feel alive.

## Current State

**Shipped:** v2.0 Production Pipeline (2026-02-25)

**Tech stack:** TypeScript/Node.js MCP server + Python FL Bridge + SoX CLI
**Codebase:** ~7,200 lines TypeScript, ~2,000 lines Python
**MCP tools:** 28 tools across 9 groups (transport, state, patterns, notes, humanize, plugins, serum, render, sample)
**External deps:** tonal (music theory), chokidar (file watching), SoX (audio processing)

## Context

### The Problem

Music production in FL Studio involves constant context-switching: navigating menus, clicking piano roll notes, tweaking synth parameters, arranging clips. This interrupts creative flow. The gap between having a musical idea and realizing it is too wide.

### The Vision

Speak musical intent in natural language at any level of abstraction:
- **High-level creative:** "Write a melancholic piano intro in A minor"
- **Mid-level direction:** "Add a bass line that follows the chord progression"
- **Low-level tweaks:** "Humanize the hi-hats" or "Set filter cutoff to 40%"
- **Sound design:** "Create a warm detuned pad in Serum 2"
- **Sample manipulation:** "Render that chord, pitch it down an octave, reverse it"

Claude interprets the intent and executes in FL Studio. The interaction is conversational — quick tweaks execute immediately, bigger changes iterate through refinement.

### What "Human" Means

Music should breathe, not sound robotic. This requires:
- **Timing imperfection:** Ornstein-Uhlenbeck timing drift (correlated, not random)
- **Velocity variation:** Per-instrument profiles (drums, piano, bass, synth)
- **Swing/groove:** MPC-style swing with configurable feel (50-75%)
- **Articulation:** Beat-position-aware note length variation (legato vs staccato)

### Target User

Producer (the project creator) who:
- Uses FL Studio 2025
- Works with samples (Splice), synths (Serum 2), Addictive Drums 2
- Wants to stay in creative flow
- Values human feel over mechanical precision

## Constraints

### Known Constraints

- Must work with FL Studio 2025
- Must support existing workflow (Splice samples, Serum 2, Addictive Drums 2)
- Must integrate as MCP server for Claude
- FL Studio's piano roll subinterpreter has no file I/O — must use embedded .pyscript approach
- VST parameter indexing is positional, not stable IDs — need name-based resolution
- FL Studio has no programmatic render/export API — guided manual workflow required
- Sample loading into channels has no API — user drag-and-drop required
- SoX must be installed separately for sample manipulation tools

## Requirements

### Validated

- ✓ FOUND-01: Transport control (play, stop, record) — v1.0
- ✓ FOUND-02: Project state reading (patterns, channels, mixer) — v1.0
- ✓ FOUND-03: Pattern selection and creation — v1.0
- ✓ COMP-01: Note/MIDI generation from natural language — v1.0
- ✓ COMP-02: Chord progression generation — v1.0
- ✓ COMP-03: Melody generation — v1.0
- ✓ COMP-04: Bass line generation — v1.0
- ✓ COMP-06: Scale/key locking — v1.0
- ✓ HUM-01: Brownian-walk timing drift — v2.0
- ✓ HUM-02: Per-instrument velocity profiles — v2.0
- ✓ HUM-03: Swing/groove (50-75%) — v2.0
- ✓ HUM-04: Note-length variation per beat — v2.0
- ✓ HUM-05: Context-aware humanization — v2.0
- ✓ HUM-06: Named humanization presets — v2.0
- ✓ PLUG-01: Discover VST parameters by name — v2.0
- ✓ PLUG-02: Get/set VST parameters by name — v2.0
- ✓ PLUG-03: Shadow state for parameter values — v2.0
- ✓ SER-01: Serum 2 semantic control — v2.0
- ✓ SER-02: Fuzzy parameter name matching — v2.0
- ✓ SER-03: Sound design recipes — v2.0
- ✓ SER-04: Preset browsing and loading — v2.0
- ✓ REN-01: Guided render workflow — v2.0
- ✓ REN-02: Automatic WAV detection/tracking — v2.0
- ✓ SAM-01: Pitch-shift/detune samples — v2.0
- ✓ SAM-02: Reverse audio samples — v2.0
- ✓ SAM-03: Time-stretch audio samples — v2.0
- ✓ SAM-04: Layer/mix with stereo detune — v2.0
- ✓ SAM-05: Full resampling workflow — v2.0

### Out of Scope

- **Mixing/mastering plugins** (Neutron, Ozone, Thermal, Portal) — future milestone
- **Genre-specific presets** — tools are genre-agnostic
- **Sample library management** — not organizing Splice library
- **Addictive Drums 2 integration** — deferred, focus on Serum 2 first
- **Arrangement/playlist control** — deferred, focus on sound creation first
- **Drum pattern generation** — future milestone
- **ML-based humanization** — algorithmic Brownian walk achieves 90% of value
- **Full Serum 2 preset editor UI** — Serum has its own UI for deep editing
- **Real-time audio streaming** — not feasible via SysEx bridge
- **Edison scripting** — isolated interpreter, no communication with MIDI scripts
- **Sample chopping (Slicer/Slicex)** — programmatic API access unconfirmed
- **Full song generation** — anti-feature: removes creative ownership

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SysEx-over-MIDI bridge | Only viable external API for FL Studio | ✓ Good |
| Embedded .pyscript for piano roll | FL Studio subinterpreter has no file I/O | ✓ Good |
| Node.js writes .pyscript (not FL Bridge) | MIDI controller script can't write to Piano roll scripts directory | ✓ Good |
| tonal library for music theory | Comprehensive, well-maintained | ✓ Good |
| Velocity as 0.0-1.0 float | FL Studio native format | ✓ Good |
| O-U process for timing drift | Correlated drift sounds organic, not random | ✓ Good |
| Shadow state for VST params | getParamValue unreliable for VSTs | ✓ Good |
| 3-tier fuzzy name matching | Survives plugin version updates | ✓ Good |
| Guided manual render workflow | FL Studio has no render API | ✓ Good (only option) |
| SoX CLI for audio processing | Mature, battle-tested, no npm audio deps | ✓ Good |
| chokidar for WAV detection | Reliable file watching with write-finish detection | ✓ Good |
| Serum 2 semantic aliases (144 entries) | Musical language maps to actual param names | ✓ Good |
| Genre-agnostic tools | User makes diverse genres; tools should be flexible | ✓ Good |
| Serum 2 before AD2 | Serum 2 is more central to the user's workflow | ✓ Good |

## Success Criteria

1. **Speed:** Build tracks 10x faster than manual clicking
2. **Quality:** Output sounds professional and human, not robotic
3. **Flow:** Stay creative without context-switching to menus
4. **Sound design:** Create unique sounds via natural language, not just place notes
5. **Full pipeline:** Generate → humanize → design sound → render → manipulate → reload

---
*Last updated: 2026-02-25 after v2.0 milestone*
