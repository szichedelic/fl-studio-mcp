# Roadmap: FL Studio MCP Server

## Milestones

- [x] **v1.0 Foundation & Note Generation** - Phases 1-2 (shipped 2026-02-23)
- [x] **v2.0 Production Pipeline** - Phases 3-7 (shipped 2026-02-25)
- [ ] **v2.1 Song Building & Mixing** - Phases 8-11 (in progress)

## Overview

v2.1 delivers song construction capabilities: mixer control for balancing and routing, playlist track organization, marker-based navigation, and project-level controls (including tempo setting). The milestone prioritizes mixer features (highest value, lowest risk) before moving to playlist management and project settings.

## Phases

<details>
<summary>v1.0 Foundation & Note Generation (Phases 1-2) - SHIPPED 2026-02-23</summary>

- [x] Phase 1: Foundation & Communication (3/3 plans) - 2026-02-23
- [x] Phase 2: Note Generation Core (3/3 plans) - 2026-02-23

See: .planning/milestones/v1.0-ROADMAP.md (if archived)

</details>

<details>
<summary>v2.0 Production Pipeline (Phases 3-7) - SHIPPED 2026-02-25</summary>

- [x] Phase 3: Humanization Engine (3/3 plans) - 2026-02-24
- [x] Phase 4: Generic Plugin Control (3/3 plans) - 2026-02-25
- [x] Phase 5: Serum 2 Sound Design (3/3 plans) - 2026-02-24
- [x] Phase 6: Audio Rendering Workflow (2/2 plans) - 2026-02-25
- [x] Phase 7: Sample Manipulation (3/3 plans) - 2026-02-25

See: .planning/milestones/v2.0-ROADMAP.md

</details>

## v2.1 Song Building & Mixing (In Progress)

**Milestone Goal:** Enable full song creation from arranging patterns through mixing and balancing, with abstract primitives that support natural conversation.

- [ ] **Phase 8: Mixer Core** - Volume, pan, mute, solo, and track organization
- [ ] **Phase 9: Mixer Routing & Advanced** - Send routing, EQ, and effect slot access
- [ ] **Phase 10: Playlist & Markers** - Track management and marker navigation
- [ ] **Phase 11: Project Controls** - Tempo, playback position, and undo/redo

## Phase Details

### Phase 8: Mixer Core
**Goal**: Users can mix tracks with volume, pan, and mute/solo controls
**Depends on**: Phase 7 (v2.0 complete)
**Requirements**: MIX-01, MIX-02, MIX-03, MIX-04, MIX-05, MIX-06
**Success Criteria** (what must be TRUE):
  1. User can read any mixer track's volume, pan, mute, and solo state
  2. User can set mixer track volume with natural language ("set drums to -6dB", "make bass louder")
  3. User can pan tracks left/right ("pan guitar hard left", "center the vocals")
  4. User can mute and solo tracks individually or in groups
  5. User can rename and color-code mixer tracks for organization
**Plans**: 2 plans

Plans:
- [ ] 08-01: Mixer state reading (get volume, pan, mute, solo for any track)
- [ ] 08-02: Mixer mutations (set volume, pan, mute, solo, name, color)

### Phase 9: Mixer Routing & Advanced
**Goal**: Users can create send busses, parallel processing, and control per-track EQ
**Depends on**: Phase 8
**Requirements**: MIX-07, MIX-08, MIX-09, MIX-10, MIX-11
**Success Criteria** (what must be TRUE):
  1. User can view which tracks route to which destinations
  2. User can create sends from any track to any bus ("send drums to reverb bus")
  3. User can set send levels per route ("50% send to delay bus")
  4. User can adjust built-in EQ bands per track ("boost highs on snare")
  5. User can access plugins in mixer effect slots via existing plugin control system
**Plans**: 2 plans

Plans:
- [ ] 09-01: Mixer routing (get/set routing, send levels)
- [ ] 09-02: Mixer EQ and effect slots (EQ bands, plugin slot access)

### Phase 10: Playlist & Markers
**Goal**: Users can organize playlist tracks and navigate via markers
**Depends on**: Phase 8
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, PLAY-06, PLAY-07, PLAY-08
**Success Criteria** (what must be TRUE):
  1. User can query playlist track count, names, and states
  2. User can mute/solo playlist tracks ("mute verse 2 tracks")
  3. User can rename and color playlist tracks for organization
  4. User can add markers at specific times ("marker at bar 32 called Chorus")
  5. User can navigate to markers by name ("jump to Bridge")
  6. User can list all markers in the project
  7. User can trigger live clips in performance mode
**Plans**: 3 plans

Plans:
- [ ] 10-01: Playlist track management (get info, mute, solo, name, color)
- [ ] 10-02: Markers (add, list, navigate)
- [ ] 10-03: Live clip triggering (performance mode)

### Phase 11: Project Controls
**Goal**: Users can control project-level settings like tempo and playback position
**Depends on**: Phase 8
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06
**Success Criteria** (what must be TRUE):
  1. User can read current tempo
  2. User can set tempo ("set tempo to 128 BPM") via processRECEvent
  3. User can read current playback position in bars/beats
  4. User can jump to specific positions ("go to bar 16")
  5. User can undo/redo operations
**Plans**: 2 plans

Plans:
- [ ] 11-01: Tempo and position (get/set tempo, get/set position)
- [ ] 11-02: Undo/redo operations

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 9 -> 10 -> 11

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation & Communication | v1.0 | 3/3 | Complete | 2026-02-23 |
| 2. Note Generation Core | v1.0 | 3/3 | Complete | 2026-02-23 |
| 3. Humanization Engine | v2.0 | 3/3 | Complete | 2026-02-24 |
| 4. Generic Plugin Control | v2.0 | 3/3 | Complete | 2026-02-25 |
| 5. Serum 2 Sound Design | v2.0 | 3/3 | Complete | 2026-02-24 |
| 6. Audio Rendering Workflow | v2.0 | 2/2 | Complete | 2026-02-25 |
| 7. Sample Manipulation | v2.0 | 3/3 | Complete | 2026-02-25 |
| 8. Mixer Core | v2.1 | 0/2 | Not started | - |
| 9. Mixer Routing & Advanced | v2.1 | 0/2 | Not started | - |
| 10. Playlist & Markers | v2.1 | 0/3 | Not started | - |
| 11. Project Controls | v2.1 | 0/2 | Not started | - |

---
*Roadmap updated: 2026-02-25*
*Milestone: v2.1 Song Building & Mixing*
