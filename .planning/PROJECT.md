# FL Studio MCP Server

## What This Is

An MCP (Model Context Protocol) server that enables natural language control of FL Studio for music production. The north star: write and build complex music in any genre using natural language, with human feel.

## Core Value

**Natural language → human-sounding music.** Stay in creative flow instead of clicking through menus. Produce professional-quality tracks 10x faster while maintaining the imperfections that make music feel alive.

## Context

### The Problem

Music production in FL Studio involves constant context-switching: navigating menus, clicking piano roll notes, tweaking synth parameters, arranging clips. This interrupts creative flow. The gap between having a musical idea and realizing it is too wide.

### The Vision

Speak musical intent in natural language at any level of abstraction:
- **High-level creative:** "Write a melancholic piano intro in A minor"
- **Mid-level direction:** "Add a bass line that follows the chord progression"
- **Low-level tweaks:** "Humanize the hi-hats" or "Add sidechain to the bass"

Claude interprets the intent and executes in FL Studio. The interaction is conversational — quick tweaks execute immediately, bigger changes iterate through refinement.

### What "Human" Means

Music should breathe, not sound robotic. This requires:
- **Timing imperfection:** Notes slightly off-grid, not perfectly quantized
- **Velocity variation:** Dynamics that breathe, not every note the same volume
- **Performance artifacts:** Subtle overlaps, releases, the things real players do

### Target User

Producer (the project creator) who:
- Uses FL Studio 2025
- Works with samples (Splice), synths (Serum 2), Addictive Drums 2
- Wants to stay in creative flow
- Values human feel over mechanical precision

## Constraints

### Technical Unknowns

- **FL Studio connection mechanism:** FL Studio doesn't expose a traditional external API. Research needed to determine viable approaches (MIDI scripting, protocol reverse-engineering, etc.)

### Known Constraints

- Must work with FL Studio 2025
- Must support existing workflow (Splice samples, Serum 2, Addictive Drums 2)
- Must integrate as MCP server for Claude

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Composition & Arrangement**
- [ ] Create melodies, chord progressions, bass lines from natural language
- [ ] Create drum patterns with humanized feel
- [ ] Manipulate playlist/timeline (arrange clips, sections)
- [ ] Scale locking support

**Piano Roll Control**
- [ ] Create and manipulate notes
- [ ] Apply humanization (timing, velocity, performance artifacts)
- [ ] Work with existing patterns in the project

**Sound Design**
- [ ] Create synth patches from scratch in Serum 2
- [ ] Control synth parameters via natural language
- [ ] Load and select presets when appropriate

**Drums**
- [ ] Control Addictive Drums 2
- [ ] Place and arrange drum samples
- [ ] Humanize drum patterns

**Basic Effects & Routing**
- [ ] Set up sidechain compression
- [ ] Create and route to buses
- [ ] Basic effect chain setup

**Project Awareness**
- [ ] Read current project state (existing patterns, mixer state)
- [ ] Make contextual additions that fit what's already there

### Out of Scope

- **Mixing/mastering plugins** (Neutron, Ozone, Thermal, Portal) — v2
- **Genre-specific presets** — tools are genre-agnostic
- **Sample library management** — not organizing Splice library

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Defer mixing/mastering to v2 | Focus on composition first; mixing requires different workflows | Pending |
| Full sound design, not just presets | User wants to create patches from scratch, not just load presets | Pending |
| Genre-agnostic tools | User makes diverse genres; tools should be flexible, not prescriptive | Pending |
| Research FL Studio connection | Critical unknown that shapes entire architecture | Pending |

## Success Criteria

1. **Speed:** Build tracks 10x faster than manual clicking
2. **Quality:** Output sounds professional and human, not robotic
3. **Flow:** Stay creative without context-switching to menus

---
*Last updated: 2026-02-23 after initialization*
