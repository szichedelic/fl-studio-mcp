# Requirements: FL Studio MCP Server

**Defined:** 2026-02-23
**Core Value:** Natural language to human-sounding music in FL Studio

## Validated (v1.0)

Completed in milestone v1.0. Not in current roadmap.

- [x] **FOUND-01**: Transport control (play, stop, record)
- [x] **FOUND-02**: Project state reading (patterns, channels, mixer)
- [x] **FOUND-03**: Pattern selection and creation
- [x] **COMP-01**: Note/MIDI generation from natural language
- [x] **COMP-02**: Chord progression generation
- [x] **COMP-03**: Melody generation
- [x] **COMP-04**: Bass line generation
- [x] **COMP-06**: Scale/key locking

## v2.0 Requirements

Requirements for milestone v2.0 Production Pipeline. Each maps to roadmap phases.

### Humanization

- [x] **HUM-01**: User can humanize notes with Brownian-walk timing push/pull that creates natural drift patterns
- [x] **HUM-02**: User can apply velocity variation with per-instrument profiles (drums, piano, bass, synths)
- [x] **HUM-03**: User can apply swing/groove (50-75% range) to any note pattern
- [x] **HUM-04**: User can vary note lengths per beat position (legato vs staccato)
- [x] **HUM-05**: User can apply context-aware humanization (tight for fast passages, loose for slow)
- [x] **HUM-06**: User can select named humanization presets ("tight", "loose", "jazz", "lo-fi") with beat-position awareness

### Plugin Control

- [x] **PLUG-01**: User can discover all parameters of any loaded VST plugin by name
- [x] **PLUG-02**: User can get and set any VST parameter by name (not index)
- [x] **PLUG-03**: System maintains shadow state for all parameter changes to work around getParamValue bugs

### Serum 2 Sound Design

- [ ] **SER-01**: User can control Serum 2 oscillators, filters, macros, and FX via semantic names
- [ ] **SER-02**: System uses fuzzy parameter name matching for resilience across Serum 2 versions
- [ ] **SER-03**: User can create sounds from recipes (pad, bass, lead, pluck) that set multiple parameters at once
- [ ] **SER-04**: User can browse and load Serum 2 presets

### Audio Rendering

- [ ] **REN-01**: User can render patterns to WAV via guided workflow with clear step-by-step instructions
- [ ] **REN-02**: System automatically detects rendered WAV files and tracks them for downstream processing

### Sample Manipulation

- [ ] **SAM-01**: User can pitch-shift and detune audio samples
- [ ] **SAM-02**: User can reverse audio samples
- [ ] **SAM-03**: User can time-stretch audio samples
- [ ] **SAM-04**: User can layer and mix multiple audio files with stereo detune effects
- [ ] **SAM-05**: User can execute full resampling workflow (generate notes -> render -> manipulate -> reload)

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Mixing & Mastering

- **MIX-01**: User can control mixing plugins (Neutron, Ozone, Thermal, Portal)
- **MIX-02**: User can set up sidechain compression via natural language

### Advanced Performance

- **PERF-01**: User can model performance artifacts (fatigue, hand dominance)
- **PERF-02**: User can apply ML-based humanization trained on real performances

### Arrangement

- **ARR-01**: User can arrange patterns on the playlist via natural language
- **ARR-02**: User can create song structures (intro, verse, chorus, bridge)

### Additional Composition

- **COMP-05**: Drum pattern generation
- **AD2-01**: User can control Addictive Drums 2 kit selection and parameters

## Out of Scope

| Feature | Reason |
|---------|--------|
| ML-based humanization | Algorithmic Brownian walk achieves 90% of value with zero complexity |
| Full Serum 2 preset editor UI | Scope explosion; Serum has its own UI for deep editing |
| Real-time audio streaming | Not feasible via SysEx bridge |
| Edison scripting | Isolated interpreter, no communication with MIDI scripts |
| Sample chopping (Slicer/Slicex) | Programmatic API access unconfirmed |
| Genre-specific presets | Tools are genre-agnostic by design |
| Sample library management | Not organizing Splice library |
| Full song generation | Anti-feature: removes creative ownership |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HUM-01 | Phase 3 | Complete |
| HUM-02 | Phase 3 | Complete |
| HUM-03 | Phase 3 | Complete |
| HUM-04 | Phase 3 | Complete |
| HUM-05 | Phase 3 | Complete |
| HUM-06 | Phase 3 | Complete |
| PLUG-01 | Phase 4 | Complete |
| PLUG-02 | Phase 4 | Complete |
| PLUG-03 | Phase 4 | Complete |
| SER-01 | Phase 5 | Pending |
| SER-02 | Phase 5 | Pending |
| SER-03 | Phase 5 | Pending |
| SER-04 | Phase 5 | Pending |
| REN-01 | Phase 6 | Pending |
| REN-02 | Phase 6 | Pending |
| SAM-01 | Phase 7 | Pending |
| SAM-02 | Phase 7 | Pending |
| SAM-03 | Phase 7 | Pending |
| SAM-04 | Phase 7 | Pending |
| SAM-05 | Phase 7 | Pending |

**Coverage:**
- v2.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-25 after Phase 4 complete*
