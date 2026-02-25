# Requirements: FL Studio MCP Server

**Defined:** 2026-02-25
**Core Value:** Natural language to human-sounding music in FL Studio

## v2.1 Requirements

Requirements for Song Building & Mixing milestone. Each maps to roadmap phases.

### Mixer Control

- [x] **MIX-01**: Get mixer track volume, pan, mute, and solo state
- [x] **MIX-02**: Set mixer track volume (0.0-1.0, where 0.8 = unity/0dB)
- [x] **MIX-03**: Set mixer track pan (-1.0 to 1.0, where 0 = center)
- [x] **MIX-04**: Mute/unmute mixer tracks
- [x] **MIX-05**: Solo/unsolo mixer tracks
- [x] **MIX-06**: Get/set mixer track name and color
- [x] **MIX-07**: Get mixer routing state (which tracks send to which)
- [x] **MIX-08**: Set mixer routing (send track A to track B)
- [x] **MIX-09**: Set send levels per route
- [x] **MIX-10**: Control mixer track EQ (built-in parametric EQ per track)
- [x] **MIX-11**: Access mixer effect slot plugins (discover/get/set params via existing plugin system)

### Playlist Control

- [x] **PLAY-01**: Get playlist track count and names
- [x] **PLAY-02**: Mute/unmute playlist tracks
- [x] **PLAY-03**: Solo/unsolo playlist tracks
- [x] **PLAY-04**: Get/set playlist track name and color
- [x] **PLAY-05**: Navigate to markers by name or index
- [x] **PLAY-06**: Add time markers at current position or specific time
- [x] **PLAY-07**: List all markers in project
- [x] **PLAY-08**: Trigger live clips in performance mode

### Project Control

- [ ] **PROJ-01**: Get current tempo (BPM)
- [ ] **PROJ-02**: Set tempo (BPM) via processRECEvent
- [ ] **PROJ-03**: Get current playback position (bars, beats, ticks)
- [ ] **PROJ-04**: Set playback position / jump to position
- [ ] **PROJ-05**: Undo last operation
- [ ] **PROJ-06**: Redo last undone operation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Playlist clip/pattern placement | No FL Studio API exists - must be done manually |
| Time signature setting | No API - user must change via F10 > Project Settings |
| Time signature reading | Only available in piano roll scripts, not MIDI controller scripts |
| Load effects into mixer slots | API can control existing plugins but not add new ones |
| Mixing/mastering presets | This milestone focuses on primitives, not opinionated presets |

## Future Requirements (v2.2+)

Deferred to future releases. Tracked but not in current roadmap.

### Automation
- **AUTO-01**: Read automation clip values
- **AUTO-02**: Write automation clip points

### Advanced Arrangement
- **ARR-01**: Guided workflow for pattern placement (instructions + verification)
- **ARR-02**: Song section templates (verse/chorus/bridge structure suggestions)

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIX-01 | Phase 8 | Complete |
| MIX-02 | Phase 8 | Complete |
| MIX-03 | Phase 8 | Complete |
| MIX-04 | Phase 8 | Complete |
| MIX-05 | Phase 8 | Complete |
| MIX-06 | Phase 8 | Complete |
| MIX-07 | Phase 9 | Complete |
| MIX-08 | Phase 9 | Complete |
| MIX-09 | Phase 9 | Complete |
| MIX-10 | Phase 9 | Complete |
| MIX-11 | Phase 9 | Complete |
| PLAY-01 | Phase 10 | Complete |
| PLAY-02 | Phase 10 | Complete |
| PLAY-03 | Phase 10 | Complete |
| PLAY-04 | Phase 10 | Complete |
| PLAY-05 | Phase 10 | Complete |
| PLAY-06 | Phase 10 | Complete |
| PLAY-07 | Phase 10 | Complete |
| PLAY-08 | Phase 10 | Complete |
| PROJ-01 | Phase 11 | Pending |
| PROJ-02 | Phase 11 | Pending |
| PROJ-03 | Phase 11 | Pending |
| PROJ-04 | Phase 11 | Pending |
| PROJ-05 | Phase 11 | Pending |
| PROJ-06 | Phase 11 | Pending |

**Coverage:**
- v2.1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after Phase 10 completion*
