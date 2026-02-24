# FL Studio MCP Server

## What This Is

An MCP (Model Context Protocol) server that enables natural language control of FL Studio for music production. The north star: write and build complex music in any genre using natural language, with human feel.

## Core Value

**Natural language → human-sounding music.** Stay in creative flow instead of clicking through menus. Produce professional-quality tracks 10x faster while maintaining the imperfections that make music feel alive.

## Current Milestone: v2.0 Production Pipeline

**Goal:** Transform note generation into a full creative production toolkit — humanize MIDI, design sounds in Serum 2, render to audio, and manipulate samples.

**Target features:**
- Humanization engine (timing push/pull, velocity curves, articulation, swing/groove)
- Generic FL Studio plugin parameter control
- Serum 2 sound design (oscillators, wavetables, filters, FX, macros, presets)
- Audio rendering (MIDI patterns → WAV)
- Sample manipulation (pitch-shift, detune, reverse, chop, layer)
- Resampling workflow (bounce → reload as sample → stretch/mangle)

## Context

### The Problem

Music production in FL Studio involves constant context-switching: navigating menus, clicking piano roll notes, tweaking synth parameters, arranging clips. This interrupts creative flow. The gap between having a musical idea and realizing it is too wide.

### The Vision

Speak musical intent in natural language at any level of abstraction:
- **High-level creative:** "Write a melancholic piano intro in A minor"
- **Mid-level direction:** "Add a bass line that follows the chord progression"
- **Low-level tweaks:** "Humanize the hi-hats" or "Add sidechain to the bass"
- **Sound design:** "Create a warm detuned pad in Serum 2"
- **Sample manipulation:** "Render that chord, pitch it down an octave, reverse it"

Claude interprets the intent and executes in FL Studio. The interaction is conversational — quick tweaks execute immediately, bigger changes iterate through refinement.

### What "Human" Means

Music should breathe, not sound robotic. This requires:
- **Timing imperfection:** Notes slightly off-grid, not perfectly quantized
- **Velocity variation:** Dynamics that breathe, not every note the same volume
- **Performance artifacts:** Subtle overlaps, releases, the things real players do
- **Articulation:** Legato vs staccato, note lengths that vary expressively

### Target User

Producer (the project creator) who:
- Uses FL Studio 2025
- Works with samples (Splice), synths (Serum 2), Addictive Drums 2
- Wants to stay in creative flow
- Values human feel over mechanical precision

## Constraints

### Technical Unknowns

- **FL Studio plugin parameter API:** The `plugins` module exists but Serum 2 parameter discovery needs hands-on testing. getParamValue may be broken for VSTs.
- **Audio rendering automation:** Need to discover if FL Studio can render patterns to audio programmatically via Python API.
- **Sample loading:** Need to discover if samples can be loaded into channels programmatically.

### Known Constraints

- Must work with FL Studio 2025
- Must support existing workflow (Splice samples, Serum 2, Addictive Drums 2)
- Must integrate as MCP server for Claude
- FL Studio's piano roll subinterpreter has no file I/O — must use embedded .pyscript approach
- VST parameter indexing is positional, not stable IDs — need name-based resolution

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

### Active

**Humanization**
- [ ] Humanization engine with timing push/pull, velocity curves, swing/groove
- [ ] Articulation variation (legato, staccato, note length variation)
- [ ] Performance artifacts (subtle overlaps, releases, timing drift)

**Plugin Control**
- [ ] Generic plugin parameter discovery and control
- [ ] Serum 2 sound design (oscillators, wavetables, filters, FX, macros)
- [ ] Serum 2 preset loading and management

**Audio & Sample Manipulation**
- [ ] Render MIDI patterns to audio (WAV)
- [ ] Pitch-shift and detune rendered audio
- [ ] Reverse, chop, and layer audio samples
- [ ] Resampling workflow (bounce → reload → manipulate)

### Out of Scope

- **Mixing/mastering plugins** (Neutron, Ozone, Thermal, Portal) — future milestone
- **Genre-specific presets** — tools are genre-agnostic
- **Sample library management** — not organizing Splice library
- **Addictive Drums 2 integration** — deferred to later milestone, focus on Serum 2 first
- **Arrangement/playlist control** — deferred, focus on sound creation first

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SysEx-over-MIDI bridge | Only viable external API for FL Studio | ✓ Good |
| Embedded .pyscript for piano roll | FL Studio subinterpreter has no file I/O; Node.js writes .pyscript directly | ✓ Good |
| Node.js writes .pyscript (not FL Bridge) | MIDI controller script can't write to Piano roll scripts directory | ✓ Good |
| tonal library for music theory | Comprehensive, well-maintained, handles scales/chords/intervals | ✓ Good |
| Velocity as 0.0-1.0 float | FL Studio native format, avoids MIDI 0-127 conversion | ✓ Good |
| Full sound design, not just presets | User wants to create patches from scratch, not just load presets | Pending |
| Genre-agnostic tools | User makes diverse genres; tools should be flexible, not prescriptive | Pending |
| Serum 2 before AD2 | Serum 2 is more central to the user's workflow, AD2 can follow later | Pending |

## Success Criteria

1. **Speed:** Build tracks 10x faster than manual clicking
2. **Quality:** Output sounds professional and human, not robotic
3. **Flow:** Stay creative without context-switching to menus
4. **Sound design:** Create unique sounds via natural language, not just place notes

---
*Last updated: 2026-02-23 after milestone v2.0 started*
