# Technology Stack

**Project:** FL Studio MCP Server - v2.0 Production Pipeline
**Researched:** 2026-02-23
**Scope:** Stack ADDITIONS for humanization, plugin control, Serum 2, audio rendering, and sample manipulation
**Overall Confidence:** MEDIUM (audio processing path is clear; FL Studio render/sample-loading has hard API limits)

## Executive Summary

The Production Pipeline milestone requires three categories of new stack additions:

1. **Humanization engine** -- Pure TypeScript math, no new dependencies. Use `simplex-noise` for organic variation curves. The existing piano roll `.pyscript` approach already supports per-note `pitchofs`, `fcut`, `fres`, and `release` properties needed for articulation.

2. **Plugin parameter control (Serum 2)** -- FL Studio's `plugins` module provides `getParamName`, `getParamValue`, `setParamValue`, and `getParamCount`. This is sufficient for full VST parameter control. Serum 2 parameter indices must be discovered empirically at runtime via enumeration (loop `getParamName` over all indices). No third-party library needed.

3. **Audio rendering and sample manipulation** -- This is the hardest part. FL Studio's Python API has **no export/render function** and **no sample-loading function**. Rendering must use a workaround (file watcher + manual trigger or Edison scripting). Sample manipulation (pitch-shift, reverse, chop) should happen in Node.js using **SoX** as a CLI subprocess, with `node-wav` for WAV I/O.

---

## Existing Stack (Unchanged)

These are already validated and working. Listed for reference only.

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 24.x (fnm) | Runtime |
| TypeScript | 5.9.x | Language |
| @modelcontextprotocol/sdk | 1.26.x | MCP implementation |
| zod | 3.25.x | Schema validation |
| tonal | 6.4.x | Music theory |
| midi (npm) | 2.0.x | MIDI communication |
| FL Bridge (Python) | 3.9-3.11 | FL Studio MIDI controller script |
| loopMIDI | Latest | Virtual MIDI port |

---

## New Dependencies: Humanization Engine

### Recommendation: `simplex-noise` + custom algorithms

Humanization requires organic, correlated random variation -- not uniform random noise. The key insight: Perlin/simplex noise produces **smooth, continuous curves** that model natural human timing drift, while Brownian motion models **accumulating micro-drift** over a performance.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| simplex-noise | ^4.0.3 | Organic noise generation for timing/velocity variation | Fast (20ns/sample), zero dependencies, native TypeScript, tree-shakeable. Provides noise2D/3D/4D. Use 1D slice of 2D noise for smooth per-note variation curves. |

**Confidence:** HIGH -- simplex-noise is well-maintained (last release Jul 2024), has built-in TypeScript types, and is the standard choice for procedural generation in JS/TS.

### What NOT to add

| Library | Why Skip |
|---------|----------|
| noisejs | No TypeScript types, older API, less maintained |
| fast-simplex-noise | Older implementation, simplex-noise is faster and better typed |
| open-simplex-noise | Less popular, unnecessary given simplex-noise covers all needs |
| Any "MIDI humanization" library | None exist that are mature in the Node.js ecosystem. Better to implement the algorithms ourselves with simplex-noise as the noise source. |

### Humanization Algorithms (No Dependencies)

These are implemented as pure TypeScript functions using `simplex-noise`:

| Algorithm | What It Does | Implementation Notes |
|-----------|-------------|---------------------|
| **Timing push/pull** | Shift note start times by small amounts | Simplex noise seeded by beat position. Range: -15ms to +15ms for subtle, -30ms to +30ms for loose. |
| **Velocity breathing** | Natural dynamic variation across notes | Simplex noise + downbeat emphasis (beat 1 louder, upbeats softer). Layered: slow drift + per-note jitter. |
| **Swing/groove** | Offset every other subdivision | Deterministic pattern (not random). Configurable swing amount 0-100%. |
| **Articulation variation** | Vary note duration (legato vs staccato) | Simplex noise on note length. Shorter on upbeats, longer on downbeats. Uses piano roll's `release` property. |
| **Timing drift** | Slow global tempo wander | Low-frequency simplex noise applied as global offset. Simulates a performer gradually speeding up/slowing down. |
| **Brownian motion walk** | Accumulating micro-offsets for "drunken" timing | Random walk with mean reversion. Custom implementation using simplex noise as the step source. |

**Note:** The existing piano roll `.pyscript` system already supports `pitchofs` (pitch offset in cents), `fcut` (filter cutoff), `fres` (filter resonance), and `release` properties per note. These are exposed through FL Studio's Piano Roll Scripting API. Humanization parameters map directly to these existing fields.

**Source:** [simplex-noise npm](https://www.npmjs.com/package/simplex-noise), [simplex-noise GitHub](https://github.com/jwagner/simplex-noise.js)

### Installation

```bash
npm install simplex-noise@^4.0.3
```

---

## New Dependencies: Plugin Parameter Control

### Recommendation: No new dependencies -- use FL Studio's `plugins` module

The FL Studio Python API `plugins` module provides everything needed for generic VST parameter control:

| Function | Signature | What It Does | Confidence |
|----------|-----------|-------------|------------|
| `plugins.isValid()` | `(index, slotIndex=-1, useGlobalIndex=False) -> bool` | Check if plugin exists at channel/mixer slot | HIGH |
| `plugins.getPluginName()` | `(index, slotIndex=-1, userName=False, useGlobalIndex=False) -> str` | Get plugin name (e.g. "Serum 2") | HIGH |
| `plugins.getParamCount()` | `(index, slotIndex=-1, useGlobalIndex=False) -> int` | Total number of parameters (up to 4096) | HIGH |
| `plugins.getParamName()` | `(paramIndex, index, slotIndex=-1, useGlobalIndex=False) -> str` | Get human-readable parameter name (e.g. "Osc A Level") | HIGH |
| `plugins.getParamValue()` | `(paramIndex, index, slotIndex=-1, useGlobalIndex=False) -> float` | Read parameter value (0.0-1.0) | HIGH |
| `plugins.setParamValue()` | `(value, paramIndex, index, slotIndex=-1, pickupMode=0, useGlobalIndex=False) -> None` | Set parameter value (0.0-1.0) | HIGH |
| `plugins.getParamValueString()` | `(paramIndex, index, slotIndex=-1, ...) -> str` | Human-readable value (e.g. "440 Hz", "-6 dB") | HIGH |
| `plugins.getPresetCount()` | `(index, slotIndex=-1, useGlobalIndex=False) -> int` | Number of available presets | HIGH |
| `plugins.nextPreset()` / `plugins.prevPreset()` | `(index, slotIndex=-1, useGlobalIndex=False) -> None` | Navigate presets | HIGH |

**Source:** [FL Studio API - plugins module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/)

### Parameter Discovery Strategy

Serum 2 does NOT publish a static parameter index mapping. Parameter indices are **positional within FL Studio's wrapper** and must be discovered at runtime. The strategy:

1. **Runtime enumeration**: Loop `plugins.getParamName(i, channelIndex)` for `i in range(plugins.getParamCount(channelIndex))` to build a `name -> index` mapping.
2. **Cache in FL Bridge**: Store the mapping per plugin instance. Rebuild on plugin change.
3. **Name-based resolution on MCP side**: The TypeScript tool accepts parameter names ("Osc A Level", "Filter Cutoff"), FL Bridge resolves to index.
4. **Fuzzy matching**: Parameter names may vary slightly between plugin versions. Use fuzzy string matching for resilience.

**Known issue from Serum 2 changelog:** Version 2.0.17 fixed a bug where "effect parameters were offset by one index after project reload." This confirms parameter indices can shift. Name-based resolution is essential, not optional.

**Helpful tool:** [fl_param_checker](https://github.com/MaddyGuthridge/fl_param_checker) -- A utility that monitors parameter changes in real-time to discover indices. Useful for development/debugging but not a runtime dependency.

### Serum 2 Architecture (for parameter mapping)

Serum 2 has the following parameter categories that will appear in the enumeration:

| Category | Expected Parameters | Notes |
|----------|--------------------|-------|
| **Oscillator A** | Level, Pan, Octave, Semi, Fine, Unison, Detune, Blend, Phase, Random, WT Position | Wavetable position is the primary sound design parameter |
| **Oscillator B** | Same as Osc A | Mirror structure |
| **Oscillator C** | Level, type-specific params | New in Serum 2, simpler than A/B |
| **Sub oscillator** | Level, Shape, Octave | Basic sub |
| **Noise** | Level, Pan, Phase, Pitch | Noise generator |
| **Filter 1** | Type, Cutoff, Resonance, Pan, Drive, Fat, Mix | Multiple filter types |
| **Filter 2** | Same as Filter 1 | Second filter |
| **Envelope (ADSR)** | Attack, Decay, Sustain, Release per env | Multiple envelopes |
| **LFO** | Rate, Rise, Delay, Smooth per LFO | Multiple LFOs |
| **FX** | Per-effect parameters | Distortion, Chorus, Flanger, Phaser, Delay, Compressor, Reverb, EQ, Filter, Hyper/Dimension |
| **Macros** | Macro 1-8 | User-assignable macro knobs (0.0-1.0) |
| **Global** | Master Volume, Voices, Portamento | Global synth params |

**Confidence:** MEDIUM -- These categories are based on Serum 2's known architecture (manual, web documentation). Exact parameter names will only be confirmed by runtime enumeration.

**Source:** [Serum 2 Manual](https://images.equipboard.com/uploads/item/manual/127411/xfer-records-serum-2-advanced-wavetable-synthesizer-manual.pdf), [Serum 2 Web Manual](https://xferrecords.com/web-manual/serum-2/routing-an-oscillator-or-filter)

---

## New Dependencies: Audio Rendering

### Critical Finding: FL Studio Cannot Render Programmatically

After thorough investigation of the FL Studio Python API, I can confirm:

- **`general` module**: Contains undo/redo, project info, version. **No export or render function exists.** [HIGH confidence]
- **`transport` module**: Contains play/stop/record/position. `globalTransport()` handles transport commands (FPT_Play, FPT_Stop, FPT_Record, etc.). **No render command exists.** [HIGH confidence]
- **`ui` module keyboard functions**: Only basic keys (enter, escape, up, down, cut, copy, paste). **No modifier keys (Ctrl+R) can be simulated.** [HIGH confidence]
- **`channels` module**: Properties, UI, notes, sequencer. **No sample loading function exists.** [HIGH confidence]

**Source:** [FL Studio API - general module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/), [FL Studio API - transport module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/), [FL Studio API - UI keyboard](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/ui/keyboard/), [FL Studio API - channels module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/)

### Workaround Options for Audio Rendering

| Approach | How | Viability | Confidence |
|----------|-----|-----------|------------|
| **A: Edison scripting** | Load pattern into Edison, use `GetSampleAt`/`SetSampleAt` for waveform manipulation, save via Edison | Requires manual Edison setup; Edison scripting API is very limited (no built-in pitch shift, no export function, only raw sample access) | LOW |
| **B: File watcher + manual export** | User triggers Ctrl+R manually; MCP server watches output directory for new WAV files | Works reliably but requires user interaction for each render. Could prompt user: "Please press Ctrl+R to render." | MEDIUM |
| **C: External automation (AutoHotkey/pyautogui)** | Simulate Ctrl+R keystroke from outside FL Studio | Fragile, OS-specific, requires permissions. Anti-pattern. | LOW |
| **D: FL Studio's "Record to disk" mode** | Start recording, play pattern, stop -- captures audio | Requires real-time playback (slow); audio quality depends on buffer settings | LOW |

### Recommendation: Approach B (File Watcher + Manual Trigger)

Use a **guided workflow** for rendering:

1. MCP server instructs user: "Export the current pattern as WAV using Ctrl+R"
2. MCP server provides suggested filename and output path
3. MCP server uses `fs.watch()` or `chokidar` to detect the new WAV file
4. Once detected, proceed to sample manipulation

This is honest about the limitation while still being practical. The user already has muscle memory for Ctrl+R.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| chokidar | ^4.0.x | File system watcher | More reliable than `fs.watch()` across platforms. Watches for new WAV files in the output directory. |

**Confidence:** MEDIUM -- chokidar is well-established, but the overall workflow requires user interaction which limits full automation.

**Alternative for future:** If FL Studio adds a render API in a future version, this workaround can be replaced transparently.

**Source:** [chokidar npm](https://www.npmjs.com/package/chokidar)

### Installation

```bash
npm install chokidar@^4.0.0
```

---

## New Dependencies: Sample Manipulation

### Recommendation: SoX (CLI) + node-wav (WAV I/O)

For audio processing (pitch-shift, time-stretch, reverse, trim/chop), there are two viable approaches:

**Option A: Pure JavaScript libraries** -- Libraries like `soundtouchjs` and `pitch-shift` exist but are designed for Web Audio API (browser), not server-side Node.js. They lack critical features and have incomplete Node.js support.

**Option B: SoX as CLI subprocess** -- SoX (Sound eXchange) is the "Swiss Army knife of audio manipulation." It's a mature, battle-tested command-line tool that handles all needed operations. Call it from Node.js via `child_process.execFile`.

**Use Option B (SoX).** Here's why:

| Criterion | Pure JS Libraries | SoX CLI |
|-----------|-------------------|---------|
| Pitch shift quality | Basic (phase vocoder, artifacts) | High quality (multiple algorithms) |
| Time stretch | Limited/no support | Full support with multiple modes |
| Reverse | Must implement manually | Built-in (`reverse` effect) |
| WAV I/O | Good (node-wav, wavefile) | Native (reads/writes dozens of formats) |
| Node.js support | Incomplete (designed for browsers) | Full (CLI is process-agnostic) |
| Maintenance | Scattered, often abandoned | Actively maintained since 1991 |
| Complexity | Each operation = different library | One tool for everything |

### SoX Operations Needed

| Operation | SoX Command | Example |
|-----------|------------|---------|
| **Pitch shift (semitones)** | `sox input.wav output.wav pitch <cents>` | `pitch 100` = up 1 semitone, `pitch -1200` = down 1 octave |
| **Pitch shift (preserve tempo)** | `sox input.wav output.wav pitch <cents>` | Tempo preserved by default |
| **Time stretch** | `sox input.wav output.wav tempo <factor>` | `tempo 0.5` = half speed, same pitch |
| **Reverse** | `sox input.wav output.wav reverse` | Full sample reversal |
| **Trim/chop** | `sox input.wav output.wav trim <start> <duration>` | `trim 0 2.0` = first 2 seconds |
| **Speed (pitch+tempo)** | `sox input.wav output.wav speed <factor>` | `speed 2.0` = double speed + octave up |
| **Fade** | `sox input.wav output.wav fade <type> <in> <stop> <out>` | Fade in/out with various curves |
| **Normalize** | `sox input.wav output.wav norm` | Normalize to 0dBFS |
| **Concatenate (layer)** | `sox -m input1.wav input2.wav output.wav` | Mix/layer multiple samples |
| **Gain** | `sox input.wav output.wav gain <dB>` | Volume adjustment |

### Stack Additions for Sample Manipulation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SoX | 14.4.2+ | Audio effects processing | Handles all pitch-shift, time-stretch, reverse, chop, layer operations via CLI. Battle-tested, high quality. Must be installed on system PATH. |
| node-wav | ^0.0.2 | WAV file decode/encode in Node.js | High-performance WAV reader/writer. Returns Float32Array channel data. Use for reading WAV metadata, generating audio programmatically, or when SoX is overkill. |
| @types/node-wav | ^0.0.4 | TypeScript types for node-wav | Type definitions for decode/encode functions. |

**Confidence:** HIGH for SoX (extremely mature tool), MEDIUM for node-wav (old but stable, minimal maintenance).

### What NOT to add

| Library | Why Skip |
|---------|----------|
| **fluent-ffmpeg** | Archived (May 2025), read-only. FFmpeg is overkill for audio-only tasks. SoX is purpose-built for audio. |
| **soundtouchjs** | Browser-focused (Web Audio API). Node.js support is "incomplete" per their own docs. |
| **Tone.js** | Full Web Audio framework, browser-only. Not suitable for server-side CLI processing. |
| **rubberband** | Excellent quality but requires C++ native bindings or WASM. SoX handles the same operations with simpler integration. GPL license is also a concern. |
| **wavefile (npm)** | Last updated 6 years ago (v11.0.0). `node-wav` is simpler and has TypeScript types. |

### SoX Installation Requirement

SoX must be installed on the user's system. It is NOT an npm dependency.

**Windows:**
```
Download from https://sourceforge.net/projects/sox/
Extract to a directory (e.g., C:\Program Files\sox-14.4.2\)
Add to system PATH
```

**Verification:**
```bash
sox --version
# Should output: sox: SoX v14.4.2
```

The MCP server should verify SoX availability at startup and provide a clear error message if missing.

**Source:** [SoX Documentation](https://sox.sourceforge.net/sox.html), [node-wav npm](https://www.npmjs.com/package/node-wav), [@types/node-wav](https://www.npmjs.com/package/@types/node-wav)

### Installation (npm packages only)

```bash
npm install node-wav@^0.0.2
npm install -D @types/node-wav@^0.0.4
```

---

## New Dependencies: Resampling Workflow

### No Additional Dependencies

The resampling workflow (bounce to WAV, reload into FL Studio, manipulate) combines capabilities from other sections:

1. **Bounce**: Guided render workflow (chokidar file watcher)
2. **Manipulate**: SoX for pitch-shift, reverse, chop, etc.
3. **Reload into FL Studio**: **Cannot be automated.** The channels API has no `loadSample()` function.

### Reload Workaround

Like rendering, sample loading requires user assistance:

1. MCP server places the processed WAV file in a known location
2. MCP server instructs user: "Drag the file from [path] into a Sampler channel in FL Studio"
3. OR: MCP server can open the file in Windows Explorer for easy drag-and-drop

This is a fundamental FL Studio API limitation, not a stack choice. Document it clearly in the workflow.

---

## Complete New Dependencies Summary

### npm packages to add

```bash
# Humanization
npm install simplex-noise@^4.0.3

# Audio rendering workflow
npm install chokidar@^4.0.0

# Sample manipulation (WAV I/O)
npm install node-wav@^0.0.2
npm install -D @types/node-wav@^0.0.4
```

### System requirements to add

| Requirement | Purpose | Installation |
|-------------|---------|-------------|
| SoX 14.4.2+ | Audio effects CLI | Download from sourceforge.net/projects/sox/ and add to PATH |

### No new Python dependencies

The FL Bridge Python script does not need new dependencies. All new FL Studio API usage (`plugins` module) is built into FL Studio's Python environment.

---

## Updated package.json (Projected)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "chokidar": "^4.0.0",
    "midi": "^2.0.0",
    "node-wav": "^0.0.2",
    "simplex-noise": "^4.0.3",
    "tonal": "^6.4.3",
    "zod": "^3.25.30"
  },
  "devDependencies": {
    "@types/node": "^25.3.0",
    "@types/node-wav": "^0.0.4",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

**Net addition: 3 runtime dependencies, 1 dev dependency, 1 system tool.**

---

## Updated Project Structure (New Files)

```
fl-studio-mcp/
  src/
    humanize/                    # NEW - Humanization engine
      noise.ts                   # Simplex noise wrapper, seed management
      timing.ts                  # Timing push/pull, drift, swing
      velocity.ts                # Velocity breathing, dynamics
      articulation.ts            # Note length variation, legato/staccato
      presets.ts                 # Named humanization profiles (subtle, medium, loose, genre-specific)
    audio/                       # NEW - Audio manipulation
      sox.ts                     # SoX CLI wrapper (pitch, reverse, chop, layer, etc.)
      wav-io.ts                  # node-wav wrapper for reading/writing WAV files
      render-watcher.ts          # Chokidar-based file watcher for rendered WAVs
      resampling.ts              # Orchestrates bounce -> manipulate -> reload workflow
    tools/
      humanize.ts                # NEW - MCP tools for humanization
      plugins.ts                 # NEW - MCP tools for generic plugin control
      serum2.ts                  # NEW - MCP tools for Serum 2 sound design
      audio.ts                   # NEW - MCP tools for sample manipulation
      render.ts                  # NEW - MCP tools for render workflow
  fl-bridge/
    handlers/
      plugins.py                 # NEW - Plugin parameter handlers (enumerate, get, set)
```

---

## FL Studio API Capabilities Update

### Newly Relevant APIs (for v2.0)

| Module | Function | Purpose | Confidence |
|--------|----------|---------|------------|
| `plugins.getParamCount()` | Count all parameters for a plugin | Plugin control foundation | HIGH |
| `plugins.getParamName()` | Get parameter name by index | Name-based parameter resolution | HIGH |
| `plugins.getParamValue()` | Read parameter value (0.0-1.0) | Read current plugin state | HIGH |
| `plugins.setParamValue()` | Set parameter value (0.0-1.0) | Control plugin parameters | HIGH |
| `plugins.getParamValueString()` | Get human-readable value string | Display "440 Hz" instead of "0.5" | HIGH |
| `plugins.getPluginName()` | Identify loaded plugin | Verify Serum 2 is loaded | HIGH |
| `plugins.getPresetCount()` | Count available presets | Preset management | HIGH |
| `plugins.nextPreset()` / `prevPreset()` | Navigate presets | Preset browsing | HIGH |

### Confirmed API Gaps (Hard Limits)

| What's Missing | Impact | Workaround |
|----------------|--------|------------|
| **No render/export function** | Cannot automate audio rendering | Guided workflow with file watcher |
| **No sample loading function** | Cannot load WAV into sampler channels | User drag-and-drop from suggested path |
| **No Ctrl+R simulation** | UI keyboard module lacks modifier keys | User must press Ctrl+R manually |
| **Edison scripting is isolated** | Edison scripts run in Edison only, not callable from MIDI scripts | Not usable for automated pipeline |

---

## Risk Assessment (New Features)

| Risk | Severity | Mitigation |
|------|----------|------------|
| SoX not installed on user system | HIGH | Check at startup, provide clear installation instructions. Consider bundling SoX binary. |
| Plugin parameter indices shift between sessions | HIGH | Always use name-based resolution, never cache raw indices across sessions. |
| Serum 2 parameter names unknown until runtime | MEDIUM | Build enumeration tool as first plugin control feature. Test with actual Serum 2 instance. |
| Render workflow requires user interaction | MEDIUM | Make it seamless: provide exact filename, watch for it, proceed automatically once detected. |
| Sample reload requires user interaction | MEDIUM | Provide file path, open containing folder. Future: investigate if `processRECEvent` could trigger sample loading. |
| node-wav is unmaintained (last release 9 years ago) | LOW | Package is simple and stable. WAV format doesn't change. If issues arise, switch to `wavefile` or raw Buffer parsing. |
| simplex-noise API changed in v4 | LOW | v4 API is stable (released 2022, last patch Jul 2024). Use `createNoise2D` import style. |

---

## Sources

### Official Documentation (HIGH confidence)
- [FL Studio API - plugins module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/) -- Full parameter control API
- [FL Studio API - general module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/) -- Confirmed no export function
- [FL Studio API - transport module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/) -- Confirmed no render command
- [FL Studio API - channels module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/) -- Confirmed no sample loading
- [FL Studio API - UI keyboard](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/ui/keyboard/) -- Confirmed no modifier keys
- [FL Studio API - Edison scripting](https://il-group.github.io/FL-Studio-API-Stubs/edison_scripting/) -- Limited to raw sample access
- [Serum 2 Official](https://xferrecords.com/products/serum-2) -- Synth architecture reference

### Package Registries (HIGH confidence)
- [simplex-noise npm](https://www.npmjs.com/package/simplex-noise) -- v4.0.3, TypeScript native
- [node-wav npm](https://www.npmjs.com/package/node-wav) -- v0.0.2, with @types/node-wav
- [chokidar npm](https://www.npmjs.com/package/chokidar) -- v4.x, file watching
- [SoX SourceForge](https://sox.sourceforge.net/) -- v14.4.2+, audio CLI

### Community Resources (MEDIUM confidence)
- [fl_param_checker](https://github.com/MaddyGuthridge/fl_param_checker) -- Tool for discovering plugin parameter indices
- [vst-parameters repo](https://github.com/forgery810/vst-parameters) -- Community parameter mappings for FL Studio
- [Serum 2 changelog](https://gist.github.com/0xdevalias/a537a59d1389d5aed3bc63b544c70c8d) -- Documents parameter index bug fix in v2.0.17

### Research Findings (LOW-MEDIUM confidence)
- Humanization with Perlin/simplex noise is an established technique in procedural audio generation
- SoX pitch shifting uses cents (hundredths of a semitone): multiply semitones by 100
- fluent-ffmpeg was archived May 2025, should not be used for new projects
- soundtouchjs has "incomplete" Node.js support per its own documentation
