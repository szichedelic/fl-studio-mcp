# Feature Landscape: FL Studio MCP Server

**Domain:** DAW automation / AI music production assistant
**Last Updated:** 2026-02-25
**Current Milestone:** v2.1 Song Building and Mixing

---

## v2.1 Feature Research: Mixer, Playlist, and Project Controls

**Researched:** 2026-02-25
**Confidence:** HIGH (FL Studio Python API is well-documented via official stubs)

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

#### Mixer Control

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Get/Set track volume | Basic mixing operation | LOW | `mixer.setTrackVolume(index, volume, pickupMode)` - volume 0.0-1.0 |
| Get/Set track pan | Stereo positioning | LOW | `mixer.setTrackPan(index, pan, pickupMode)` - pan -1.0 to 1.0 |
| Mute/unmute tracks | Essential mixing workflow | LOW | `mixer.muteTrack(index, value)` - value: 1=mute, 0=unmute, -1=toggle |
| Solo tracks | Isolate for review | LOW | `mixer.soloTrack(index, value, mode)` - supports solo modes |
| Get mixer track info | Query current state | LOW | Already partially implemented in `state.mixer` |
| Set track name/color | Organization | LOW | `mixer.setTrackName(index, name)`, `mixer.setTrackColor(index, color)` |

#### Playlist/Arrangement Control

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Get playlist tracks | Query arrangement state | LOW | `playlist.trackCount()`, `playlist.getTrackName(index)` |
| Mute/solo playlist tracks | Arrangement workflow | LOW | `playlist.muteTrack(index)`, `playlist.soloTrack(index)` |
| Get/set track name/color | Organization | LOW | `playlist.setTrackName()`, `playlist.setTrackColor()` |
| Get track selection | Query selection state | LOW | `playlist.isTrackSelected(index)` |

#### Project-Level Controls

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Get current tempo | Query project state | LOW | `mixer.getCurrentTempo()` - already used in state.mixer |
| Get time position | Playback location | LOW | `transport.getSongPos()` - exists in transport module |
| Jump to marker | Navigate arrangement | LOW | `arrangement.jumpToMarker(delta, select)` |
| Get marker info | Query markers | LOW | `arrangement.getMarkerName(index)` |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

#### Mixer Control

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Track routing (sends) | Create effect buses, parallel processing | MEDIUM | `mixer.setRouteTo(index, destIndex, value)` + `setRouteToLevel()` |
| Stereo separation | Width control | LOW | `mixer.setTrackStereoSep(index, value, pickupMode)` |
| Arm for recording | Recording workflow | LOW | `mixer.armTrack(index)` |
| Focus plugin editor | Quick access to effect UI | LOW | `mixer.focusEditor(index, plugIndex)` - opens effect window |
| Enable/disable track slots | Bypass all effects on track | LOW | `mixer.enableTrackSlots(index, value)` |
| Track peak monitoring | Visual feedback via natural language | MEDIUM | `mixer.getTrackPeaks(index, mode)` |

#### Playlist/Arrangement Control

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Performance mode clips | Live performance workflow | MEDIUM | `playlist.triggerLiveClip(index, subNum, flags, velocity)` |
| Add time markers | Song structure organization | LOW | `arrangement.addAutoTimeMarker(time, name)` |
| Select all/deselect tracks | Bulk operations | LOW | `playlist.selectAll()`, `playlist.deselectAll()` |
| Track mute lock | Prevent accidental changes | LOW | `playlist.muteTrackLock(index)` |

#### Project-Level Controls

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Undo/redo operations | Safety net for experiments | LOW | `general` module has undo capabilities |
| Get project timebase (PPQ) | Timing precision | LOW | `general.getRecPPQ()` - useful for tick calculations |

#### Compound/Workflow Features

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Natural language mixing commands | "Make the drums louder and pan guitar left" | MEDIUM | Combines multiple API calls |
| Quick mix snapshot | "What's the current mix balance?" | LOW | Query all track volumes/pans |
| Routing templates | "Set up a reverb bus" | MEDIUM | Chains setRouteTo + setRouteToLevel |
| Section navigation | "Go to the chorus" | LOW | jumpToMarker with marker name lookup |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Programmatic clip placement | "Add pattern at bar 4" | **No API exists** - playlist module has no addClip/addItem function | User places clips manually; tools control which patterns exist |
| Automated mixing/mastering | "Mix my song automatically" | Removes creative control; mixing is artistic | Provide controls, let user direct the mix |
| Real-time automation curves | "Automate filter over 8 bars" | Would require per-tick updates; complex | User records automation manually; provide starting points |
| Full project creation | "Make me a full song" | Removes creative ownership; every decision is opinionated | Help build pieces, user assembles |
| Tempo automation | "Set tempo to ramp from 120 to 140" | **No setTempo API found** - tempo is read-only in scripting | User changes tempo manually |
| Time signature changes | "Set time signature to 3/4" | **No API found** for programmatic time signature | Project-level settings done manually |
| Arrangement creation from scratch | "Create verse-chorus-verse structure" | No clip placement API; arrangement is manual | Create patterns, name them logically, user arranges |
| Plugin preset recall per track | "Load OTT on the bass bus" | Plugin loading not available via API | User loads plugins; we control parameters once loaded |

### Feature Dependencies (v2.1)

```
[Mixer Control]
    |
    +-- mixer.setRouteTo() requires track indices
    |       |
    |       +-- setRouteToLevel() requires route to exist first
    |
    +-- mixer.focusEditor() requires knowing slot index
            |
            +-- Benefits from plugin_scan (Phase 4) for slot info

[Playlist Control]
    |
    +-- playlist.muteTrack() independent
    +-- playlist.soloTrack() independent
    +-- playlist.getTrackName() independent

[Project Control]
    |
    +-- arrangement.jumpToMarker() independent
    +-- arrangement.addAutoTimeMarker() requires time in ticks
            |
            +-- transport.getSongPos() provides current position

[Cross-dependencies]
    |
    +-- Existing transport tools (play, stop) enable testing
    +-- Existing pattern tools enable creating content to mix
    +-- Existing plugin tools (Phase 4) provide effect control once routed
```

#### Dependency Notes

- **Routing requires two calls:** Must create route with `setRouteTo()` before `setRouteToLevel()` works
- **Marker functions are independent:** No setup required, can add/jump immediately
- **Mixer control enhances existing workflow:** Once patterns/channels exist, mixer control adds value
- **No playlist-pattern link:** Cannot programmatically place patterns in playlist; this is a hard limitation

### MVP Definition (v2.1)

#### Launch With (v2.1 Core)

Minimum viable milestone - what's needed to validate mixer/arrangement control.

- [ ] **Mixer: get_mixer_track** - Get individual track state (volume, pan, mute, solo)
- [ ] **Mixer: set_mixer_volume** - Set track volume by index or name
- [ ] **Mixer: set_mixer_pan** - Set track pan by index or name
- [ ] **Mixer: mute_mixer_track** - Mute/unmute/toggle track
- [ ] **Mixer: solo_mixer_track** - Solo/unsolo/toggle track
- [ ] **Playlist: get_playlist_tracks** - Get all playlist track info
- [ ] **Playlist: mute_playlist_track** - Mute/unmute playlist tracks
- [ ] **Project: get_tempo** - Get current tempo (already exists in mixer info)
- [ ] **Project: get_position** - Get current playback position

#### Add After Validation (v2.1.x)

Features to add once core mixing is working.

- [ ] **Mixer: set_track_route** - Create send to bus track (trigger: user asks for parallel processing)
- [ ] **Mixer: set_route_level** - Set send amount (trigger: after routing is used)
- [ ] **Playlist: solo_playlist_track** - Solo playlist tracks (trigger: arrangement review workflow)
- [ ] **Project: add_marker** - Add named time marker (trigger: user wants to mark sections)
- [ ] **Project: jump_to_marker** - Navigate to marker by name (trigger: section navigation)
- [ ] **Mixer: rename_track** - Set mixer track name (trigger: organization workflow)

#### Future Consideration (v2.2+)

Features to defer until core mixing is validated.

- [ ] **Performance mode** - Trigger live clips (niche use case, complex)
- [ ] **Bulk operations** - Select all, batch mute (wait for usage patterns)
- [ ] **Track grouping** - Group tracks for linked control (complex, wait for demand)
- [ ] **Peak monitoring** - Real-time level reporting (requires polling strategy)

### Feature Prioritization Matrix (v2.1)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| set_mixer_volume | HIGH | LOW | P1 |
| set_mixer_pan | HIGH | LOW | P1 |
| mute_mixer_track | HIGH | LOW | P1 |
| solo_mixer_track | HIGH | LOW | P1 |
| get_playlist_tracks | MEDIUM | LOW | P1 |
| mute_playlist_track | MEDIUM | LOW | P1 |
| set_track_route | MEDIUM | MEDIUM | P2 |
| set_route_level | MEDIUM | MEDIUM | P2 |
| add_marker | MEDIUM | LOW | P2 |
| jump_to_marker | MEDIUM | LOW | P2 |
| rename_mixer_track | LOW | LOW | P2 |
| solo_playlist_track | MEDIUM | LOW | P2 |
| performance_mode | LOW | HIGH | P3 |
| peak_monitoring | LOW | MEDIUM | P3 |
| track_grouping | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.1 launch
- P2: Should have, add when P1 complete
- P3: Nice to have, future consideration

### Competitor Feature Analysis

| Feature | Ableton Remote Scripts | Reaper ReaScript | Our Approach (FL Studio MCP) |
|---------|------------------------|------------------|------------------------------|
| Mixer volume/pan | Full control | Full control | Full control via Python API |
| Track routing | Full control | Full control | API available (`setRouteTo`) |
| Clip placement | Session View clips | Full control | **No API** - user manual |
| Tempo control | Read/write | Read/write | **Read only** |
| Markers | Limited | Full control | Add and jump supported |
| Automation | Full control | Full control | **No API** - manual recording |

#### Key Competitive Gap

**FL Studio's MIDI scripting API lacks clip/playlist arrangement control.** This is a fundamental limitation - patterns can be created and selected, but cannot be programmatically placed on the timeline. This shapes our feature set: we enable mixing and navigation, but arrangement remains user-controlled.

### API Availability Summary (v2.1)

#### Confirmed Available

| Function | Module | Purpose |
|----------|--------|---------|
| `setTrackVolume(index, volume, pickupMode)` | mixer | Set track volume |
| `setTrackPan(index, pan, pickupMode)` | mixer | Set track pan |
| `muteTrack(index, value)` | mixer | Mute/unmute track |
| `soloTrack(index, value, mode)` | mixer | Solo track |
| `setRouteTo(index, destIndex, value)` | mixer | Create/remove routing |
| `setRouteToLevel(index, destIndex, level)` | mixer | Set send level |
| `setTrackName(index, name)` | mixer | Rename track |
| `setTrackColor(index, color)` | mixer | Set track color |
| `setTrackStereoSep(index, value, pickupMode)` | mixer | Stereo width |
| `armTrack(index)` | mixer | Toggle recording arm |
| `focusEditor(index, plugIndex)` | mixer | Open effect editor |
| `enableTrackSlots(index, value)` | mixer | Bypass all effects |
| `muteTrack(index, value)` | playlist | Mute playlist track |
| `soloTrack(index, value, inGroup)` | playlist | Solo playlist track |
| `setTrackName(index, name)` | playlist | Rename playlist track |
| `setTrackColor(index, color)` | playlist | Set track color |
| `selectTrack(index)` | playlist | Toggle track selection |
| `selectAll()` / `deselectAll()` | playlist | Bulk selection |
| `jumpToMarker(delta, select)` | arrangement | Navigate markers |
| `getMarkerName(index)` | arrangement | Get marker name |
| `addAutoTimeMarker(time, name)` | arrangement | Add marker |
| `getCurrentTempo(asInt)` | mixer | Get tempo |
| `getSongPos()` | transport | Get playback position |

#### Confirmed NOT Available

| Capability | Module | Impact |
|------------|--------|--------|
| Add clip to playlist | playlist | Cannot automate arrangement |
| Set tempo programmatically | general/mixer | Tempo is read-only |
| Set time signature | general | Project setting only |
| Add automation points | - | No API for automation |
| Load plugins to slots | mixer | User must load manually |

### Sources (v2.1)

#### Official Documentation (HIGH confidence)
- [FL Studio Python API - Mixer Tracks](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/mixer/tracks/)
- [FL Studio Python API - Playlist Tracks](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/playlist/tracks/)
- [FL Studio Python API - Arrangement Markers](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/arrangement/markers/)
- [FL Studio MIDI Scripting Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm)

#### Community Documentation (MEDIUM confidence)
- [FL Studio MIDI Scripting 101](https://flmidi-101.readthedocs.io/en/latest/scripting/fl_midi_api.html)
- [GitHub: FL-Studio-API-Stubs](https://github.com/IL-Group/FL-Studio-API-Stubs)

#### Comparative Analysis (MEDIUM confidence)
- [Reaper vs Ableton API Comparison](https://www.musicianwave.com/ableton-live-vs-reaper/)
- [Mix Automation in DAWs](https://www.soundonsound.com/techniques/creative-mix-automation-your-daw)

---

## v2.0 Feature Research: Production Pipeline (SHIPPED 2026-02-25)

**Researched:** 2026-02-23
**Confidence:** MEDIUM (verified with FL Studio API docs, product documentation, and cross-referenced production guides)

**Scope:** This section covers features for the v2.0 milestone. For current milestone, see v2.1 section above.

<details>
<summary>Click to expand v2.0 Feature Research</summary>

### Table Stakes (v2.0)

Features that MUST exist for the v2.0 milestone to deliver value. Without these, the production pipeline is incomplete.

#### Humanization

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Timing offset (push/pull)** | Core of humanization; without timing variation notes sound robotic | Medium | Existing note generation (v1.0) | Offsets of 5-20ms typical; Gaussian distribution for natural feel; HumBeat 2 uses +-20ms max |
| **Velocity variation** | Every humanization tool provides this; second most impactful parameter | Medium | Existing note generation (v1.0) | Different curves per instrument type: drums need accent patterns, piano needs dynamic range, bass stays more consistent |
| **Swing/groove** | Foundational rhythm technique; every DAW has swing built-in | Medium | Timing offset engine | 50% = straight, 54-63% = typical swing range; pushes every other subdivision later by 20-30 ticks |
| **Note length variation** | Real players vary articulation; staccato vs legato is expressive | Low | Existing note generation (v1.0) | Trim some notes to ~67% of grid, let others ring to ~110%; instrument-dependent |
| **Per-instrument profiles** | Drums, piano, bass, and synths humanize differently; one-size-fits-all sounds wrong | Medium | All above humanization features | Drums: tight kick (+-3ms), loose hats (+-10-15ms), ghost notes at vel 35-50. Piano: natural velocity variance 75-115. Bass: conservative timing (+-5ms), consistent velocity |

#### Plugin Parameter Control

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Parameter discovery** | Must enumerate what parameters a plugin has before controlling them | Medium | FL Bridge (v1.0) | `plugins.getParamCount()` returns up to 4240 params for VSTs (4096 + 128 MIDI CC + 16 aftertouch); `plugins.getParamName()` for labels |
| **Parameter get/set** | Basic read/write of plugin parameters | Medium | Parameter discovery | `plugins.setParamValue(value, paramIndex, channelIndex)` where value is 0.0-1.0 normalized; `plugins.getParamValue()` to read back |
| **Parameter name-based resolution** | VST param indices are positional, not stable; need name lookup | Medium | Parameter discovery | Build name->index map at discovery time; cache per plugin instance; re-discover on plugin change |

#### Audio Rendering

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Pattern render to WAV** | Core resampling workflow starts here; needed before any sample manipulation | High | FL Bridge (v1.0), pattern exists with notes | FL Studio GUI: right-click pattern -> "Render as audio clip". No direct Python API for rendering found. Ctrl+Alt+C consolidates. May need to use `ui` module to trigger menu actions or keyboard shortcuts |
| **Render with/without mixer FX** | Users need both: dry render for resampling, wet render for final audio | Medium | Pattern render | "Render as audio clip" = dry (no mixer effects); "Consolidate" (Ctrl+Alt+C) = offers dialog with options for FX inclusion |

#### Sample Manipulation

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Pitch shift (semitones)** | Fundamental sample manipulation; pitch down for dark textures, pitch up for bright | Medium | Audio rendering (need a WAV to manipulate) | `channels.setChannelPitch(index, value, mode)` -- mode 0: factor of range, mode 1: cents offset, mode 2: semitone range. WARNING: mode 2 is documented as broken |
| **Detune (cents)** | Creates width, thickness, and chorus-like effects; standard production technique | Low | Pitch shift infrastructure | +-5 to +-15 cents is the standard range; `channels.setChannelPitch(index, cents, mode=1)` should work |
| **Load sample into channel** | Must get rendered WAV back into the channel rack for further manipulation | High | Audio rendering | Not clearly exposed in MIDI scripting API. May need to use `ui` module to trigger file browser, or leverage "Render as audio clip" which auto-loads. NEEDS VALIDATION |

### Differentiators (v2.0)

Features that go beyond what basic tools offer.

#### Advanced Humanization

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Context-aware timing** | Fast rolls stay tight (3-8ms), slow grooves breathe (10-20ms) -- like HumBeat 2's intelligent engine | High | Basic timing offsets | Analyze note density per beat region; tighter offsets for dense passages, wider for sparse |
| **Beat position awareness** | Downbeats more stable, offbeats more loose -- how real players feel time | Medium | Basic timing offsets | Downbeat: +-3ms, backbeat: +-5ms, offbeat 16ths: +-10-15ms |
| **Groove templates** | Apply feel from classic drum machines (MPC, 808, SP-1200) or genres | High | Swing engine, beat position awareness | Pre-built timing/velocity maps |
| **Humanization presets** | "Tight drummer", "Loose jazz", "Lo-fi" -- one-word application | Low | All humanization features built | Combine all parameters into named profiles |

#### Serum 2 Sound Design

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Oscillator control** | Set wavetable position, oscillator type, unison voices, detune | High | Plugin parameter control | Serum 2 has 3 primary oscillators, 5 synthesis modes each |
| **Filter control** | Cutoff, resonance, drive, filter type | Medium | Plugin parameter control | State variable filter with morphing |
| **Macro mapping awareness** | Know what macros 1-8 control, set them for broad sound changes | Medium | Plugin parameter control | Common macro assignments mapped |
| **Effects chain control** | Reverb, delay, distortion, chorus, EQ | Medium | Plugin parameter control | Built-in effects shaping |
| **Preset loading** | Browse and load from Serum 2's 626+ included presets | Low | Plugin parameter control | `plugins.nextPreset()` / `plugins.prevPreset()` |
| **Sound type recipes** | "Warm pad", "aggressive bass", "pluck lead" | Medium | All Serum 2 controls | Parameter combos that produce specific sound types |

#### Advanced Sample Manipulation

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Reverse** | Atmospheric pads, transition effects, reverse cymbal swells | Medium | Audio rendering, sample loading | API path validated with SoX CLI |
| **Time stretch** | Change duration without changing pitch; fit samples to tempo | Medium | Sample loading | Implemented via SoX CLI |
| **Layering with processing** | Duplicate sample, detune one +7 cents left / -7 cents right for stereo width | Medium | Pitch shift, detune, channel creation | Standard "super stereo" technique |
| **Resampling workflow** | Full loop: create notes -> render to WAV -> load as sample -> manipulate -> render again | Very High | All above | The killer workflow |

### Anti-Features (v2.0)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **"Perfect" humanization from ML models** | Training data requirements are massive; model serving adds complexity | Use algorithmic humanization with Gaussian distributions |
| **Full Serum 2 preset editor UI** | Enormous scope; user has Serum 2's own UI | Expose parameter control through natural language |
| **Edison scripting for DSP** | Edison's Python DSP API is sample-level | Use SoX CLI for audio processing |
| **Real-time audio streaming** | MIDI SysEx is not designed for audio data | Render to file, manipulate file, load file |
| **Automatic genre detection** | Fragile and presumptuous | Let user specify feel |
| **Mixing/mastering in this milestone** | Stay focused on creation pipeline | Defer to v2.1 |

### Sources (v2.0)

#### Official Documentation (HIGH confidence)
- [FL Studio Python API - Plugins Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/)
- [FL Studio Python API - Channels Properties](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/properties/)
- [Serum 2 Official Product Page](https://xferrecords.com/products/serum-2)

#### Product Research (MEDIUM confidence)
- [HumBeat 2 Drum Humanizer](https://developdevice.com/products/humbeat-2-0-the-ultimate-midi-drum-humanizer)
- [Serum 2 Advanced Features (Splice)](https://splice.com/blog/serum-2-advanced-features/)

</details>

---
*Feature research for: FL Studio MCP Server*
*Last updated: 2026-02-25 (v2.1 Mixer/Playlist/Project)*
