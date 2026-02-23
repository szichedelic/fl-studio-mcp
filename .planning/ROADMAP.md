# Roadmap: FL Studio MCP Server

## Overview

This roadmap delivers an MCP server enabling natural language control of FL Studio for music production. The journey progresses from establishing reliable communication with FL Studio (via MIDI SysEx bridge), through core composition capabilities (note generation, piano roll, drums), to quality features (humanization, mixer control, VST integration), and finally to arrangement control. Each phase delivers a coherent, verifiable capability that builds toward the north star: write and build complex music in any genre using natural language, with human feel.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Communication** - MCP server + FL Bridge + reliable bidirectional communication
- [ ] **Phase 2: Note Generation Core** - Create notes, chords, melodies, bass lines from natural language
- [ ] **Phase 3: Piano Roll Editing** - Edit existing notes in patterns
- [ ] **Phase 4: Drum Patterns** - Generate drum patterns with groove
- [ ] **Phase 5: Basic Humanization** - Timing and velocity variation that breathes
- [ ] **Phase 6: Mixer Control** - Volume, pan, routing, sidechain
- [ ] **Phase 7: Generic Plugin Control** - Parameter control foundation for VSTs
- [ ] **Phase 8: VST Integration** - Serum 2 sound design + Addictive Drums 2 control
- [ ] **Phase 9: Deep Humanization & Abstraction** - Advanced humanization + multi-level creative control
- [ ] **Phase 10: Arrangement** - Playlist/timeline control for song structure

## Phase Details

### Phase 1: Foundation & Communication
**Goal**: Establish reliable bidirectional communication between MCP client and FL Studio
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):
  1. User can start MCP server and it connects to FL Studio without errors
  2. User can control transport (play/stop/record) via natural language
  3. User can query current project state (patterns, tracks, mixer channels) and get accurate response
  4. User can select and create patterns via natural language
**Plans**: TBD

Plans:
- [ ] 01-01: MCP server scaffolding + virtual MIDI setup
- [ ] 01-02: FL Bridge Python script with safe initialization
- [ ] 01-03: Transport control + state reading + pattern operations

### Phase 2: Note Generation Core
**Goal**: Users can create musical content from natural language descriptions
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-06
**Success Criteria** (what must be TRUE):
  1. User can say "create a C major chord progression" and notes appear in piano roll
  2. User can say "write a melancholic melody in A minor" and get appropriate notes
  3. User can say "add a bass line following the chords" and get bass notes
  4. User can specify a key/scale and all generated notes conform to it
  5. Generated notes are placed in the correct pattern with correct timing
**Plans**: TBD

Plans:
- [ ] 02-01: Note creation via Piano Roll API
- [ ] 02-02: Chord progression generation
- [ ] 02-03: Melody + bass line generation with scale locking

### Phase 3: Piano Roll Editing
**Goal**: Users can edit existing notes in patterns
**Depends on**: Phase 2
**Requirements**: PIANO-01
**Success Criteria** (what must be TRUE):
  1. User can select notes by description ("the third note", "notes above C5")
  2. User can move, delete, or modify selected notes
  3. User can see what notes exist before editing (read + write cycle works)
**Plans**: TBD

Plans:
- [ ] 03-01: Note reading + selection + modification

### Phase 4: Drum Patterns
**Goal**: Users can create drum patterns from natural language
**Depends on**: Phase 2 (shares note creation patterns)
**Requirements**: COMP-05
**Success Criteria** (what must be TRUE):
  1. User can say "create a four-on-the-floor kick pattern" and get appropriate drum notes
  2. User can say "add hi-hats with swing" and get rhythmically appropriate placement
  3. User can specify genre (e.g., "trap hi-hats", "jazz ride pattern") and get stylistically correct output
**Plans**: TBD

Plans:
- [ ] 04-01: Drum pattern generation with genre templates

### Phase 5: Basic Humanization
**Goal**: Generated music sounds human, not robotic
**Depends on**: Phase 2, Phase 4 (requires notes to humanize)
**Requirements**: HUMAN-01
**Success Criteria** (what must be TRUE):
  1. User can say "humanize this pattern" and hear perceptible but subtle timing variation
  2. User can say "add velocity variation" and hear dynamic breathing
  3. Humanization sounds better than quantized (not random noise that sounds worse)
  4. Humanization amount is controllable ("subtle" vs "loose")
**Plans**: TBD

Plans:
- [ ] 05-01: Timing humanization with brownian noise
- [ ] 05-02: Velocity curves with contextual awareness (downbeats, etc.)

### Phase 6: Mixer Control
**Goal**: Users can control mixer from natural language
**Depends on**: Phase 1 (uses FL Bridge)
**Requirements**: MIX-01, MIX-02, MIX-03
**Success Criteria** (what must be TRUE):
  1. User can say "turn down the bass track to -6dB" and mixer responds
  2. User can say "pan the hi-hats left" and hear the result
  3. User can say "set up sidechain from the kick to the bass" and routing is configured
  4. User can say "create a reverb bus and send the vocals to it" and routing works
**Plans**: TBD

Plans:
- [ ] 06-01: Basic mixer control (volume, pan, mute, solo)
- [ ] 06-02: Sidechain + bus/send routing

### Phase 7: Generic Plugin Control
**Goal**: Foundation for controlling VST parameters
**Depends on**: Phase 1 (uses FL Bridge)
**Requirements**: PLUG-01
**Success Criteria** (what must be TRUE):
  1. User can list available parameters for a plugin
  2. User can set a parameter by name ("set filter cutoff to 50%")
  3. Parameter changes persist correctly (shadow state if needed)
  4. System handles plugin restarts/updates gracefully (name-based resolution)
**Plans**: TBD

Plans:
- [ ] 07-01: Parameter discovery and name-based resolution
- [ ] 07-02: Parameter setting with shadow state

### Phase 8: VST Integration
**Goal**: Users can control Serum 2 and Addictive Drums 2 via natural language
**Depends on**: Phase 7 (plugin control foundation)
**Requirements**: PLUG-02, PLUG-03
**Success Criteria** (what must be TRUE):
  1. User can say "create a warm pad in Serum" and get appropriate patch configuration
  2. User can say "add more filter movement" to an existing Serum patch
  3. User can say "switch to brush kit in Addictive Drums" and kit changes
  4. User can say "adjust hi-hat openness velocity curve" in AD2
**Plans**: TBD

Plans:
- [ ] 08-01: Serum 2 parameter mapping and sound design tools
- [ ] 08-02: Addictive Drums 2 integration (kit selection, MIDI mapping, velocity)

### Phase 9: Deep Humanization & Abstraction
**Goal**: Advanced humanization with performance artifacts, plus multi-level creative control
**Depends on**: Phase 5 (basic humanization), Phase 2-4 (content to refine)
**Requirements**: HUMAN-02, HUMAN-03, PIANO-02, PIANO-03
**Success Criteria** (what must be TRUE):
  1. User can say "make this sound more like a live performance" and hear timing drift/return, subtle overlaps
  2. User can give high-level direction ("melancholic piano intro") or low-level tweaks ("shift note 3 up a semitone")
  3. User can iterate quickly ("make the second phrase quieter") without re-describing full context
  4. System maintains session memory for iterative refinement
**Plans**: TBD

Plans:
- [ ] 09-01: Performance artifacts (overlaps, releases, timing drift)
- [ ] 09-02: Multi-level abstraction engine
- [ ] 09-03: Session memory for iterative refinement

### Phase 10: Arrangement
**Goal**: Users can control playlist/timeline for song structure
**Depends on**: Phase 1-6 (patterns, mixer channels exist to arrange)
**Requirements**: ARR-01
**Success Criteria** (what must be TRUE):
  1. User can say "duplicate this pattern to bar 17" and playlist updates
  2. User can say "create an intro section with just the piano" and arrangement changes
  3. User can say "add a chorus after the verse" and structure is created
  4. User can say "extend this section by 8 bars" and arrangement adjusts
**Plans**: TBD

Plans:
- [ ] 10-01: Playlist clip manipulation
- [ ] 10-02: Song structure and section management

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Communication | 0/3 | Not started | - |
| 2. Note Generation Core | 0/3 | Not started | - |
| 3. Piano Roll Editing | 0/1 | Not started | - |
| 4. Drum Patterns | 0/1 | Not started | - |
| 5. Basic Humanization | 0/2 | Not started | - |
| 6. Mixer Control | 0/2 | Not started | - |
| 7. Generic Plugin Control | 0/2 | Not started | - |
| 8. VST Integration | 0/2 | Not started | - |
| 9. Deep Humanization & Abstraction | 0/3 | Not started | - |
| 10. Arrangement | 0/2 | Not started | - |

---
*Created: 2026-02-23*
*Total requirements: 22 | Total phases: 10 | Depth: comprehensive*
