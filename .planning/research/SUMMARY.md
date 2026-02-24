# Project Research Summary

**Project:** FL Studio MCP Server — v2.0 Production Pipeline
**Domain:** DAW automation / AI music production assistant
**Researched:** 2026-02-23
**Confidence:** MEDIUM

## Executive Summary

The v2.0 Production Pipeline adds four capability areas to the existing FL Studio MCP architecture: humanization, plugin parameter control (targeting Serum 2), audio rendering, and sample manipulation. The recommended approach is to sequence these in risk order — lowest-risk first — because the three capability areas have a hard dependency chain: plugin control must be validated before Serum 2 can be built, and audio rendering must be resolved before sample manipulation can proceed. All four areas build on an existing, proven SysEx-over-MIDI bridge that works reliably for note generation and transport control.

The primary architectural finding that drives every phase decision is that humanization belongs entirely in Node.js as a pre-processing step on note data, not in FL Studio's Python environment. This means Phase 1 has zero new FL Studio API surface and can be built and tested in isolation. Plugin parameter control (Phase 2) is well-documented via the `plugins` module API stubs, but has known bugs (`getParamValue` unreliable for VSTs) that require shadow state as a mitigation. Audio rendering (Phase 4) is the hardest technical constraint in the entire milestone: FL Studio's Python API has no export function, no render function, and no modifier-key keyboard simulation. The practical solution is a guided workflow where the user presses Ctrl+R manually and the server watches for the resulting file via `chokidar`.

The biggest risk to scope is discovering during implementation that assumptions about Serum 2 parameter names are wrong, or that `plugins.setParamValue` is also broken for Serum 2. Both risks have mitigation strategies (runtime parameter enumeration, shadow state), but they should be treated as early spikes rather than assumed to work. The three capability areas are otherwise largely independent and can be planned as separate phases without blocking each other.

## Key Findings

### Recommended Stack

The existing stack (Node.js 24.x, TypeScript 5.9.x, `@modelcontextprotocol/sdk`, `zod`, `tonal`, `midi`, FL Bridge Python, loopMIDI) requires only three new runtime npm packages, one dev package, and one system tool. This is a minimal footprint for what the milestone delivers.

**Core technology additions:**
- `simplex-noise` ^4.0.3: Organic noise generation for humanization — TypeScript-native, zero dependencies, 20ns/sample, use 1D slices of 2D noise for smooth per-note variation curves
- `chokidar` ^4.0.0: File system watcher for detecting rendered WAV files — more reliable than `fs.watch()` across platforms
- `node-wav` ^0.0.2: WAV file decode/encode in Node.js — minimal, stable, has TypeScript types
- SoX 14.4.2+ (system CLI, not npm): Audio effects processing (pitch-shift, time-stretch, reverse, chop, layer) — battle-tested since 1991, handles all needed audio operations via `child_process.execFile`
- FL Studio `plugins` module (built-in Python): Full VST parameter enumeration, get, and set — no new Python dependencies needed

**What NOT to use:** fluent-ffmpeg (archived May 2025), soundtouchjs (browser-only, incomplete Node.js support), any ML-based humanization library (massive training data requirements, latency, complexity — algorithmic approach achieves 90% of the value).

### Expected Features

**Must have (table stakes for v2.0):**
- Timing offset engine (push/pull with Brownian walk) — core humanization; uniform random sounds worse than quantized
- Velocity variation with per-instrument profiles — different curves for drums, piano, bass, synths
- Swing/groove control (50-75% range, applied before humanization jitter)
- Note length variation (legato vs. staccato per beat position)
- Plugin parameter discovery (enumerate 4240 VST slots, filter blank names, cache name-to-index map)
- Plugin parameter get/set by name — never by hardcoded index
- Pattern render to WAV (guided manual workflow + file watcher)
- Pitch shift and detune via `channels.setChannelPitch()` — confirmed API, mode 1 (cents) works, mode 2 (semitones) is broken

**Should have (differentiators):**
- Context-aware humanization (tight fast passages, loose slow passages)
- Beat-position awareness (downbeats stable, upbeats looser)
- Named humanization presets ("tight", "loose", "jazz", "lo-fi")
- Serum 2 semantic parameter mapping (oscillator, filter, macros, FX aliases)
- Sound type recipes (pad, bass, lead, pluck) — parameter combos for specific sounds
- Preset navigation via `plugins.nextPreset()` / `plugins.prevPreset()`
- Full resampling workflow (generate -> render -> manipulate -> reload)
- SoX-powered reverse, time-stretch, and sample layering

**Defer (not in v2.0):**
- ML-based humanization — algorithmic is better for this use case
- Full Serum 2 preset editor UI — scope explosion; Serum has its own UI
- Real-time audio streaming — not feasible via SysEx
- Sample chopping/slicing (Fruity Slicer/Slicex) — programmatic API access unconfirmed
- Mixing/mastering — this is v3.0
- Performance artifact modeling (fatigue, hand dominance) — advanced future feature

### Architecture Approach

The architecture pattern is a processing pipeline where humanization runs in TypeScript before notes reach FL Studio, plugin control uses a new FL Bridge Python handler backed by a name-to-index cache in TypeScript, audio processing runs entirely in Node.js using SoX as a CLI subprocess, and FL Studio is only involved for note placement (via existing pyscript mechanism) and sample loading (which requires user assistance due to hard API limits). The existing SysEx bridge carries plugin control commands; the file system carries audio data.

The three Python scripting environments in FL Studio (MIDI Controller Scripts, Piano Roll Scripts, Edison Scripts) are completely isolated — each runs in its own interpreter with no inter-script communication. This is a hard architectural constraint that determines where each capability lives.

**Major components:**

1. **Humanization Engine** (`src/music/humanize.ts`) — Pure TypeScript pipeline step between note generation and pyscript serialization; applies Brownian-walk timing drift, Gaussian velocity variation, swing, and articulation changes to `NoteData[]`; stores original note data to prevent double-humanization
2. **Plugin Parameter Layer** (`src/plugins/param-cache.ts`, `src/plugins/serum2.ts`) — Name-to-index cache built via one-time enumeration of VST parameter slots; semantic alias mapping for Serum 2; shadow state for unreliable `getParamValue`; per-command timeout configuration
3. **FL Bridge Plugins Handler** (`fl-bridge/handlers/plugins.py`) — New Python handler: `plugins.discover`, `plugins.getParam`, `plugins.setParam`, `plugins.findPlugin`, `plugins.getPresets`, `plugins.nextPreset`, `plugins.prevPreset`; PME flag checks before all setParamValue calls
4. **Audio Processing Layer** (`src/audio/`) — SoX CLI wrapper for pitch-shift/reverse/chop/layer, `node-wav` for WAV I/O, `chokidar` file watcher for detecting renders, sample cache for tracking processed files
5. **New MCP Tools** (`src/tools/humanize.ts`, `plugins.ts`, `samples.ts`, `render.ts`) — Tool definitions exposing all v2.0 capabilities to Claude; optional `humanize` parameter added to existing note tools

### Critical Pitfalls

1. **Uniform random humanization sounds worse than quantized** — Use Brownian random-walk model: each note's offset is the previous offset plus a Gaussian delta with a spring constant pulling back toward zero. Scale timing offsets relative to tempo and note density (tight for fast passages, loose for slow). Apply swing first, then Brownian humanization around the swung grid position, not the original grid.

2. **VST parameter index instability** — `plugins.getParamCount()` returns 4240 for every VST; most slots return blank names. Indices shift between plugin versions (Serum 2 v2.0.17 had a confirmed index-offset bug). Never hardcode indices — enumerate once, filter blanks, cache name-to-index map, invalidate on plugin change.

3. **`getParamValue` unreliable for VSTs** — Known, acknowledged FL Studio bug. Maintain shadow state: every `setParamValue` call stores the value on the TypeScript side. Design all parameter operations as absolute values (not relative), since relative requires knowing current state. Test with Serum 2 specifically early — it may work even if broken for other VSTs.

4. **No programmatic audio rendering exists** — FL Studio's Python API has no export/render function. `transport.globalTransport()` has 80+ commands but none for rendering. `ui` module keyboard simulation lacks modifier keys (no Ctrl+R). Accept the manual step — design the render workflow as guided UX with `chokidar` file watching to automate post-render steps.

5. **No programmatic sample loading into channels** — `channels` module has no `loadSample()` or `setSamplePath()`. Process all audio in Node.js via SoX, save to a known location, instruct user to drag into FL Studio. Do not attempt Edison scripting as a workaround — Edison runs in a completely separate isolated Python interpreter.

6. **Double humanization accumulation** — Applying humanization multiple times stacks offsets, making patterns unrecognizably sloppy. Store original grid-quantized note data; implement "re-humanize" as reset-to-grid-then-apply, not apply-on-top-of-humanized.

7. **SysEx payload size for parameter discovery** — A full 4240-parameter response base64-encoded can exceed MIDI buffer limits. Return only non-empty parameter names (expected 300-500 for Serum 2). Implement chunking for responses exceeding 2KB before base64.

## Implications for Roadmap

All three feature tracks (humanization, plugin control, audio/sample) are largely independent but should be ordered by validation risk and dependency. Start with the most certain and build toward the least certain. Humanization and plugin control can run in parallel if resources allow.

### Phase 1: Humanization Engine

**Rationale:** Zero new FL Studio API surface. Pure TypeScript transformation on existing `NoteData[]` objects. Can be built and tested without FL Studio running. Immediate value — improves all existing note generation tools the moment it ships. No bridge changes required.

**Delivers:** Brownian timing drift, Gaussian velocity variation, beat-position awareness, swing/groove engine, note length variation (legato/staccato), per-instrument profiles (drums/piano/bass/synths), named humanization presets (tight, loose, jazz, lo-fi), original-note-data preservation to prevent double-humanization, optional `humanize` param added to existing note tools

**Addresses:** All table-stakes humanization features (timing offset, velocity variation, swing, note length, per-instrument profiles)

**Avoids:** Uniform random humanization (#1), double humanization accumulation (#6), over-humanizing fast passages. Use Brownian walk, scale relative to tempo, store original note data alongside humanized output.

**Research flag:** No further research needed. Algorithms are well-researched, `simplex-noise` stack choice is clear, FL Studio API is not involved.

### Phase 2: Generic Plugin Parameter Control

**Rationale:** Validates the `plugins` Python module before Serum 2 integration. Establishes the parameter discovery cache pattern that Serum 2 depends on. Must handle SysEx size limits and timeout issues before Serum 2's parameter count makes them critical. Early discovery of whether `getParamValue` is broken for Serum 2 — critical design information for Phase 3.

**Delivers:** New `fl-bridge/handlers/plugins.py` handler, `src/plugins/param-cache.ts` with name-to-index cache, per-command timeout configuration (discovery gets 30s, not 5s), SysEx chunking for responses exceeding 2KB, shadow state for plugin parameters, PME flag checking before all setParamValue calls, `plugin.discover` MCP tool

**Addresses:** Parameter discovery, parameter get/set by name

**Avoids:** VST parameter index instability (#2), `getParamValue` unreliability (#3), SysEx size limits (#7), timeout issues, PME flag violations. Cache parameter maps, use shadow state, check PME flags.

**Research flag:** Requires hands-on testing spike before full implementation. Key unknowns: (a) Does `getParamValue` work for Serum 2 in FL Studio 2025? (b) What is the maximum reliable SysEx payload size through loopMIDI on this system? (c) Does `setParamValue` work reliably during playback without PME violations?

### Phase 3: Serum 2 Sound Design

**Rationale:** Depends entirely on Phase 2 (generic plugin control must work, parameter cache must exist). Requires a hands-on parameter discovery spike against a running Serum 2 instance before semantic aliases can be written — this is a research task, not just coding. High value — core to the v2.0 vision.

**Delivers:** `src/plugins/serum2.ts` semantic parameter mapping, sound type recipes (pad, bass, lead, pluck), Serum 2-specific MCP tools for oscillator/filter/macro/FX/preset control, fuzzy parameter name matching for resilience across Serum versions, preset navigation

**Addresses:** Oscillator control, filter control, macro mapping, effects chain control, preset loading, sound type recipes

**Avoids:** Serum 2 parameter complexity and naming inconsistency. Run discovery first, build alias table from actual runtime names (not UI label assumptions), start with top 50 most-used parameters rather than mapping all 300+, use fuzzy matching for name resilience.

**Research flag:** Requires a discovery spike against Serum 2 in FL Studio to catalog actual parameter names before coding the semantic layer. Names returned by `getParamName()` may differ from Serum 2 UI labels ("Filter 1 Cutoff" in UI vs. "Fltr1_Freq" internally). Do not write hardcoded aliases until real names are confirmed.

### Phase 4: Audio Rendering Workflow

**Rationale:** No programmatic API exists for rendering — this is a confirmed hard limit verified against official API stubs. Phase 4 establishes the file-watching pattern and guided UX that Phase 5 depends on for source material. The manual step is acceptable when the surrounding workflow is seamless.

**Delivers:** `chokidar`-based file watcher (`src/audio/file-watcher.ts`), guided render workflow tool (instructs user with exact steps, suggested filename, output path, watches for result), render guidance UX, optional investigation of `FL64.exe /R /Pn` CLI rendering as enhancement path

**Addresses:** Pattern render to WAV, render with/without mixer FX

**Avoids:** Assuming programmatic rendering is possible (#4). Accept the manual Ctrl+R step — optimize UX around it so post-render automation is seamless once the file appears.

**Research flag:** Investigate `FL64.exe /R /Pn /Opath` CLI rendering. Test whether it conflicts with an already-running FL Studio instance. If it works non-conflictingly, it could eliminate the manual Ctrl+R step for single-pattern renders.

### Phase 5: Sample Manipulation

**Rationale:** Depends on Phase 4 (needs rendered WAV files as source material). SoX-based audio processing in Node.js is well-understood and carries low risk. The only unresolved piece is getting processed samples back into FL Studio — which requires user drag-and-drop per the API analysis. SoX must be present on system PATH.

**Delivers:** SoX CLI wrapper (`src/audio/sox.ts`) for pitch-shift/time-stretch/reverse/chop/layer, `node-wav` WAV I/O (`src/audio/wav-io.ts`), sample cache for tracking processed files, full resampling workflow (generate notes -> render -> manipulate -> reload), stereo layering via detune, startup SoX availability check with installation instructions if missing

**Addresses:** Pitch shift, detune, reverse, time stretch, layering, full resampling workflow

**Avoids:** Edison scripting for sample manipulation (Edison is isolated, cannot be triggered programmatically), assuming `channels.loadSample()` exists (#5). All DSP in Node.js. Accept manual sample reload into FL Studio. Use SoX CLI subprocess, not JavaScript audio libraries designed for browsers.

**Research flag:** Verify SoX is installed on user's system before implementing. Investigate `channels.setChannelPitch(idx, cents, mode=1)` reliability — mode 1 (cents offset) is expected to work but mode 2 (semitone range) is confirmed broken. Investigate `general.processRECEvent()` as a potential sample loading mechanism before accepting drag-and-drop as the only path.

### Phase Ordering Rationale

- **Risk ordering:** Phases 1-5 progress from zero-risk (pure TypeScript, no FL Studio API) to highest-risk (unconfirmed API workarounds). Each phase validates assumptions for the next.
- **Dependency chain:** Humanize modifies existing `NoteData[]` (no new FL API); plugin control introduces new FL Bridge handler; Serum 2 builds on plugin control's parameter cache; sample manipulation requires rendered audio from Phase 4; the full resampling workflow requires all phases.
- **Parallel opportunity:** Phase 1 (humanization) and Phase 2 (plugin control) share no code and can be built concurrently. Phase 3 (Serum 2) begins after Phase 2's discovery spike confirms parameter reading works.
- **Pitfall prevention by sequencing:** Doing generic plugin control before Serum 2 means the team discovers whether `getParamValue` is broken and whether SysEx chunking is needed before building the Serum 2 semantic layer on top of potentially broken infrastructure.

### Research Flags

Phases needing hands-on investigation spikes before full implementation:

- **Phase 2 (Generic Plugin Control):** Test `getParamValue` reliability for Serum 2 in FL Studio 2025. Benchmark maximum SysEx payload size through loopMIDI. Confirm `setParamValue` during playback without PME violations.
- **Phase 3 (Serum 2):** Run parameter discovery against a live Serum 2 instance and catalog actual parameter names before writing semantic aliases.
- **Phase 4 (Audio Rendering):** Test `FL64.exe /R /Pn /Opath` CLI rendering behavior when FL Studio is already running.

Phases with well-documented patterns (proceed directly without research-phase):

- **Phase 1 (Humanization):** Algorithms are well-researched, `simplex-noise` is chosen, no FL Studio API involved.
- **Phase 5 (Sample Manipulation):** SoX is mature and thoroughly documented. Node.js audio processing patterns are standard. Implement directly once Phase 4 file watching is in place.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm packages are verified and purposefully minimal. SoX is a 30-year mature tool. Only caveat: `node-wav` is 9 years old but WAV format is stable. |
| Features | MEDIUM | Table stakes features are well-researched from multiple production guides. Serum 2 parameter names are LOW confidence until runtime discovery. Audio rendering scope depends on which workarounds prove viable. |
| Architecture | MEDIUM-HIGH | FL Studio API limitations are verified from official documentation stubs (not just community reports). Component boundaries and data flows are clear. Open questions: FL Studio CLI rendering behavior, `processRECEvent` for sample loading. |
| Pitfalls | HIGH | Critical pitfalls are sourced from official API docs (confirmed API gaps), acknowledged FL Studio bugs (forum + developer statements), and established music production practice. These risks are real and the mitigations are sound. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Serum 2 actual parameter names:** Must be discovered via live `plugins.getParamName()` enumeration. Cannot be resolved through documentation — only by running Serum 2 in FL Studio. Do not write alias table until this spike is complete.
- **`getParamValue` bug scope for Serum 2:** Known to be broken for "some VSTs" but unknown for Serum 2 specifically in FL Studio 2025. Test early in Phase 2 to determine if shadow state is required or optional.
- **SysEx payload size limit in practice:** Must be benchmarked empirically on this system (loopMIDI + Windows MIDI API + RtMidi + FL Studio receive buffer all impose different limits). Benchmark before committing to a chunking strategy.
- **FL Studio CLI rendering with live instance:** `FL64.exe /R` is documented for batch rendering but its behavior when FL Studio is already running is unknown. This could unlock automated rendering if it works non-conflictingly.
- **`general.processRECEvent()` for sample loading:** Unexplored. Worth a short investigation during Phase 5 planning before accepting user drag-and-drop as the only sample reload mechanism.

## Sources

### Primary (HIGH confidence)
- [FL Studio Python API Stubs — Official](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/) — Verified absence of render/export API, confirmed plugins module functions, confirmed no sample loading in channels module
- [FL Studio Plugins Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/) — Full parameter enumeration and control function signatures with parameter count details (4096 VST + 128 MIDI CC + 16 aftertouch = 4240 total)
- [FL Studio Channels Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/) — Confirmed no `loadSample` or `setSamplePath`
- [FL Studio Transport Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/) — Confirmed no render command in `globalTransport` constants
- [FL Studio General Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/) — Confirmed no export function
- [FL Studio UI Keyboard Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/ui/keyboard/) — Confirmed no modifier key simulation
- [FL Studio PME Flags](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/midi/pme%20flags/) — Operation safety flag documentation
- [FL Studio Edison Scripting API](https://il-group.github.io/FL-Studio-API-Stubs/edison_scripting/) — Confirmed isolated interpreter, no file I/O, cannot be triggered from MIDI scripts
- [simplex-noise npm](https://www.npmjs.com/package/simplex-noise) — v4.0.3, TypeScript-native, zero deps
- [chokidar npm](https://www.npmjs.com/package/chokidar) — v4.x, cross-platform file watching
- [SoX Documentation](https://sox.sourceforge.net/sox.html) — v14.4.2+, all needed audio operations verified
- [Serum 2 Official Product Page](https://xferrecords.com/products/serum-2) — Feature architecture reference (3 oscillators, 5 synthesis modes, 8 macros, effects list)

### Secondary (MEDIUM confidence)
- [FL Studio Forum: getParamValue bug acknowledged](https://forum.image-line.com/viewtopic.php?t=272593) — Long-standing broken VST read confirmed by community and developer acknowledgment
- [FL Studio Forum: VST3 parameter ID instability](https://forum.image-line.com/viewtopic.php?t=299601) — Index shift behavior confirmed
- [Serum 2 Changelog (community)](https://gist.github.com/0xdevalias/a537a59d1389d5aed3bc63b544c70c8d) — v2.0.17 parameter index bug fix confirmed
- [fl_param_checker](https://github.com/MaddyGuthridge/fl_param_checker) — Runtime parameter discovery utility for development/debugging
- [HumBeat 2 Drum Humanizer](https://developdevice.com/products/humbeat-2-0-the-ultimate-midi-drum-humanizer) — Gaussian distribution approach, per-instrument timing ranges, performance artifact modeling reference
- [MIDI Humanizer (brownian noise)](https://github.com/vincerubinetti/midi-humanizer) — Brownian random-walk implementation reference
- [Serum 2 Manual](https://images.equipboard.com/uploads/item/manual/127411/xfer-records-serum-2-advanced-wavetable-synthesizer-manual.pdf) — Parameter category reference
- Production technique guides for humanization timing ranges, velocity curves, swing formulas — cross-referenced across multiple sources

### Tertiary (LOW confidence — needs validation)
- Serum 2 exact parameter names as reported by `plugins.getParamName()` — guesses based on UI labels only; must be confirmed by runtime discovery
- FL Studio CLI rendering with live instance (`FL64.exe /R`) — documented but untested behavior when FL Studio is already running
- `general.processRECEvent()` for sample loading — speculation; no community confirmation found

---
*Research completed: 2026-02-23*
*Ready for roadmap: yes*
