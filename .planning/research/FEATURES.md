# Feature Landscape: FL Studio MCP Server v2.0 Production Pipeline

**Domain:** DAW automation / AI music production assistant -- Humanization, Sound Design, Audio Rendering, Sample Manipulation
**Researched:** 2026-02-23
**Confidence:** MEDIUM (verified with FL Studio API docs, product documentation, and cross-referenced production guides)

**Scope:** This document covers features for the v2.0 milestone only. For v1.0 feature landscape (transport, note generation, composition), see git history of this file.

---

## Table Stakes

Features that MUST exist for the v2.0 milestone to deliver value. Without these, the production pipeline is incomplete.

### Humanization

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Timing offset (push/pull)** | Core of humanization; without timing variation notes sound robotic | Medium | Existing note generation (v1.0) | Offsets of 5-20ms typical; Gaussian distribution for natural feel; HumBeat 2 uses +-20ms max |
| **Velocity variation** | Every humanization tool provides this; second most impactful parameter | Medium | Existing note generation (v1.0) | Different curves per instrument type: drums need accent patterns, piano needs dynamic range, bass stays more consistent |
| **Swing/groove** | Foundational rhythm technique; every DAW has swing built-in | Medium | Timing offset engine | 50% = straight, 54-63% = typical swing range; pushes every other subdivision later by 20-30 ticks |
| **Note length variation** | Real players vary articulation; staccato vs legato is expressive | Low | Existing note generation (v1.0) | Trim some notes to ~67% of grid, let others ring to ~110%; instrument-dependent |
| **Per-instrument profiles** | Drums, piano, bass, and synths humanize differently; one-size-fits-all sounds wrong | Medium | All above humanization features | Drums: tight kick (+-3ms), loose hats (+-10-15ms), ghost notes at vel 35-50. Piano: natural velocity variance 75-115. Bass: conservative timing (+-5ms), consistent velocity |

### Plugin Parameter Control

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Parameter discovery** | Must enumerate what parameters a plugin has before controlling them | Medium | FL Bridge (v1.0) | `plugins.getParamCount()` returns up to 4240 params for VSTs (4096 + 128 MIDI CC + 16 aftertouch); `plugins.getParamName()` for labels |
| **Parameter get/set** | Basic read/write of plugin parameters | Medium | Parameter discovery | `plugins.setParamValue(value, paramIndex, channelIndex)` where value is 0.0-1.0 normalized; `plugins.getParamValue()` to read back |
| **Parameter name-based resolution** | VST param indices are positional, not stable; need name lookup | Medium | Parameter discovery | Build name->index map at discovery time; cache per plugin instance; re-discover on plugin change |

### Audio Rendering

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Pattern render to WAV** | Core resampling workflow starts here; needed before any sample manipulation | High | FL Bridge (v1.0), pattern exists with notes | FL Studio GUI: right-click pattern -> "Render as audio clip". No direct Python API for rendering found. Ctrl+Alt+C consolidates. May need to use `ui` module to trigger menu actions or keyboard shortcuts |
| **Render with/without mixer FX** | Users need both: dry render for resampling, wet render for final audio | Medium | Pattern render | "Render as audio clip" = dry (no mixer effects); "Consolidate" (Ctrl+Alt+C) = offers dialog with options for FX inclusion |

### Sample Manipulation

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Pitch shift (semitones)** | Fundamental sample manipulation; pitch down for dark textures, pitch up for bright | Medium | Audio rendering (need a WAV to manipulate) | `channels.setChannelPitch(index, value, mode)` -- mode 0: factor of range, mode 1: cents offset, mode 2: semitone range. WARNING: mode 2 is documented as broken |
| **Detune (cents)** | Creates width, thickness, and chorus-like effects; standard production technique | Low | Pitch shift infrastructure | +-5 to +-15 cents is the standard range; `channels.setChannelPitch(index, cents, mode=1)` should work |
| **Load sample into channel** | Must get rendered WAV back into the channel rack for further manipulation | High | Audio rendering | Not clearly exposed in MIDI scripting API. May need to use `ui` module to trigger file browser, or leverage "Render as audio clip" which auto-loads. NEEDS VALIDATION |

---

## Differentiators

Features that go beyond what basic tools offer. These create competitive advantage and match the user's specific workflow needs.

### Advanced Humanization

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Context-aware timing** | Fast rolls stay tight (3-8ms), slow grooves breathe (10-20ms) -- like HumBeat 2's intelligent engine | High | Basic timing offsets | Analyze note density per beat region; tighter offsets for dense passages, wider for sparse. This is what separates "randomization" from "humanization" |
| **Beat position awareness** | Downbeats more stable, offbeats more loose -- how real players feel time | Medium | Basic timing offsets | Downbeat: +-3ms, backbeat: +-5ms, offbeat 16ths: +-10-15ms. Map beat position to timing variance range |
| **Groove templates** | Apply feel from classic drum machines (MPC, 808, SP-1200) or genres | High | Swing engine, beat position awareness | Pre-built timing/velocity maps: "J Dilla swing" (heavy late 16ths), "Neptunes bounce" (crisp 16th swing at ~58%), "Lo-fi hip hop" (loose everything). Store as JSON profiles |
| **Velocity accent patterns** | Automatic emphasis on strong beats with configurable accent strength | Medium | Velocity variation | Downbeat accent at 100-115 vel, ghost notes at 35-50 vel; pattern: strong-weak-medium-weak for 4/4 |
| **Performance artifacts** | Subtle note overlaps, slight timing drift over time, fatigue modeling | High | All basic humanization | HumBeat 2 models: hand dominance, foot fatigue for double bass, blast beat detection. For us: gradual timing drift (Brownian motion), slight velocity decay over long passages |
| **Humanization presets** | "Tight drummer", "Loose jazz", "Lo-fi", "Quantized with feel" -- one-word application | Low | All humanization features built | Combine all parameters into named profiles. Most impactful UX feature: user says "humanize the hi-hats like a jazz drummer" and gets appropriate settings |

### Serum 2 Sound Design

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Oscillator control** | Set wavetable position, oscillator type, unison voices, detune -- build sounds from scratch | High | Plugin parameter control | Serum 2 has 3 primary oscillators, 5 synthesis modes each (Wavetable, Multisample/SFZ, Sample, Granular, Spectral). Must map parameter names to indices |
| **Filter control** | Cutoff, resonance, drive, filter type -- essential for shaping sound character | Medium | Plugin parameter control | State variable filter with morphing; cutoff and resonance are the two most-tweaked parameters in any synth |
| **Macro mapping awareness** | Know what macros 1-8 control, set them for broad sound changes | Medium | Plugin parameter control | Common macro assignments: Macro 1 "Energy" (filter cutoff + drive + LFO rate), Macro 2 "Atmos" (reverb + delay + pan), Macro 3 "Tension" (chaos + detune + pitch drift). Serum 2 has 8 macros (doubled from v1) |
| **Effects chain control** | Reverb, delay, distortion, chorus, EQ -- built-in effects shaping | Medium | Plugin parameter control | Serum 2 effects are reorderable via drag-and-drop; includes bode frequency shifter, convolution, 3 new reverb modes, mid/side splitter |
| **Preset loading** | Browse and load from Serum 2's 626+ included presets | Low | Plugin parameter control | `plugins.nextPreset()` / `plugins.prevPreset()` available in API; `plugins.getPresetCount()` for total count |
| **Sound type recipes** | "Warm pad", "aggressive bass", "pluck lead" -- parameter combos that produce specific sound types | Medium | All Serum 2 controls | Pads: slow attack, long release, chorus/detune, low-pass filter. Basses: short attack, heavy sub, distortion, tight filter. Leads: medium attack, bright filter, unison for width. Plucks: fast attack, short decay, no sustain |

### Advanced Sample Manipulation

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Reverse** | Atmospheric pads, transition effects, reverse cymbal/piano swells | Medium | Audio rendering, sample loading | FL Studio Sampler Channel has reverse capability. Edison also reverses audio. API path unclear -- may need UI automation |
| **Sample chopping** | Rhythmic variation, rearranging sample segments, beat slicing | High | Audio rendering, sample loading | FL Studio has Fruity Slicer and Slicex for this. Programmatic access uncertain. May need Edison scripting (Python DSP scripts in Edison) |
| **Layering with processing** | Duplicate sample, detune one +7 cents left / -7 cents right for stereo width | Medium | Pitch shift, detune, channel creation | Create two channels with same sample, opposite detune, pan hard L/R. Standard "super stereo" technique |
| **Resampling workflow** | Full loop: create notes -> render to WAV -> load as sample -> manipulate -> render again | Very High | Audio rendering + sample loading + all manipulation | The killer workflow. "Make a chord, render it, pitch it down an octave, reverse it, layer it with the original." Each step must work reliably |
| **Time stretch** | Change duration without changing pitch; fit samples to tempo | Medium | Sample loading | FL Studio Sampler has Stretch mode; Edison has Time Stretch/Pitch Shift tool. `channels.setChannelPitch()` with mode 0 might interact with stretch settings |

---

## Anti-Features

Features to explicitly NOT build for v2.0. Common mistakes or scope traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **"Perfect" humanization from ML models** | Training data requirements are massive (midihum uses 2.6K piano performances); model serving adds latency and complexity; algorithmic approach with good profiles gets 90% of the way | Use algorithmic humanization with Gaussian distributions, beat-position awareness, and instrument profiles. Simpler, faster, debuggable, and the user can tune parameters |
| **Full Serum 2 preset editor UI** | Building a visual editor for Serum 2 patches is enormous scope; the user has Serum 2's own UI for visual work | Expose parameter control through natural language. "Open filter cutoff to 75%" not "render a knob at position X". Let Claude interpret intent, set parameters |
| **Edison scripting for DSP** | Edison's Python DSP API is sample-level (GetSampleAt/SetSampleAt); writing pitch-shift or reverse at the sample level is reinventing audio processing libraries | Use FL Studio's built-in sample manipulation (Sampler Channel modes, Edison GUI operations via UI automation) rather than raw DSP scripting. Or render externally and reload |
| **Real-time audio streaming** | Processing audio in real-time through the MCP bridge is not feasible; MIDI SysEx is not designed for audio data | Render to file, manipulate file, load file. Batch workflow, not streaming |
| **Automatic genre detection** | Detecting what genre the user is making to auto-configure humanization is fragile and presumptuous | Let the user specify feel: "humanize like jazz" or "tight electronic". Claude interprets intent into humanization parameters |
| **Complex sample synthesis** | Granular synthesis, spectral processing, additive synthesis from scratch | Delegate to Serum 2 which has granular, spectral, and sample oscillator modes built in. Control Serum 2's engine, don't rebuild it |
| **Mixing/mastering in this milestone** | Tempting to add EQ, compression, limiting while we have plugin parameter control | Stay focused on creation pipeline: humanize -> design sound -> render -> manipulate samples. Mixing is v3.0 |

---

## Feature Dependencies (v2.0 Milestone)

```
EXISTING v1.0 (already built):
    Transport, Patterns, Note Generation, Chords, Melody, Bass, Scale Locking
    |
    +-- Humanization Engine (modifies existing note output)
    |       |
    |       +-- Basic: Timing offsets, velocity variation, note length
    |       |       |
    |       |       +-- Swing/groove engine
    |       |       |
    |       |       +-- Per-instrument profiles
    |       |
    |       +-- Advanced: Context-aware timing, beat position, groove templates
    |       |       |
    |       |       +-- Performance artifacts (drift, fatigue)
    |       |
    |       +-- Humanization presets (combine all above)
    |
    +-- Plugin Parameter Control (new bridge capability)
    |       |
    |       +-- Parameter discovery (enumerate params by name)
    |       |       |
    |       |       +-- Parameter get/set (read/write values)
    |       |               |
    |       |               +-- Serum 2 Integration
    |       |               |       |
    |       |               |       +-- Oscillator control
    |       |               |       +-- Filter control
    |       |               |       +-- Macro control
    |       |               |       +-- Effects control
    |       |               |       +-- Preset navigation
    |       |               |       +-- Sound type recipes
    |       |               |
    |       |               +-- [Future: Addictive Drums 2, other plugins]
    |       |
    |       +-- Parameter name caching / mapping
    |
    +-- Audio Rendering (new capability, HIGHEST RISK)
    |       |
    |       +-- Pattern render to WAV
    |       |       |
    |       |       +-- Render with/without FX
    |       |
    |       +-- Sample Loading into Channel
    |               |
    |               +-- Pitch shift / Detune
    |               +-- Reverse
    |               +-- Time stretch
    |               +-- Sample chopping
    |               +-- Layering with processing
    |               |
    |               +-- Full Resampling Workflow (combines all above)
```

### Critical Path Analysis

The three feature tracks (humanization, plugin control, audio rendering) are largely **independent** and can be developed in parallel. However:

1. **Humanization** has the lowest risk -- it only modifies note data that already flows through the system. No new FL Studio API surface needed.

2. **Plugin parameter control** is medium risk -- the `plugins` module API is documented and the functions exist, but Serum 2 parameter discovery needs hands-on testing to verify param names resolve correctly.

3. **Audio rendering** is highest risk -- no confirmed Python API path for rendering patterns to WAV. May require UI automation (keyboard shortcuts via `ui` module) or discovering undocumented capabilities. This is the blocker for the entire sample manipulation track.

---

## Detailed Feature Specifications

### Humanization Engine: How It Should Work

Based on research into HumBeat 2, MidiHumanizer, SmarterHUMANIZE, DAW groove templates, and production best practices:

**Timing Distribution:**
- Use **Gaussian (bell curve) distribution** for timing offsets -- confirmed by HumBeat 2's approach
- NOT uniform random (sounds unnatural, like a drunk robot)
- NOT Perlin/Brownian noise for individual notes (better suited for gradual drift over time)
- Center at 0ms (on-grid), standard deviation configurable per instrument/feel
- Typical ranges: +-3ms (very tight) to +-20ms (loose)

**Velocity Curves by Instrument:**

| Instrument | Base Range | Accent Pattern | Ghost Notes | Consistency |
|------------|-----------|----------------|-------------|-------------|
| Kick drum | 90-110 | Downbeat strong | N/A | HIGH (anchor) |
| Snare | 85-115 | Backbeat strong | 35-50 on ghost | MEDIUM |
| Hi-hat | 65-95 | Downbeat accent at 85-90 | Off-beats at 65-75 | LOW (most varied) |
| Piano | 75-115 | First note of chord slightly louder (95) | N/A | LOW (expressive) |
| Bass | 80-100 | Root notes slightly stronger | N/A | HIGH (anchor) |
| Strings/Pads | 70-90 | Subtle swell patterns | N/A | MEDIUM |

**Swing Formula:**
- Swing percentage S (50-75%, useful range 54-63%)
- For every pair of subdivisions (e.g., 16th notes):
  - First note: stays on grid
  - Second note: shifted by `(S - 50) / 50 * subdivision_length` ticks later
- At 50%: straight feel. At 66.7%: triplet feel. At 58%: typical "Neptunes bounce"

**Performance Drift (Advanced):**
- Brownian motion for gradual tempo drift: each beat's offset = previous offset + small random step
- Standard deviation of step: 1-3ms
- Bounded to prevent runaway: clamp total drift to +-15ms from grid
- Reset drift at section boundaries (verse, chorus transitions)

### Serum 2: Key Parameters to Control

Based on Serum 2 documentation, user guides, and production workflow research:

**Essential Parameters (control these first):**

| Category | Parameter | What It Does | Typical Sound Design Use |
|----------|-----------|-------------|-------------------------|
| Oscillator | Wavetable Position (WT Pos) | Moves through wavetable frames, changing timbre | Automate for evolving textures |
| Oscillator | Unison Voices | 1-16 voices per osc for thickness | 4-7 for pads/leads, 1 for clean basses |
| Oscillator | Unison Detune | Spread between unison voices | Low for subtle width, high for super-saw |
| Oscillator | Oscillator Level | Volume of each osc | Balance between oscillators |
| Filter | Cutoff Frequency | Brightness control | Most-tweaked parameter in any synth |
| Filter | Resonance | Emphasis at cutoff point | Creates character; high for acid sounds |
| Filter | Drive | Saturation in filter circuit | Adds warmth and grit |
| Envelope | Attack | How fast sound reaches full volume | Short for plucks/drums, long for pads |
| Envelope | Decay | How fast sound drops to sustain level | Short for plucks, medium for keys |
| Envelope | Sustain | Held volume level | Low for plucks, high for pads/leads |
| Envelope | Release | How long sound fades after note off | Short for tight, long for atmospheric |
| Macros 1-8 | Assignable | Multiple params at once | "Energy", "Atmos", "Tension", "Brightness" |
| Effects | Reverb Mix | Space and depth | 10-30% for presence, 50%+ for ambient |
| Effects | Delay Mix | Rhythmic echoes | Sync to tempo for rhythmic interest |
| Effects | Distortion Drive | Aggression and harmonics | Subtle for warmth, heavy for aggressive |
| Effects | Chorus/Phaser Rate | Movement and width | Slow for subtle, fast for vibrato |

**Sound Type Recipes:**

| Sound Type | Key Settings | Character |
|------------|-------------|-----------|
| Warm Pad | Slow attack (300-800ms), long release (1-3s), low-pass filter at ~60%, chorus on, reverb 30-50% | Soft, enveloping, background texture |
| Aggressive Bass | Fast attack (<10ms), short decay, low sustain, high-pass + distortion, sub osc, unison 1-3 | Punchy, gritty, front-and-center |
| Pluck Lead | Near-zero attack, short decay (100-300ms), no sustain, bright filter, slight reverb | Percussive, melodic, rhythmic |
| Super Saw Lead | Medium attack (20-50ms), full sustain, unison 5-7 with wide detune, high-pass, delay | Big, wide, anthem-style |
| Dark Ambient | Long attack, long release, low-pass filter with slow LFO, heavy reverb, granular osc | Evolving, atmospheric, textural |

### Audio Rendering: What We Know and Don't Know

**CONFIRMED (HIGH confidence):**
- FL Studio can render patterns to WAV via GUI (right-click -> "Render as audio clip")
- Consolidate feature (Ctrl+Alt+C) offers render options dialog
- "Render as audio clip" produces dry audio (no mixer FX)
- "Consolidate" can include mixer FX, render tails, quality settings
- Rendered audio clips appear in the Playlist automatically

**CONFIRMED -- API exists for related operations (MEDIUM confidence):**
- `channels.setChannelPitch()` can pitch-shift samples in channels (mode 0 and 1 work; mode 2 broken)
- `plugins.setParamValue()` can control plugin parameters including Sampler Channel properties
- Edison has Python DSP scripting (sample-level: GetSampleAt, SetSampleAt, NormalizeFromTo)
- `ui` module can trigger UI actions (may enable keyboard shortcut triggering for render)

**UNKNOWN -- Needs hands-on validation (LOW confidence):**
- Whether `ui` module can trigger "Render as audio clip" menu action
- Whether keyboard shortcuts (Ctrl+Alt+C) can be sent programmatically via `ui.keyCommand()` or similar
- Whether samples can be loaded into new channels programmatically (no `channels.loadSample()` found)
- Whether Edison can be opened and controlled programmatically for reverse/stretch operations
- Whether Sampler Channel's "Reverse" option can be toggled via the API

### Sample Manipulation: Techniques and Implementation Paths

| Technique | Production Use | Implementation Path | Risk |
|-----------|---------------|-------------------|------|
| **Pitch down octave** | Dark textures, sub basses, slowed-down aesthetic | `channels.setChannelPitch(idx, -1200, mode=1)` for -1200 cents = -12 semitones | LOW -- API confirmed |
| **Pitch up octave** | Bright textures, chipmunk effects, layering | `channels.setChannelPitch(idx, 1200, mode=1)` for +1200 cents | LOW -- API confirmed |
| **Detune +-5-15 cents** | Stereo width, thickness, chorus effect | `channels.setChannelPitch(idx, cents, mode=1)` on duplicated channels | LOW -- API confirmed |
| **Reverse** | Atmospheric swells, transitions, pads | Sampler Channel may have reverse toggle; Edison can reverse but API access unclear | HIGH -- unconfirmed API path |
| **Chop/slice** | Rhythmic rearrangement, beat making | Fruity Slicer or Slicex; programmatic access unconfirmed | HIGH -- unconfirmed API path |
| **Time stretch** | Fit sample to tempo without pitch change | Sampler Channel "Stretch" mode; API access to mode setting unconfirmed | MEDIUM -- Sampler has the mode, API path unclear |
| **Layer copies** | Stereo width via L+R detune, parallel processing | Create two channels with same sample, different pitch/pan | LOW -- channel creation + pitch API works |

---

## MVP Recommendation for v2.0

### Phase 1: Humanization Engine
**Why first:** Lowest risk, immediate impact, builds on existing note generation. No new FL Studio API surface needed -- just modifies note timing/velocity/length before they're written to the piano roll.

Must build:
1. Gaussian timing offset engine
2. Velocity variation with instrument profiles
3. Swing/groove percentage control
4. Note length variation
5. At least 3-4 humanization presets ("tight", "loose", "jazz", "lo-fi")

### Phase 2: Plugin Parameter Control + Serum 2
**Why second:** Medium risk. API functions are documented. Needs hands-on testing for Serum 2 parameter discovery, but the `plugins` module functions exist.

Must build:
1. Parameter discovery (enumerate and cache param names/indices)
2. Parameter get/set by name
3. Serum 2 parameter mapping (essential params listed above)
4. Preset navigation
5. Sound type recipes (at least pad, bass, lead, pluck)

### Phase 3: Audio Rendering + Sample Manipulation
**Why third:** Highest risk. Audio rendering has no confirmed API path. Needs exploratory development to find what works. Sample manipulation depends on rendering working.

Must build:
1. Pattern render to WAV (discover working method)
2. Sample loading into channel
3. Pitch shift and detune
4. Basic resampling workflow

Defer to later:
- Reverse (depends on finding API path)
- Chopping (depends on Slicer/Slicex API access)
- Full resampling loop (depends on all above working)

---

## Sources

### Official Documentation (HIGH confidence)
- [FL Studio Python API - Plugins Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/) -- setParamValue, getParamValue, getParamCount, getParamName signatures
- [FL Studio Python API - Channels Properties](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/properties/) -- setChannelPitch, setChannelVolume, setChannelPan signatures
- [FL Studio Python API - Transport Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/) -- confirmed no render functions exist
- [FL Studio Python API - Edison Sample](https://il-group.github.io/FL-Studio-API-Stubs/edison_scripting/enveditor/sample/) -- GetSampleAt, SetSampleAt, NormalizeFromTo (no reverse/pitch-shift)
- [Serum 2 Official Product Page](https://xferrecords.com/products/serum-2) -- 3 oscillators, 5 synthesis modes, 8 macros, effects list
- [FL Studio Keyboard Shortcuts](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/basics_shortcuts.htm) -- Ctrl+Alt+C consolidate, render shortcuts

### Product Research (MEDIUM confidence)
- [HumBeat 2 Drum Humanizer](https://developdevice.com/products/humbeat-2-0-the-ultimate-midi-drum-humanizer) -- Gaussian distribution, +-20ms timing, instrument-specific velocity, fatigue modeling
- [Serum 2 Advanced Features (Splice)](https://splice.com/blog/serum-2-advanced-features/) -- modulation matrix, macros, oscillator details
- [Serum 2 Beginner Guide (EDMProd)](https://www.edmprod.com/serum-2-guide/) -- workflow and parameter overview
- [Serum 2 Performance Macros (Mind Flux)](https://www.mind-flux.com/news-1/2025/11/10/linking-modulation-to-performance-macros-in-serum-2-turning-movement-into-performance) -- macro assignment patterns
- [Serum 2 Full Feature Breakdown (Sonic Weaponry)](https://sonic-weaponry.com/blogs/free-production-tutorials-and-resources/serum-2-released) -- oscillator types, modulation details

### Production Technique Guides (MEDIUM confidence)
- [Swing, Shuffle, and Humanization (Sample Focus)](https://blog.samplefocus.com/blog/swing-shuffle-and-humanization-how-to-program-grooves/) -- swing percentages, timing formulas
- [Humanizing MIDI Drums (Production Music Live)](https://www.productionmusiclive.com/blogs/news/humanizing-midi-drums) -- 5-20ms timing offsets, velocity ranges
- [How to Humanize MIDI (Unison Audio)](https://unison.audio/how-to-humanize-midi/) -- velocity values per instrument, ghost notes
- [Humanizing MIDI Drums (Mix Elite)](https://mixelite.com/blog/humanizing-midi-drums/) -- beat position timing, note length variation
- [Detuning Audio Clips (ModeAudio)](https://modeaudio.com/magazine/out-of-phase-detuning-audio-clips) -- +-5-15 cents standard range
- [Layering Synths (Triple A Beats)](https://www.tripleabeats.com/blogs/how-to-layer-synths-for-a-rich-professional-sound) -- detune layering for stereo width

### Forum / Community (LOW confidence)
- [FL Studio Forum: Rendering Patterns to Audio](https://forum.image-line.com/viewtopic.php?t=324022) -- GUI-only render confirmation
- [FL Studio Forum: Channel Pitch and Automation](https://forum.image-line.com/viewtopic.php?t=323644) -- setChannelPitch mode 2 broken
- [Xfer Serum 2 Changelog](https://gist.github.com/0xdevalias/a537a59d1389d5aed3bc63b544c70c8d) -- parameter index offset bug fixed in 2.0.17
- [Gaussian Humanization JSFX (Cockos Forum)](https://forum.cockos.com/showthread.php?t=234279) -- Gaussian approach for REAPER
- [midihum ML Humanizer](https://www.erichgrunewald.com/posts/introducing-midihum-an-ml-based-midi-humanizing-tool/) -- ML approach with gradient boosted trees (complex, not recommended for our use)
