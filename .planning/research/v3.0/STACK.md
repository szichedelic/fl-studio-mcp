# Stack Research: Mixer, Playlist, and Project Controls

**Project:** FL Studio MCP Server - v3.0 Milestone
**Scope:** Mixer control, playlist/arrangement, project-level settings (tempo, markers)
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

The v3.0 milestone requires **no new npm dependencies**. All capabilities are provided by FL Studio's built-in Python API modules (`mixer`, `playlist`, `arrangement`, `transport`, `general`), which are already available in the FL Bridge environment. The existing architecture (SysEx-over-MIDI + FL Bridge handlers) fully supports these new features.

Key findings:
1. **Mixer module** provides comprehensive track control: volume, pan, mute, solo, routing, EQ, effects slots
2. **Playlist module** provides track management and live performance clip triggering
3. **Arrangement module** provides marker control and time selection
4. **Transport/mixer modules** provide tempo access (read via `mixer.getCurrentTempo()`)
5. **Critical gap**: No API function to **set** tempo programmatically; tempo is read-only

---

## Existing Stack (Unchanged)

The following are already validated and working. No modifications needed.

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 24.x (fnm) | Runtime |
| TypeScript | 5.9.x | Language |
| @modelcontextprotocol/sdk | 1.26.x | MCP implementation |
| zod | 3.25.x | Schema validation |
| tonal | 6.4.x | Music theory |
| midi (npm) | 2.0.x | MIDI SysEx communication |
| FL Bridge (Python) | 3.9-3.11 | FL Studio MIDI controller script |
| loopMIDI | Latest | Virtual MIDI port |
| simplex-noise | 4.0.x | Humanization noise |
| chokidar | 4.0.x | File watching |

---

## FL Studio Python API: Relevant Modules

### mixer Module

The `mixer` module provides full control over FL Studio's mixer. **Track 0 is always Master.** All functions verified against [official API stubs](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/).

#### Track Volume and Pan

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getTrackVolume` | `(index: int, mode: int = 0) -> float` | Read volume (0.0-1.0) | HIGH |
| `setTrackVolume` | `(index: int, volume: float, pickupMode: int = 0) -> None` | Set volume (0.0-1.0) | HIGH |
| `getTrackPan` | `(index: int) -> float` | Read pan (-1.0 left to 1.0 right) | HIGH |
| `setTrackPan` | `(index: int, pan: float, pickupMode: int = 0) -> None` | Set pan | HIGH |
| `getTrackStereoSep` | `(index: int) -> float` | Read stereo separation | HIGH |
| `setTrackStereoSep` | `(index: int, sep: float, pickupMode: int = 0) -> None` | Set stereo separation | HIGH |

#### Mute and Solo

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `isTrackMuted` | `(index: int) -> bool` | Check if muted | HIGH |
| `muteTrack` | `(index: int, value: int = -1) -> None` | Toggle or set mute state | HIGH |
| `isTrackMuteLock` | `(index: int) -> bool` | Check if mute is locked | HIGH |
| `isTrackSolo` | `(index: int) -> bool` | Check if soloed | HIGH |
| `soloTrack` | `(index: int, value: int = -1, mode: int = -1) -> None` | Toggle or set solo | HIGH |
| `isTrackEnabled` | `(index: int) -> bool` | Check if track is enabled | HIGH |
| `enableTrack` | `(index: int) -> None` | Toggle enabled state | HIGH |

#### Track Properties

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `trackCount` | `() -> int` | Get number of mixer tracks | HIGH |
| `getTrackName` | `(index: int) -> str` | Get track name | HIGH |
| `setTrackName` | `(index: int, name: str) -> None` | Set track name | HIGH |
| `getTrackColor` | `(index: int) -> int` | Get track color (0x--BBGGRR) | HIGH |
| `setTrackColor` | `(index: int, color: int) -> None` | Set track color | HIGH |
| `getTrackPeaks` | `(index: int, mode: int) -> float` | Get audio peak level | HIGH |

#### Recording and Arm

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `isTrackArmed` | `(index: int) -> bool` | Check if armed for recording | HIGH |
| `armTrack` | `(index: int) -> None` | Toggle arm state | HIGH |
| `getTrackRecordingFileName` | `(index: int) -> str` | Get recording file name | HIGH |

#### Routing

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `setRouteTo` | `(index: int, destIndex: int, value: bool, updateUI: bool = False) -> None` | Create/remove route | HIGH |
| `getRouteSendActive` | `(index: int, destIndex: int) -> bool` | Check if route exists | HIGH |
| `setRouteToLevel` | `(index: int, destIndex: int, level: float) -> None` | Set send level (API v36+) | HIGH |
| `getRouteToLevel` | `(index: int, destIndex: int) -> float` | Get send level (API v36+) | HIGH |
| `afterRoutingChanged` | `() -> None` | Notify FL of routing changes | HIGH |
| `linkChannelToTrack` | `(channel: int, track: int, select: bool = False) -> None` | Link channel to mixer track | HIGH |

#### EQ (Built-in Parametric EQ)

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getEqBandCount` | `() -> int` | Number of EQ bands | HIGH |
| `getEqGain` | `(index: int, band: int, mode: int = 0) -> float` | Get band gain | HIGH |
| `setEqGain` | `(index: int, band: int, value: float) -> None` | Set band gain | HIGH |
| `getEqFrequency` | `(index: int, band: int, mode: int = 0) -> float` | Get band frequency | HIGH |
| `setEqFrequency` | `(index: int, band: int, value: float) -> None` | Set band frequency | HIGH |
| `getEqBandwidth` | `(index: int, band: int) -> float` | Get band Q/width | HIGH |
| `setEqBandwidth` | `(index: int, band: int, value: float) -> None` | Set band Q/width | HIGH |

#### Effects Slots

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `isTrackSlotsEnabled` | `(index: int) -> bool` | Check if FX slots enabled | HIGH |
| `enableTrackSlots` | `(index: int, value: bool = False) -> None` | Toggle FX slots on/off | HIGH |
| `getSlotColor` | `(index: int, slot: int) -> int` | Get FX slot color | HIGH |
| `setSlotColor` | `(index: int, slot: int, color: int) -> None` | Set FX slot color | HIGH |
| `focusEditor` | `(index: int, plugIndex: int) -> None` | Open effect plugin editor | HIGH |
| `getActiveEffectIndex` | `() -> tuple[int, int] | None` | Get active effect (track, slot) | HIGH |
| `isTrackPluginValid` | `(index: int, slot: int) -> bool` | Check if plugin in slot | HIGH |
| `getTrackPluginId` | `(index: int, slot: int) -> int` | Get plugin ID at slot | HIGH |

#### Tempo and Time

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getCurrentTempo` | `(asInt: bool = False) -> int | float` | Get current project tempo | HIGH |
| `getSongStepPos` | `() -> int` | Get position in steps | HIGH |
| `getSongTickPos` | `(mode: int = 0) -> int | float` | Get position in ticks | HIGH |
| `getRecPPS` | `() -> int` | Get recording PPS | HIGH |
| `getLastPeakVol` | `(section: int) -> float` | Get peak volume (0=left, 1=right) | HIGH |

#### Selection

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `trackNumber` | `() -> int` | Get first selected track index | HIGH |
| `setTrackNumber` | `(trackNumber: int, flags: int = 0) -> None` | Select a track | HIGH |
| `isTrackSelected` | `(index: int) -> bool` | Check if track selected | HIGH |
| `selectTrack` | `(index: int) -> None` | Toggle track selection | HIGH |
| `selectAll` | `() -> None` | Select all tracks | HIGH |
| `deselectAll` | `() -> None` | Deselect all tracks | HIGH |
| `setActiveTrack` | `(index: int) -> None` | Exclusively select track | HIGH |

---

### playlist Module

The `playlist` module controls playlist tracks and live performance mode. **Tracks are 1-indexed** (not 0-indexed like mixer).

#### Track Management

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `trackCount` | `() -> int` | Get number of playlist tracks | HIGH |
| `getTrackName` | `(index: int) -> str` | Get track name | HIGH |
| `setTrackName` | `(index: int, name: str) -> None` | Set track name | HIGH |
| `getTrackColor` | `(index: int) -> int` | Get track color | HIGH |
| `setTrackColor` | `(index: int, color: int) -> None` | Set track color | HIGH |
| `isTrackMuted` | `(index: int) -> bool` | Check if muted | HIGH |
| `muteTrack` | `(index: int, value: int) -> None` | Set mute state | HIGH |
| `isTrackMuteLock` | `(index: int) -> bool` | Check mute lock | HIGH |
| `muteTrackLock` | `(index: int, value: int) -> None` | Lock/unlock mute | HIGH |
| `isTrackSolo` | `(index: int) -> bool` | Check if soloed | HIGH |
| `soloTrack` | `(index: int, value: int) -> None` | Set solo state | HIGH |
| `isTrackSelected` | `(index: int) -> bool` | Check if selected | HIGH |
| `selectTrack` | `(index: int, value: int) -> None` | Set selection | HIGH |
| `selectAll` | `() -> None` | Select all tracks | HIGH |
| `deselectAll` | `() -> None` | Deselect all | HIGH |

#### Activity Monitoring

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getTrackActivityLevel` | `(index: int) -> float` | Get track activity level | HIGH |
| `getTrackActivityLevelVis` | `(index: int) -> float` | Get visual activity level | HIGH |

#### Live Performance Mode

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getLiveLoopMode` | `() -> int` | Get loop mode | HIGH |
| `incLiveLoopMode` | `() -> None` | Cycle loop mode | HIGH |
| `getLiveTriggerMode` | `() -> int` | Get trigger mode | HIGH |
| `incLiveTrigMode` | `() -> None` | Cycle trigger mode | HIGH |
| `getLivePosSnap` | `() -> int` | Get position snap | HIGH |
| `incLivePosSnap` | `() -> None` | Cycle position snap | HIGH |
| `getLiveTrigSnap` | `() -> int` | Get trigger snap | HIGH |
| `incLiveTrigSnap` | `() -> None` | Cycle trigger snap | HIGH |
| `getLiveStatus` | `(index: int, mode: int) -> int` | Get clip status | HIGH |
| `getLiveBlockStatus` | `(index: int, mode: int) -> int` | Get block status | HIGH |
| `getLiveBlockColor` | `(index: int, mode: int) -> int` | Get block color | HIGH |
| `triggerLiveClip` | `(index: int, subIndex: int, flags: int) -> None` | Trigger clip | HIGH |
| `refreshLiveClips` | `() -> None` | Refresh clip states | HIGH |
| `getPerformanceModeState` | `() -> int` | Get performance mode state | HIGH |

#### Time Display

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getVisTimeBar` | `() -> int` | Get visible bar position | HIGH |
| `getVisTimeTick` | `() -> int` | Get visible tick position | HIGH |
| `getVisTimeStep` | `() -> int` | Get visible step position | HIGH |
| `scrollTo` | `(time: int, track: int) -> None` | Scroll to position | HIGH |

---

### arrangement Module

The `arrangement` module handles markers, selections, and time positions.

#### Markers

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `jumpToMarker` | `(delta: int, select: bool) -> None` | Jump to marker (relative) | HIGH |
| `getMarkerName` | `(index: int) -> str` | Get marker name (absolute) | HIGH |
| `addAutoTimeMarker` | `(time: int, name: str) -> None` | Add time marker | HIGH |

#### Selection

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `selectionStart` | `() -> int` | Get selection start time | HIGH |
| `selectionEnd` | `() -> int` | Get selection end time | HIGH |
| `liveSelection` | `(time: int, stop: bool) -> None` | Set live selection point | HIGH |
| `liveSelectionStart` | `() -> int` | Get live selection start | HIGH |

#### Time

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `currentTime` | `(snap: int) -> int` | Get current time in ticks | HIGH |
| `currentTimeHint` | `(mode: int, time: int, setRecPPB: int = 0, isLength: int = 0) -> str` | Get formatted time string "Bar:Step:Tick" | HIGH |

---

### transport Module

The `transport` module handles playback, recording, and navigation.

#### Playback

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `start` | `() -> None` | Start/pause playback | HIGH |
| `stop` | `() -> None` | Stop playback | HIGH |
| `isPlaying` | `() -> bool` | Check if playing | HIGH |
| `record` | `() -> None` | Toggle recording | HIGH |
| `isRecording` | `() -> bool` | Check if recording | HIGH |

#### Position

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getSongPos` | `(mode: int = -1) -> float | int` | Get playback position | HIGH |
| `setSongPos` | `(position: float | int, mode: int = -1) -> None` | Set playback position | HIGH |
| `getSongLength` | `(mode: int) -> int` | Get song length | HIGH |
| `getSongPosHint` | `() -> str` | Get position as "bars:steps:ticks" | HIGH |

#### Loop Mode

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getLoopMode` | `() -> int` | Get loop mode (0=Pattern, 1=Song) | HIGH |
| `setLoopMode` | `() -> None` | Toggle loop mode | HIGH |

#### Navigation

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `markerJumpJog` | `(value: int, flags: int = 0) -> None` | Jump to marker by delta | HIGH |
| `markerSelJog` | `(value: int, flags: int = 0) -> None` | Select marker by delta | HIGH |
| `rewind` | `(startStop: int, flags: int = 0) -> None` | Rewind playback | HIGH |
| `fastForward` | `(startStop: int, flags: int = 0) -> None` | Fast-forward playback | HIGH |

#### Speed

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `setPlaybackSpeed` | `(speedMultiplier: float) -> None` | Set speed (0.25-4.0) | HIGH |

---

### general Module

The `general` module provides project-level settings and undo functionality.

#### Project State

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `getRecPPQ` | `() -> int` | Get project PPQN (pulses per quarter note) | HIGH |
| `getRecPPB` | `() -> int` | Get PPB (timebase x numerator) | HIGH |
| `getUseMetronome` | `() -> bool` | Check if metronome enabled | HIGH |
| `getPrecount` | `() -> int` | Get precount bars | HIGH |
| `getChangedFlag` | `() -> bool` | Check if project has unsaved changes | HIGH |
| `getVersion` | `() -> int` | Get FL Studio API version | HIGH |
| `safeToEdit` | `() -> bool` | Check if safe to make edits | HIGH |

#### Undo System

| Function | Signature | Purpose | Confidence |
|----------|-----------|---------|------------|
| `saveUndo` | `(undoName: str, flags: int = 0) -> None` | Create undo point | HIGH |
| `undo` | `() -> None` | Perform undo | HIGH |
| `undoUp` | `() -> int` | Navigate undo history up | HIGH |
| `undoDown` | `() -> int` | Navigate undo history down | HIGH |
| `undoUpDown` | `(value: int) -> int` | Navigate undo history | HIGH |
| `restoreUndo` | `() -> None` | Restore undo state | HIGH |
| `getUndoLevelHint` | `() -> str` | Get current undo level description | HIGH |
| `getUndoHistoryPos` | `() -> int` | Get undo history position | HIGH |
| `getUndoHistoryCount` | `() -> int` | Get undo history count | HIGH |

---

## API Gaps and Limitations

### Critical: No Tempo Setter

**Finding:** `mixer.getCurrentTempo()` exists to READ tempo, but there is **NO `setTempo()` or `setBPM()` function** in any module.

**Verification:** Searched official API stubs, Image-Line manual, and community documentation. No programmatic tempo setter exists.

**Impact:** Cannot automate tempo changes. Tempo must be set manually by the user or remain at project default.

**Workaround options:**
1. **Inform user**: Return current tempo, instruct user to change manually
2. **Use automation**: Could potentially write tempo automation data (complex, not recommended)
3. **Accept limitation**: For many workflows, reading tempo is sufficient

**Confidence:** HIGH - This is a confirmed FL Studio API limitation.

### No Time Signature Setter

**Finding:** `general.getRecPPB()` returns pulses per beat (timebase x numerator), but there are NO `setNumerator()` or `setDenominator()` functions despite being mentioned in older documentation.

**Note:** The Image-Line manual mentions `setNumerator()` and `setDenominator()`, but these functions do NOT appear in the official API stubs. They may be deprecated or incorrectly documented.

**Confidence:** MEDIUM - Needs runtime verification.

### No Clip Placement API

**Finding:** The playlist module controls playlist TRACKS (mute, solo, color) but provides NO functions to:
- Create or delete clips
- Move clips on the timeline
- Get clip positions or lengths
- Access clip contents

**Impact:** Cannot automate arrangement editing (placing patterns on playlist).

**Confidence:** HIGH - API stubs confirm no clip manipulation functions.

### No Effects Loading API

**Finding:** The mixer module can:
- Check if a plugin exists at a slot (`isTrackPluginValid`)
- Get plugin info (`getTrackPluginId`)
- Control existing plugin parameters (via `plugins` module)

But there is NO function to:
- Load a plugin into an empty slot
- Remove a plugin from a slot
- Reorder effects in a chain

**Impact:** Effects must be loaded manually. We can only control what's already loaded.

**Confidence:** HIGH - API stubs confirm no plugin loading functions.

---

## New Stack Additions: None Required

**No new npm packages needed.** All required functionality is provided by:

1. **FL Studio Python modules**: `mixer`, `playlist`, `arrangement`, `transport`, `general`
2. **Existing FL Bridge**: Already imports `mixer` (unused), just need to add handlers
3. **Existing MCP server**: Tool registration pattern is established

### Changes to FL Bridge

The FL Bridge main script (`device_FLBridge.py`) already imports the `mixer` module:

```python
import mixer as _mixer
mixer = _mixer
```

New handler files needed:
- `handlers/mixer.py` - Mixer control handlers
- `handlers/playlist.py` - Playlist track handlers
- `handlers/arrangement.py` - Marker and time handlers
- `handlers/project.py` - Tempo, undo, and project-level handlers

### Changes to MCP Server

New tool files needed:
- `src/tools/mixer.ts` - Mixer MCP tools
- `src/tools/playlist.ts` - Playlist MCP tools
- `src/tools/arrangement.ts` - Arrangement MCP tools
- `src/tools/project.ts` - Project-level MCP tools

---

## Recommended Tool Organization

### Mixer Tools (Priority: HIGH)

| Tool Name | FL Functions Used | Purpose |
|-----------|------------------|---------|
| `mixer_get_track_info` | `getTrackName`, `getTrackVolume`, `getTrackPan`, `isTrackMuted`, `isTrackSolo` | Read all track state |
| `mixer_set_volume` | `setTrackVolume` | Set track volume |
| `mixer_set_pan` | `setTrackPan` | Set track pan |
| `mixer_mute` | `muteTrack` | Mute/unmute track |
| `mixer_solo` | `soloTrack` | Solo/unsolo track |
| `mixer_route` | `setRouteTo`, `setRouteToLevel` | Configure routing |
| `mixer_set_eq` | `setEqGain`, `setEqFrequency`, `setEqBandwidth` | Adjust EQ bands |
| `mixer_list_tracks` | `trackCount`, `getTrackName` | List all mixer tracks |

### Playlist Tools (Priority: MEDIUM)

| Tool Name | FL Functions Used | Purpose |
|-----------|------------------|---------|
| `playlist_get_track_info` | `getTrackName`, `isTrackMuted`, `isTrackSolo` | Read track state |
| `playlist_mute` | `muteTrack` | Mute/unmute track |
| `playlist_solo` | `soloTrack` | Solo/unsolo track |
| `playlist_list_tracks` | `trackCount`, `getTrackName` | List all playlist tracks |

### Arrangement Tools (Priority: MEDIUM)

| Tool Name | FL Functions Used | Purpose |
|-----------|------------------|---------|
| `marker_add` | `addAutoTimeMarker` | Add a marker |
| `marker_jump` | `jumpToMarker` | Jump to marker |
| `marker_list` | `getMarkerName` (iterate) | List markers |
| `selection_get` | `selectionStart`, `selectionEnd` | Get current selection |

### Project Tools (Priority: HIGH)

| Tool Name | FL Functions Used | Purpose |
|-----------|------------------|---------|
| `project_get_info` | `getCurrentTempo`, `getRecPPQ`, `getSongLength` | Read project info |
| `project_undo` | `undo` | Undo last action |
| `project_save_undo` | `saveUndo` | Create undo checkpoint |
| `transport_set_position` | `setSongPos` | Set playback position |
| `transport_set_speed` | `setPlaybackSpeed` | Set playback speed multiplier |

---

## Version Compatibility

| Feature | Minimum API Version | Notes |
|---------|-------------------|-------|
| Core mixer functions | v1 | Available in all versions |
| `setRouteToLevel` | v36 | Send level control |
| `setTrackStereoSep` | v12 | Stereo separation |
| `isTrackSwapChannels` | v19 | Channel swap |
| `isTrackRevPolarity` | v19 | Polarity inversion |
| EQ functions | v35 | Built-in parametric EQ |
| `setActiveTrack` | v27 | Exclusive track selection |
| `linkChannelToTrack` | v23 | Channel-to-track linking |

Current FL Studio versions (24.x) support all these features.

---

## Sources

### Official Documentation (HIGH confidence)

- [FL Studio API - mixer module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/) - All mixer functions
- [FL Studio API - mixer/tracks](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/tracks/) - Track control functions
- [FL Studio API - mixer/eq](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/eq/) - EQ functions
- [FL Studio API - playlist module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/playlist/) - Playlist control
- [FL Studio API - arrangement module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/arrangement/) - Markers and time
- [FL Studio API - transport module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/) - Playback control
- [FL Studio API - general module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/) - Project settings
- [Image-Line Official Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm) - MIDI scripting reference

### Repository Reference

- [IL-Group/FL-Studio-API-Stubs](https://github.com/IL-Group/FL-Studio-API-Stubs) - Official stub repository

---

## Summary

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Mixer volume/pan control | SUPPORTED | `mixer.setTrackVolume`, `mixer.setTrackPan` |
| Mixer mute/solo | SUPPORTED | `mixer.muteTrack`, `mixer.soloTrack` |
| Mixer routing | SUPPORTED | `mixer.setRouteTo`, `mixer.setRouteToLevel` |
| Mixer EQ | SUPPORTED | `mixer.setEqGain/Frequency/Bandwidth` |
| Playlist track control | SUPPORTED | `playlist.muteTrack`, `playlist.soloTrack` |
| Markers | SUPPORTED | `arrangement.addAutoTimeMarker`, `arrangement.jumpToMarker` |
| Read tempo | SUPPORTED | `mixer.getCurrentTempo` |
| **Set tempo** | **NOT SUPPORTED** | No API function exists |
| **Set time signature** | **NOT SUPPORTED** | No API function exists |
| **Place clips** | **NOT SUPPORTED** | No API function exists |
| **Load effects** | **NOT SUPPORTED** | No API function exists |
| Undo/redo | SUPPORTED | `general.undo`, `general.saveUndo` |
| Playback position | SUPPORTED | `transport.setSongPos` |

**Net new dependencies: 0 npm packages, 0 system tools.**

---

*Stack research for: FL Studio MCP Server v3.0 - Mixer, Playlist, Project Controls*
*Researched: 2026-02-25*
