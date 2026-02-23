# Requirements: FL Studio MCP Server

## v1 Requirements

### Foundation & Communication

- [ ] **FOUND-01**: Transport control (play, stop, record, tempo)
- [ ] **FOUND-02**: Project state reading (patterns, tracks, mixer state, arrangement)
- [ ] **FOUND-03**: Pattern selection and creation

### Composition

- [ ] **COMP-01**: Note/MIDI generation from natural language
- [ ] **COMP-02**: Chord progression generation
- [ ] **COMP-03**: Melody generation
- [ ] **COMP-04**: Bass line generation
- [ ] **COMP-05**: Drum pattern generation
- [ ] **COMP-06**: Scale/key locking

### Humanization

- [ ] **HUMAN-01**: Basic humanization (timing/velocity variation)
- [ ] **HUMAN-02**: Deep humanization engine (brownian noise timing, velocity curves per-beat)
- [ ] **HUMAN-03**: Performance artifacts (overlaps, releases, subtle imperfections)

### Mixer & Routing

- [ ] **MIX-01**: Basic mixer control (volume, pan, mute, solo)
- [ ] **MIX-02**: Sidechain setup (automated routing)
- [ ] **MIX-03**: Bus/send routing

### Piano Roll & Editing

- [ ] **PIANO-01**: Piano roll manipulation (edit existing notes)
- [ ] **PIANO-02**: Multi-level abstraction (high-level creative to low-level tweaks)
- [ ] **PIANO-03**: Iterative refinement (session memory, quick back-and-forth)

### Arrangement

- [ ] **ARR-01**: Playlist/arrangement control (arrange clips, create sections, structure songs)

### Plugin Integration

- [ ] **PLUG-01**: Generic plugin parameter control
- [ ] **PLUG-02**: Serum 2 sound design (create patches from scratch via natural language)
- [ ] **PLUG-03**: Addictive Drums 2 integration (kit selection, MIDI mapping, velocity curves)

---

## v2 Requirements (Deferred)

- [ ] Voice input for hands-free control
- [ ] Contextual suggestions ("this would sound good with X")
- [ ] Mixing/mastering plugin control (Neutron, Ozone, Thermal, Portal)

---

## Out of Scope

| Exclusion | Rationale |
|-----------|-----------|
| **Full song generation** | Anti-feature: removes creative ownership, users want control |
| **Genre-specific presets** | User makes diverse genres; tools must be genre-agnostic |
| **Sample library management** | Not core value; user manages Splice library themselves |
| **Auto-mixing/mastering** | Different workflow; competes with dedicated tools |
| **Cloud dependencies** | Privacy concerns; must run locally |
| **Robotic quantization** | Always humanize by default; user can tighten if wanted |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| COMP-01 | Phase 2 | Pending |
| COMP-02 | Phase 2 | Pending |
| COMP-03 | Phase 2 | Pending |
| COMP-04 | Phase 2 | Pending |
| COMP-05 | Phase 4 | Pending |
| COMP-06 | Phase 2 | Pending |
| HUMAN-01 | Phase 5 | Pending |
| HUMAN-02 | Phase 9 | Pending |
| HUMAN-03 | Phase 9 | Pending |
| MIX-01 | Phase 6 | Pending |
| MIX-02 | Phase 6 | Pending |
| MIX-03 | Phase 6 | Pending |
| PIANO-01 | Phase 3 | Pending |
| PIANO-02 | Phase 9 | Pending |
| PIANO-03 | Phase 9 | Pending |
| ARR-01 | Phase 10 | Pending |
| PLUG-01 | Phase 7 | Pending |
| PLUG-02 | Phase 8 | Pending |
| PLUG-03 | Phase 8 | Pending |

---
*Last updated: 2026-02-23 after roadmap creation*
