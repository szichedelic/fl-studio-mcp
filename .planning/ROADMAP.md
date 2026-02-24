# Roadmap: FL Studio MCP Server

## Milestones

- Completed: **v1.0 Foundation & Note Generation** - Phases 1-2 (shipped 2026-02-23)
- In progress: **v2.0 Production Pipeline** - Phases 3-7

## Phases

<details>
<summary>v1.0 Foundation & Note Generation (Phases 1-2) - SHIPPED 2026-02-23</summary>

### Phase 1: Foundation & Communication
**Goal**: Establish reliable bidirectional communication between MCP client and FL Studio
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Plans**: 3 plans

Plans:
- [x] 01-01: MCP server scaffolding + SysEx codec + MIDI client
- [x] 01-02: FL Bridge Python script with safe initialization
- [x] 01-03: Transport control + state reading + pattern operations

### Phase 2: Note Generation Core
**Goal**: Users can create musical content from natural language descriptions
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-06
**Plans**: 3 plans

Plans:
- [x] 02-01: Music theory engine (tonal library, scales, chords, melody/bass generators)
- [x] 02-02: FL Bridge pianoroll handler + ComposeWithBridge.pyscript
- [x] 02-03: MCP note tools wiring theory engine to FL Bridge

</details>

### v2.0 Production Pipeline (In Progress)

**Milestone Goal:** Transform note generation into a full creative production toolkit -- humanize MIDI, design sounds in Serum 2, render to audio, and manipulate samples.

- [ ] **Phase 3: Humanization Engine** - Notes sound human with timing drift, velocity curves, swing, and articulation
- [ ] **Phase 4: Generic Plugin Control** - Discover and control any VST parameter by name
- [ ] **Phase 5: Serum 2 Sound Design** - Create and shape sounds in Serum 2 via natural language
- [ ] **Phase 6: Audio Rendering Workflow** - Render patterns to WAV with guided workflow and automatic file detection
- [ ] **Phase 7: Sample Manipulation** - Pitch-shift, reverse, stretch, layer, and resample audio

## Phase Details

### Phase 3: Humanization Engine
**Goal**: Generated music sounds human -- timing breathes, dynamics vary, groove feels alive
**Depends on**: Phase 2 (requires NoteData[] to transform)
**Requirements**: HUM-01, HUM-02, HUM-03, HUM-04, HUM-05, HUM-06
**Success Criteria** (what must be TRUE):
  1. User can humanize a pattern and hear Brownian-walk timing drift that sounds organic, not random noise
  2. User can apply velocity variation with instrument-appropriate profiles (e.g., drums emphasize ghost notes, piano breathes dynamically)
  3. User can apply swing (50-75%) and hear groove shift on off-beat notes
  4. User can get context-aware humanization where fast passages stay tight and slow passages breathe more
  5. User can select named presets ("tight", "loose", "jazz", "lo-fi") and hear distinctly different humanization character
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md -- Types, utilities, swing engine, and O-U timing drift
- [ ] 03-02-PLAN.md -- Velocity profiles, note-length variation, and named presets
- [ ] 03-03-PLAN.md -- Pipeline orchestrator and MCP tool wiring

### Phase 4: Generic Plugin Control
**Goal**: Users can discover and manipulate any loaded VST plugin's parameters by name
**Depends on**: Phase 1 (FL Bridge for SysEx commands)
**Requirements**: PLUG-01, PLUG-02, PLUG-03
**Success Criteria** (what must be TRUE):
  1. User can ask "what parameters does this plugin have?" and get a filtered list of real parameter names (not 4240 blank slots)
  2. User can set any VST parameter by its name (e.g., "set Filter Cutoff to 75%") and the plugin responds
  3. User can read parameter values reliably even when FL Studio's getParamValue is buggy (shadow state fills the gap)
  4. Parameter name resolution survives plugin version updates (name-based, not index-based)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Serum 2 Sound Design
**Goal**: Users can create and shape sounds in Serum 2 using musical language, not parameter indices
**Depends on**: Phase 4 (generic plugin control and parameter cache must exist)
**Requirements**: SER-01, SER-02, SER-03, SER-04
**Success Criteria** (what must be TRUE):
  1. User can control Serum 2 oscillators, filters, macros, and FX using semantic names (e.g., "set oscillator 1 to saw, filter cutoff to 40%")
  2. User can say "create a warm pad" and get a multi-parameter recipe applied that produces an appropriate sound
  3. User can request parameter changes using approximate names and fuzzy matching finds the right parameter
  4. User can browse and load Serum 2 presets via natural language
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Audio Rendering Workflow
**Goal**: Users can render MIDI patterns to WAV files with a seamless guided workflow
**Depends on**: Phase 1 (FL Bridge for state reading)
**Requirements**: REN-01, REN-02
**Success Criteria** (what must be TRUE):
  1. User can say "render this pattern" and receive clear step-by-step instructions (suggested filename, output path, exact FL Studio steps)
  2. System automatically detects when a rendered WAV file appears and confirms it is ready for downstream processing
  3. Rendered files are tracked and available for sample manipulation in Phase 7
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Sample Manipulation
**Goal**: Users can transform audio samples and execute full resampling workflows
**Depends on**: Phase 6 (needs rendered WAV files as source material)
**Requirements**: SAM-01, SAM-02, SAM-03, SAM-04, SAM-05
**Success Criteria** (what must be TRUE):
  1. User can pitch-shift or detune a sample and hear the result (e.g., "pitch this down an octave")
  2. User can reverse or time-stretch a sample via natural language
  3. User can layer multiple audio files with stereo detune effects to create rich textures
  4. User can execute a full resampling workflow: generate notes, render to audio, manipulate the audio, and get instructions to reload into FL Studio
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 3 -> 4 -> 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Communication | v1.0 | 3/3 | Complete | 2026-02-23 |
| 2. Note Generation Core | v1.0 | 3/3 | Complete | 2026-02-23 |
| 3. Humanization Engine | v2.0 | 0/3 | Not started | - |
| 4. Generic Plugin Control | v2.0 | 0/TBD | Not started | - |
| 5. Serum 2 Sound Design | v2.0 | 0/TBD | Not started | - |
| 6. Audio Rendering Workflow | v2.0 | 0/TBD | Not started | - |
| 7. Sample Manipulation | v2.0 | 0/TBD | Not started | - |

---
*Created: 2026-02-23 (v1.0 phases)*
*Updated: 2026-02-23 (v2.0 phases 3-7 added)*
*v2.0 requirements: 20 | v2.0 phases: 5 | Depth: comprehensive*
