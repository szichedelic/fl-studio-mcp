# Project Research Summary

**Project:** FL Studio MCP Server v2.1 - Song Building and Mixing
**Domain:** DAW automation / AI music production assistant
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

FL Studio's Python API provides comprehensive mixer track control (volume, pan, mute, solo, routing) with well-documented functions. Playlist track management is similarly robust for track properties. However, the v2.1 milestone reveals critical gaps: there is NO API for placing patterns/clips on the playlist timeline, tempo is READ-ONLY (cannot be set programmatically), and time signature access is unclear or nonexistent. These are not implementation challenges but hard API boundaries.

The recommended approach is to embrace these constraints: build comprehensive mixer control with proper routing and EQ capabilities, deliver playlist track management (mute, solo, color, name), enable marker navigation, and guide users for operations the API cannot perform (clip placement, tempo changes). The architecture extends existing FL Bridge patterns cleanly with three new handler modules (mixer.py, playlist.py, project.py) following proven registration and SysEx patterns from v1.0 and v2.0.

Key risks center on index confusion (mixer is 0-indexed with track 0=Master, playlist is 1-indexed), pickup mode handling for smooth parameter changes, and routing complexity requiring explicit UI update calls. The mixer's non-linear volume scale (0.8=unity gain, not 1.0) and BGR color format (not RGB) will cause user confusion if not documented clearly. These are all manageable with proper validation and clear tool descriptions.

## Key Findings

### Recommended Stack

**Summary:** No new dependencies required for v2.1. The existing FL Studio Python API provides all needed functions for mixer, playlist, and project control. All implementation happens through extending the existing FL Bridge (Python) and MCP server (TypeScript) architecture established in v1.0/v2.0.

**Core technologies:**
- FL Studio `mixer` module: Volume, pan, mute, solo, routing, EQ, stereo separation, track names/colors
- FL Studio `playlist` module: Track properties (name, color, mute, solo, selection), track count
- FL Studio `arrangement` module: Marker navigation, auto-time marker creation
- FL Studio `general` module: Project info (PPQ/timebase), undo capabilities
- Existing MCP/SysEx bridge: Proven pattern for command routing and response handling

**Critical stack insight from STACK.md:** The v2.0 stack research focused on humanization, plugin control, and audio rendering. For v2.1, no new npm packages or system dependencies are needed. The FL Studio API already exposes all mixer and playlist functions through built-in Python modules. However, STACK.md confirms critical limitations that shape v2.1: no render API (affects workflow), no sample loading API, and no clip placement API (directly impacts playlist features).

### Expected Features

**Summary:** Users expect comprehensive mixing control (all table stakes features are available via API) and basic arrangement navigation. The critical finding: pattern/clip placement on the playlist timeline is NOT possible programmatically - this removes a major expected feature from scope.

**Must have (table stakes):**
- Mixer volume/pan control (0.0-1.0, -1.0 to 1.0)
- Mixer mute/solo operations
- Mixer track info queries (name, color, volume, pan state)
- Playlist track properties (name, color, mute, solo)
- Current tempo reading
- Playback position queries
- Marker navigation

**Should have (competitive):**
- Mixer routing (send busses, parallel processing) via `setRouteTo` + `setRouteToLevel`
- Stereo separation control
- Track arming for recording
- Plugin editor focus (quick access to effects)
- Time markers (add auto-time markers, jump by name)
- Natural language mixing commands ("make drums louder, pan guitar left")

**Defer (cannot implement due to API gaps):**
- Programmatic clip placement on playlist - NO API EXISTS
- Tempo setting/automation - READ-ONLY via `getCurrentTempo()`
- Time signature changes - NO API FOUND
- Real-time automation curves - Would require per-tick updates
- Full project arrangement generation - Depends on clip placement

**Anti-features identified:** Automated mixing/mastering (removes creative control), full project creation (removes ownership), plugin preset recall per track (loading plugins not available).

### Architecture Approach

**Summary:** Extend the existing SysEx bridge architecture with three new handler modules following proven v1.0/v2.0 patterns. Each handler focuses on a single FL Studio API module domain. The TypeScript MCP tools remain thin wrappers that delegate to Python handlers via the established ConnectionManager.

**Major components:**
1. **mixer.py handler** (NEW) - Registers mixer.* commands for volume, pan, mute, solo, routing, EQ using FL Studio's `mixer` module
2. **playlist.py handler** (NEW) - Registers playlist.* commands for track properties using FL Studio's `playlist` module (note: no clip placement)
3. **project.py handler** (NEW) - Registers project.* commands for tempo reading, markers using `general`, `arrangement`, and `transport` modules
4. **mixer.ts tools** (NEW) - MCP tool definitions that call mixer.py handlers via executeCommand()
5. **playlist.ts tools** (NEW) - MCP tool definitions for playlist operations
6. **project.ts tools** (NEW) - MCP tool definitions for project-level queries

**Architecture patterns to follow:**
- Handler registration pattern: Each handler self-registers via `register_handler()` on import
- Validation in handler: Parameter bounds checking happens in Python, not TypeScript
- State read vs. action separation: Existing `state.mixer` reads all tracks; new `mixer.set_volume` mutates one
- Fresh state queries: Never cache frequently-changing values (volume, pan) - always query before relative operations

### Critical Pitfalls

**Top 5 from PITFALLS.md:**

1. **No API to place pattern clips on playlist timeline** - The `playlist` module has NO `addClip`, `placePattern`, or similar function. Accept this constraint: focus on playlist TRACK management (mute, solo, color, name) rather than clip placement. Guide users: "Drag Pattern 3 to track 2 at bar 8". Do NOT promise automated arrangement.

2. **Mixer routing requires explicit UI update** - After calling `mixer.setRouteTo()` to create routings, MUST call `mixer.afterRoutingChanged()` or the UI won't reflect changes. Always call once after ALL routing operations complete, not after each individual change.

3. **Tempo is READ-ONLY** - `mixer.getCurrentTempo()` reads tempo but NO `setTempo()` function exists in any module. Design tempo tools as queries only. Guide users to change tempo manually. Do not promise programmatic tempo setting.

4. **Index confusion: Mixer 0-indexed (0=Master), Playlist 1-indexed** - Mixer tracks: 0=Master, 1+=inserts. Playlist tracks: 1-indexed (track 1 is first). Validate all indices against `trackCount()`. Use `mixer.getTrackInfo(midi.TN_Master)` and `midi.TN_FirstIns` for clarity.

5. **Pickup mode confusion causes audible clicks** - `setTrackVolume(track, value, pickupMode)` parameter controls transition. Use `PIM_None` (0) for programmatic absolute changes when stopped. Wrong pickup mode causes audible pops during playback or delayed/ignored changes.

**Other critical issues:**
- Mixer effect slot plugin addressing differs from channel rack (must specify `slotIndex` 0-9 for mixer slots)
- Mute/Solo has THREE states (1=force on, 0=force off, -1=toggle) not two
- Volume is non-linear (0.8=unity/0dB, not 1.0)
- Color format is BGR (0x--BBGGRR) not RGB
- Playlist tracks are 1-indexed unlike everything else
- No general marker API (only navigation + auto-time markers)

## Implications for Roadmap

Based on research, suggested 4-phase structure for v2.1:

### Phase 1: Mixer Track Control (Core)
**Rationale:** Mixer API is well-documented, existing `state.py` already reads mixer state successfully. Mutations are straightforward extensions. This is the lowest-risk, highest-value phase.

**Delivers:**
- Individual mixer track control (volume, pan, mute, solo, arm)
- Track naming and color organization
- Foundation for mixing workflow

**Addresses features:**
- `set_mixer_volume` - Set track volume (0.0-1.0, document 0.8=unity)
- `set_mixer_pan` - Set track pan (-1.0 to 1.0)
- `mute_mixer_track` - Force mute/unmute/toggle
- `solo_mixer_track` - Solo with mode options
- `mixer_arm_track` - Toggle recording arm
- `set_mixer_track_name` - Rename tracks
- `set_mixer_track_color` - Color organization (convert RGB to BGR)

**Avoids pitfalls:**
- Pitfall #4: Index validation (0=Master, 1+=inserts)
- Pitfall #5: Pickup mode handling (default PIM_None for programmatic changes)
- Pitfall #15: Volume scale documentation (0.8=unity)
- Pitfall #11: Explicit mute state (1/0/-1)
- Pitfall #14: BGR color conversion

**Research flag:** No additional research needed - mixer API is thoroughly documented in official stubs.

### Phase 2: Mixer Routing & Advanced Control
**Rationale:** Build on Phase 1 foundation to enable professional mixing workflows with routing, sends, and EQ. Requires careful handling of `afterRoutingChanged()` to avoid UI glitches.

**Delivers:**
- Send busses and parallel processing
- EQ band control per track
- Stereo separation
- Enable/disable effect slots
- Plugin editor focus

**Addresses features:**
- `set_mixer_routing` - Route track to destination via `setRouteTo()`
- `set_mixer_send_level` - Set send amount via `setRouteToLevel()`
- `set_mixer_eq_band` - Control EQ gain/freq/bandwidth per band
- `set_mixer_stereo_sep` - Stereo width control
- `mixer_enable_slots` - Bypass all effects on track
- `mixer_focus_editor` - Open effect plugin window

**Avoids pitfalls:**
- Pitfall #2: Call `afterRoutingChanged()` after batch routing operations
- Pitfall #8: Mixer effect slots use `mixerTrack` + `slotIndex` (0-9), not channel index
- Pitfall #12: Solo mode complexity with routing (test with submixes)

**Research flag:** Standard patterns, but test routing with complex projects to verify `afterRoutingChanged()` behavior.

### Phase 3: Playlist Track Management
**Rationale:** Playlist track properties (mute, solo, name, color) follow similar patterns to mixer. Critically, this phase does NOT include clip placement (API does not support it).

**Delivers:**
- Playlist track organization
- Arrangement view control (track mute/solo)
- Track selection state management

**Addresses features:**
- `playlist_mute_track` - Mute/unmute playlist tracks
- `playlist_solo_track` - Solo playlist tracks
- `set_playlist_track_name` - Rename tracks
- `set_playlist_track_color` - Color organization
- `playlist_select_track` - Toggle selection
- `get_playlist_tracks` - Query all track info

**Avoids pitfalls:**
- Pitfall #6: Playlist 1-indexed (start loops at 1, not 0)
- Pitfall #1: NO clip placement API - do not promise or attempt
- Pitfall #14: BGR color format (same as mixer)

**Research flag:** Validate during implementation that playlist track iteration starts at 1 and `trackCount()` is exclusive upper bound.

### Phase 4: Project Settings & Markers
**Rationale:** Project-level controls (tempo reading, marker navigation) are independent features with no dependencies on earlier phases. Defer to end since they're "nice to have" rather than core mixing workflow.

**Delivers:**
- Tempo and timebase queries
- Marker navigation for arrangement sections
- Auto-time marker creation

**Addresses features:**
- `get_tempo` - Read current tempo (READ-ONLY, document limitation)
- `get_project_info` - PPQ/timebase, project data
- `jump_to_marker` - Navigate to named marker
- `get_marker_name` - Query marker info
- `add_auto_time_marker` - Add automatic time markers

**Avoids pitfalls:**
- Pitfall #3: Tempo is READ-ONLY, no setter exists
- Pitfall #7: Limited marker API (navigation + auto-time markers only, no general add/delete)
- Pitfall #13: Time signature not directly readable

**Research flag:** LOW priority for additional research. Document limitations clearly.

### Phase Ordering Rationale

- **Start with mixer control** because it's the highest-value, lowest-risk feature set with comprehensive API support
- **Add routing/EQ second** to complete professional mixing capabilities while patterns are fresh
- **Playlist tracks third** since they follow similar patterns but have less urgency
- **Project settings last** as they're independent query features, not core workflow

This order:
- Delivers core value (mixing) fastest
- Groups related functionality (mixer phases 1-2, then playlist)
- Defers lowest-impact features (project queries)
- Surfaces API limitations early (no clip placement becomes obvious in Phase 3 research)
- Allows testing integration with existing v2.0 plugin control features

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (Routing):** Complex routing scenarios with submixes need hands-on testing to verify `afterRoutingChanged()` behavior and solo mode interactions
- **Phase 3 (Playlist):** Must validate 1-indexed iteration and confirm NO clip placement API before committing to feature scope

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Mixer Core):** Well-documented, follows existing state.py patterns, straightforward mutations
- **Phase 4 (Project):** Simple read-only queries, marker navigation is documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies needed; FL Studio Python API provides all functions via built-in modules |
| Features | HIGH | Mixer and playlist track control fully supported; clip placement and tempo setting confirmed NOT available |
| Architecture | HIGH | Extends proven v1.0/v2.0 bridge patterns; handler registration and SysEx codec already validated |
| Pitfalls | HIGH | Index confusion, pickup modes, routing UI updates, and API gaps all documented in official stubs with clear examples |

**Overall confidence:** HIGH

All research based on official FL Studio Python API stubs (authoritative source). The API limitations (no clip placement, no tempo setting) are definitively confirmed by absence in comprehensive API documentation, not speculation. Architecture patterns are proven in existing codebase.

### Gaps to Address

**During implementation:**
- **Solo mode behavior with complex routing** - Document which tracks play when soloing a submix or send bus. Test with real projects to verify mode parameters.
- **Time signature reading** - Investigate `general.getRecPPQ()` relationship to time signature or accept as "not readable" and default to 4/4 assumption.
- **Routing order dependencies** - Verify if `setRouteTo()` must be called before `setRouteToLevel()` or if they're independent (likely must create route first).
- **Mixer track volume dB conversion** - Consider adding utility to convert between linear (0.0-1.0) and dB values for better UX.
- **Large project response sizes** - Implement pagination for `get_mixer_tracks` when user has many tracks (existing chunked SysEx pattern applies).

**During user testing:**
- Natural language interpretation of "track 1" (user means first insert, FL index is 1, but must clarify Master is 0)
- Volume percentage interpretation ("50%" = 0.5 which is well below unity 0.8)
- Color specification (accept RGB in tools, convert to BGR internally)

## Sources

### Primary (HIGH confidence)
- [FL Studio Python API - Mixer Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/) - Complete mixer function reference
- [FL Studio Python API - Mixer Tracks](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/tracks/) - Volume, pan, mute, solo, routing functions with parameter specs
- [FL Studio Python API - Playlist Tracks](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/playlist/tracks/) - Playlist track management (confirms no clip placement API)
- [FL Studio Python API - Arrangement Markers](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/arrangement/markers/) - Marker navigation and auto-time markers
- [FL Studio Python API - General Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/) - Project info and undo functions
- [FL Studio Python API - Transport Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/) - Confirms no tempo setting function
- Existing codebase: `fl-bridge/handlers/state.py`, `fl-bridge/handlers/transport.py`, `fl-bridge/protocol/commands.py` - Proven architecture patterns

### Secondary (MEDIUM confidence)
- [FL MIDI 101 Guide](https://flmidi-101.readthedocs.io/en/latest/scripting/fl_midi_api.html) - Community documentation of API patterns
- [GitHub: flstudio-volume-converter](https://github.com/olyrhc/flstudio-volume-converter) - Volume dB conversion reference (confirms 0.8=unity)
- v2.0 ARCHITECTURE.md - Established bridge handler patterns, SysEx codec, command registration
- v2.0 PITFALLS.md - Known SysEx size limits, plugin index confusion patterns

### Tertiary (LOW confidence, needs validation)
- Time signature inference from PPQ and marker position math
- `general.processRECEvent()` potential workarounds for tempo/automation (not documented, speculative)
- Exact solo mode behavior with multi-level routing (needs hands-on testing)

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
