# Pitfalls Research: Production Pipeline (Milestone v2.0)

**Domain:** DAW automation -- humanization, VST plugin control, audio rendering, sample manipulation
**Researched:** 2026-02-23
**Confidence:** MEDIUM (mix of official FL Studio API docs, community knowledge, and music production best practices)

**Context:** This document covers pitfalls specific to ADDING humanization, Serum 2 integration, audio rendering, and sample manipulation to the existing FL Studio MCP server. The existing system already handles note generation via SysEx-over-MIDI and embedded .pyscript files.

---

## Critical Pitfalls

### Pitfall 1: Uniform Random Humanization Sounds Worse Than Quantized

**What goes wrong:**
Applying `Math.random() * range` to timing and velocity produces output that sounds "drunk" or "noisy" rather than human. Users disable the feature because the original quantized version sounded better.

**Why it happens:**
Human performance timing follows brownian noise (random walk) patterns -- deviations are cumulative and drift gradually before returning to tempo. Uniform random distribution ("white noise") produces independent, uncorrelated deviations that no human would ever produce. A real drummer who rushes beat 2 will likely still be slightly ahead on beat 3, gradually returning to center. Uniform random makes each note independently wrong.

**How to avoid:**
1. Use brownian/random-walk model: each note's offset is the previous offset plus a small delta, with a spring constant pulling back toward zero
2. Implement separate models for timing, velocity, and duration -- they should correlate (harder hits are often slightly early)
3. Use Gaussian distribution for deltas, not uniform. Standard deviation of ~5-15ms for timing, ~5-15 velocity units for dynamics
4. Constrain maximum drift: if cumulative offset exceeds a threshold (~30ms), increase spring pull-back strength
5. Make humanization amount a parameter (0.0 to 1.0) that scales the variance, not the maximum offset

**Warning signs:**
- A/B testing where quantized sounds better
- Timing offsets that feel "jittery" rather than "flowing"
- No perceptible groove or feel -- just noise on top of grid
- Users consistently turn humanization off

**Phase to address:** Humanization Engine (first phase of this milestone)

**Sources:** [MIDI Humanizer (brownian noise approach)](https://github.com/vincerubinetti/midi-humanizer), [Splice: Humanize Your Drums](https://splice.com/blog/humanize-your-drums/), [Unison: How to Humanize MIDI](https://unison.audio/how-to-humanize-midi/)

---

### Pitfall 2: Context-Free Velocity Humanization

**What goes wrong:**
Randomizing velocity uniformly across all notes ignores musical context. Downbeats should be stronger, ghost notes should be soft, phrases should have dynamic arcs. Random velocity variation destroys these patterns instead of enhancing them.

**Why it happens:**
Developers treat velocity humanization as a post-processing filter that adds noise, when it should be a musical modeling system that creates dynamic contour. Real performers emphasize downbeats by 10-20 velocity points, play ghost notes at 30-50% of full velocity, and build intensity across phrases.

**How to avoid:**
1. Implement beat-position awareness: notes on beat 1 get accent boost, notes on "e" and "a" get ghost-note reduction
2. Create a velocity envelope that follows musical phrasing (build up before chorus, pull back in verse)
3. Separate "accent pattern" (deterministic, beat-aware) from "humanization jitter" (small random variation around the accent pattern)
4. For drums specifically: kick at 100-115, snare at 90-110, ghost notes at 35-50, hi-hat with gradual accent cycling
5. Allow velocity curve presets per instrument type (drums, piano, bass have different patterns)

**Warning signs:**
- Downbeats are sometimes softer than upbeats
- Ghost notes and accented notes have similar velocity
- Pattern loses groove after humanization
- Hi-hat patterns lose their accent cycle

**Phase to address:** Humanization Engine

**Sources:** [Slam Tracks: 5 Secrets to Humanizing MIDI Drums](https://www.slamtracks.com/2025/12/20/5-secrets-to-humanizing-midi-drums/), [Unison: 20+ Pro Tips](https://unison.audio/how-to-humanize-midi/)

---

### Pitfall 3: Swing Implementation as Linear Interpolation

**What goes wrong:**
Swing is implemented by shifting every even-numbered subdivision by a fixed percentage, producing a mechanical shuffle rather than a musical groove. Real swing is not mathematically precise -- it varies throughout a performance.

**Why it happens:**
Most DAW swing implementations ARE linear percentage-based (50% = no swing, 67% = triplet swing). Developers copy this approach without adding the humanization layer on top. The result is a perfectly regular shuffle, which is still robotic.

**How to avoid:**
1. Implement percentage-based swing as the foundation (shift even subdivisions forward): this part IS standard
2. Layer humanization on TOP of swing -- the swing grid is the new "center" around which brownian drift operates
3. Swing percentage should be per-instrument (hi-hats may swing more than kick)
4. Apply swing BEFORE humanization, not after. Humanization should be relative to the swung position, not the original grid
5. Typical range: 50-75% for most genres. Triplet swing is ~67%. MPC-style swing is ~62-66%

**Warning signs:**
- Swing sounds like a metronome with uneven beats (perfectly regular shuffle)
- Instruments that should have different swing amounts all shuffle identically
- Swing + humanization applied in wrong order produces double-offset

**Phase to address:** Humanization Engine

**Sources:** [Apple Logic Pro: Quantize Parameters](https://support.apple.com/guide/logicpro/quantize-parameter-values-lgcp47452db8/mac), [Sweetwater: When to Quantize](https://www.sweetwater.com/insync/quantization-when-and-when-not-to-quantize/)

---

### Pitfall 4: VST Parameter Index Instability with 4240-Parameter Space

**What goes wrong:**
FL Studio reports 4240 parameters for every VST plugin (4096 standard + 128 MIDI CC + 16 aftertouch). Most of these have blank names or are unused. Code that hardcodes parameter indices breaks when the plugin updates, and iterating all 4240 parameters to find one by name is slow and unreliable.

**Why it happens:**
FL Studio's `plugins.getParamCount()` returns 4240 for VSTs regardless of how many the plugin actually exposes. Many parameters return empty strings from `plugins.getParamName()`. Parameter indices are positional and can shift between plugin versions. There is a known, long-standing FL Studio bug where `getParamValue` returns incorrect values for some VSTs.

**How to avoid:**
1. Build a parameter discovery layer that runs once per plugin instance: iterate parameters, filter out blank/unnamed ones, cache the name-to-index mapping
2. Never hardcode parameter indices -- always resolve by name at runtime
3. Cache parameter maps per plugin-name + plugin-version combination, not globally
4. For Serum 2 specifically: pre-build a known parameter map but validate it against runtime discovery
5. Handle blank parameter names gracefully -- log them, skip them, don't crash
6. Implement fuzzy matching for parameter names (Serum may report "Osc A Level" while user says "oscillator A volume")
7. Add a `plugin.discover` MCP tool so users can see available parameters

**Warning signs:**
- `getParamName(i, channel)` returns empty string for most indices
- Parameter automation affects wrong knob after plugin update
- Discovery scan takes multiple seconds due to 4240 iterations
- Same parameter name appears at different indices on different machines

**Phase to address:** Generic Plugin Control (before Serum 2 integration)

**Sources:** [FL Studio API Stubs - Plugins Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/), [FL Studio VST3 Parameter ID Issue](https://forum.image-line.com/viewtopic.php?t=299601)

---

### Pitfall 5: getParamValue Unreliable for VSTs -- Shadow State Required

**What goes wrong:**
Attempting to implement "relative" parameter adjustments ("make it brighter") fails because `plugins.getParamValue()` returns incorrect values for many VST plugins. The system cannot know the current state to make relative changes.

**Why it happens:**
This is a known, long-standing FL Studio bug. `getParamValue` works for FL Studio native plugins but is broken for many third-party VSTs. The FL Studio team has acknowledged this but has not fixed it as of current versions. This means you cannot query "what is the current filter cutoff" and then add 10% to it.

**How to avoid:**
1. Maintain shadow state: every time you call `setParamValue()`, record the value in a local cache (Node.js side)
2. For initial state: either assume defaults (0.5 for most parameters) or require a "sync" operation where the user manually reports current state
3. Design all parameter modifications as ABSOLUTE, not relative: "set filter cutoff to 0.7" not "increase filter cutoff by 10%"
4. When relative adjustments are needed, use shadow state as the base, with a warning that shadow state may be stale if user tweaked the plugin manually
5. Provide a "reset to known state" command that sets all tracked parameters to their shadow values
6. Test `getParamValue` specifically with Serum 2 early -- it may work for Serum 2 even if broken for other VSTs

**Warning signs:**
- `getParamValue` returns 0.0 for parameters that are clearly not at zero
- "Increase brightness" makes the sound darker (because initial read was wrong)
- Relative adjustments produce inconsistent results

**Phase to address:** Generic Plugin Control

**Sources:** [Will the Python API get fixed?](https://forum.image-line.com/viewtopic.php?t=272593), [FL Scripting API Functionality](https://forum.image-line.com/viewtopic.php?t=309492)

---

### Pitfall 6: No Programmatic Audio Rendering in FL Studio Python API

**What goes wrong:**
The team plans to render MIDI to audio programmatically, but discovers there is NO function in the FL Studio MIDI Controller Scripting API to trigger a render/export. The `general` module provides state queries and undo, not rendering. Audio rendering is a GUI-only operation.

**Why it happens:**
FL Studio's Python API is explicitly designed to NOT "alter the end user's PC in any way" for security reasons. Rendering creates files on disk, which violates this constraint. The export function is only accessible via File > Export in the GUI.

**How to avoid:**
1. Accept that fully automated rendering is not possible via the current API
2. Explore keyboard shortcut simulation: FL Studio's `ui` module or `transport` module may allow triggering the export dialog
3. Investigate using `ui.escape()`, `ui.enter()`, and keyboard simulation to navigate the export dialog
4. Alternative: use FL Studio's command-line rendering (FL Studio supports `/R` flag for batch rendering from command line) -- but this requires closing and reopening the project
5. Alternative: record audio output in real-time through an audio routing solution (e.g., VB-CABLE capturing FL Studio's audio output to WAV)
6. Design the resampling workflow around what IS possible: manually export, then use Node.js to manipulate the resulting WAV file
7. Flag this as a major constraint in planning -- do not promise automated render without validating a workaround first

**Warning signs:**
- Cannot find `render`, `export`, or `save` functions in the API stubs
- Planning renders as a feature but have no implementation path
- Users expect "render this pattern" but get silence

**Phase to address:** Audio Rendering (needs feasibility spike BEFORE committing to implementation)

**Sources:** [FL Studio MIDI Scripting Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm), [FL Studio Python API - General Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/)

---

### Pitfall 7: No Programmatic Sample Loading into Channels

**What goes wrong:**
The team plans sample manipulation workflows (pitch-shift, reverse, layer) that require loading WAV files into FL Studio channels programmatically, but the `channels` module has no `loadSample` or `setChannelSamplePath` function.

**Why it happens:**
The channels API provides property access (name, color, volume, pan, pitch, mute, solo, target mixer track) and selection management, but no file loading. Like rendering, loading files from disk violates FL Studio's security model for MIDI scripts.

**How to avoid:**
1. Accept that automated sample loading may not be possible via current API
2. Investigate drag-and-drop simulation or clipboard-based approaches
3. Alternative approach: manipulate audio OUTSIDE FL Studio entirely (in Node.js using libraries like `audiobuffer-to-wav`, `soundfile`, or FFmpeg) and provide the user with a file path to drag into FL Studio
4. For Edison-based manipulation: Edison has its own Python scripting with `Sample` class that supports per-sample read/write, amplitude, normalization, and silence operations -- but Edison scripts are separate from MIDI controller scripts and cannot be triggered programmatically
5. Design the workflow as "prepare + instruct": Node.js does the DSP, saves the file, and tells the user where to find it
6. Test whether `channels.getChannelType()` and related functions can at least detect what type of plugin is loaded

**Warning signs:**
- Cannot find sample loading functions in channel API docs
- Building sample manipulation features that have no way to get results back into FL Studio
- Users expect seamless "render and reload" but get manual steps

**Phase to address:** Sample Manipulation (needs feasibility spike)

**Sources:** [FL Studio Channels Properties API](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/properties/)

---

## Moderate Pitfalls

### Pitfall 8: SysEx Message Size Limits for Large Payloads

**What goes wrong:**
When sending large parameter maps (e.g., Serum 2 with hundreds of parameters) or long note lists through SysEx, messages exceed buffer limits in the MIDI driver chain, causing silent truncation or corruption.

**Why it happens:**
While the MIDI spec has no hard SysEx size limit, practical limits exist at every layer: loopMIDI buffers, Windows MIDI API buffers, the `node-midi` library (RtMidi wrapper), and FL Studio's own SysEx receive buffer. The current system already uses base64 encoding which inflates payload size by ~33%. A JSON payload with 200+ parameter names and values, base64-encoded, could easily exceed 10KB.

**How to avoid:**
1. Implement message chunking: split large payloads across multiple SysEx messages using the continuation byte (byte 4 in the protocol, currently unused -- set to 0x00 for final, 0x01 for continued)
2. Set a conservative max payload size per message (2KB before base64 encoding, ~2.7KB after)
3. On the receiving side (FL Bridge), implement a reassembly buffer that concatenates chunks before parsing
4. For parameter discovery responses, paginate: send 50 parameters per message, not all 4240
5. Test maximum reliable SysEx size through loopMIDI empirically before committing to a chunk size
6. Consider compressing JSON payloads before base64 encoding (unlikely to help much with short key names)

**Warning signs:**
- Large commands silently fail (no response at all)
- Responses are truncated mid-JSON
- Works with small parameter sets but fails with large ones
- Intermittent failures that correlate with payload size

**Phase to address:** Generic Plugin Control (when parameter discovery responses get large)

**Sources:** [REAPER 32KB SysEx limit](https://forum.cockos.com/archive/index.php/t-108481.html), [SysEx size discussion](https://linux-audio-dev.linuxaudio.narkive.com/38cqgyIG/lad-maximum-size-of-sysex-messages-in-jack-midi-and-alsa-sequencer)

---

### Pitfall 9: Timeout Issues for Long-Running Operations

**What goes wrong:**
The MCP server's default 5-second timeout (defined in `midi-client.ts`) causes parameter discovery, batch parameter setting, or any future rendering trigger to fail with "Command timeout" before the operation completes.

**Why it happens:**
The current system was designed for quick operations (transport control, state reading) that complete in milliseconds. Parameter discovery iterating 4240 parameters, or setting 50+ parameters sequentially, can take multiple seconds. Rendering (if a workaround is found) could take 30+ seconds. The 5-second timeout is hardcoded as `DEFAULT_TIMEOUT`.

**How to avoid:**
1. Make timeout configurable per command type: quick operations (transport, state) keep 5s, parameter discovery gets 30s, rendering gets 120s
2. Implement progress feedback: for long operations, FL Bridge sends intermediate "still working" heartbeat messages that reset the timeout
3. For parameter discovery: do it lazily (discover on first access) rather than all-at-once
4. For batch parameter setting: send individual set commands rather than one giant batch (each completes quickly)
5. Add timeout parameter to `sendCommand()` calls in the MCP tools layer

**Warning signs:**
- "Command timeout" errors when listing plugin parameters
- Operations that work on simple plugins fail on complex ones (Serum 2)
- Rendering trigger times out before render completes

**Phase to address:** Generic Plugin Control (must handle before Serum 2 discovery)

---

### Pitfall 10: Operation Unsafe at Current Time During Plugin Parameter Modification

**What goes wrong:**
Setting plugin parameters during playback or at the wrong time triggers "Operation unsafe at current time" TypeError, causing parameter changes to silently fail.

**Why it happens:**
FL Studio enforces PME (Performance, Modify, Execute) flags that restrict when state-modifying operations are safe. The flags `PME_System` (bit 1) and `PME_System_Safe` (bit 2) must be set for parameter modifications. During modal dialogs, rendering, or certain playback states, these flags are unset.

**How to avoid:**
1. Check PME flags before calling `plugins.setParamValue()` -- use bitwise AND with `midi.PME_System`
2. Implement a safe-operation decorator that catches TypeError and retries on next OnIdle cycle
3. Queue parameter changes and apply them when flags permit
4. If a parameter set fails due to safety, report the failure to the MCP server (don't silently swallow it)
5. Test parameter modification during: playback, recording, idle, and with modal dialogs open

**Warning signs:**
- Parameter changes work when stopped but fail during playback
- Intermittent "Operation unsafe" errors in Script output
- Plugin parameters appear to not change (error was caught but not reported)

**Phase to address:** Generic Plugin Control

**Sources:** [FL Studio PME Flags](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/midi/pme%20flags/), [FL Classes Safety](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/fl_classes/)

---

### Pitfall 11: Serum 2 Parameter Complexity and Naming Inconsistency

**What goes wrong:**
Serum 2 has 3 oscillators, 2 filters, 6 LFOs, 4 envelopes, 8 macros, multiple effects, and wavetable parameters -- potentially hundreds of meaningful parameters. The parameter names as reported by `getParamName()` may not match what users expect (internal names vs. UI labels), and some parameters may have duplicate or ambiguous names.

**Why it happens:**
Serum 2 is a VST3 plugin with extensive parameter automation support. FL Studio's 4096-parameter slot approach means many slots are unused or have cryptic names. The mapping between Serum 2's UI (which shows "Osc A Octave" or "Filter 1 Cutoff") and the parameter names reported to FL Studio via VST3 may differ.

**How to avoid:**
1. Build Serum 2 integration in two phases: first generic plugin control (works with any VST), then Serum-specific aliases and semantic grouping
2. Create a Serum 2 parameter alias table: map user-friendly names ("filter cutoff") to discovered parameter names ("Fltr1_Freq" or whatever FL Studio reports)
3. Run parameter discovery on Serum 2 early and store the results -- this is a research spike that should happen before coding Serum 2 features
4. Group parameters semantically: oscillators, filters, envelopes, LFOs, FX, macros, global
5. Provide a "search parameters" tool that does fuzzy matching against parameter names
6. Do NOT try to map all hundreds of Serum 2 parameters upfront -- start with the most commonly used (filter, oscillator level, macro assignments, basic FX) and expand based on actual usage

**Warning signs:**
- Parameter names from FL Studio don't match Serum 2 UI labels
- Multiple parameters with similar names (e.g., "Level" for each oscillator)
- Users request parameters that don't map to any discovered name
- Parameter mapping works in Serum 1 but breaks in Serum 2

**Phase to address:** Serum 2 Integration (after generic plugin control is working)

**Sources:** [Serum 2 Features](https://xferrecords.com/products/serum-2), [Serum 2 Advanced Tips](https://www.noiseharmony.com/post/17-advanced-tips-for-serum-2)

---

### Pitfall 12: Humanization Applied to Already-Humanized Notes (Double Humanization)

**What goes wrong:**
User says "humanize this pattern" multiple times, and each application adds another layer of random variation. After 3-4 applications, the pattern is unrecognizably sloppy. There is no way to "undo" humanization or return to the original grid.

**Why it happens:**
Humanization is destructive -- once timing/velocity offsets are baked into note data, the original grid positions are lost. The system has no concept of "original position" vs. "current humanized position." Each humanization pass treats the current position as the grid reference.

**How to avoid:**
1. Store original grid-quantized note data alongside humanized output
2. Implement "re-humanize" (reset to grid, then apply new humanization) as distinct from "add more humanization"
3. Track whether a pattern has been humanized (metadata flag) and warn before applying again
4. Make humanization non-destructive: apply it at RENDER time, not at note-creation time, so the stored notes are always clean
5. Alternative: store humanization parameters separately and recalculate offsets deterministically from a seed, so humanization can be adjusted without re-applying
6. Provide "quantize" tool as the inverse of humanize

**Warning signs:**
- Users complain about "sloppy" notes after multiple humanize commands
- No way to undo humanization back to clean grid
- A/B comparison impossible because original data is gone

**Phase to address:** Humanization Engine (design decision -- non-destructive vs. destructive)

---

### Pitfall 13: State Synchronization Drift Between Node.js and FL Studio

**What goes wrong:**
The Node.js MCP server's understanding of FL Studio state (which pattern is selected, what parameters are set, what notes exist) diverges from actual FL Studio state. User makes manual changes in FL Studio that the MCP server doesn't know about, leading to commands that operate on stale assumptions.

**Why it happens:**
FL Studio has no push notification system -- the MIDI controller script can only respond to queries, not proactively notify about state changes. If the user manually changes the selected pattern, tweaks a synth knob, or adds notes by hand, the MCP server doesn't know. Shadow state (Pitfall 5) makes this worse because the cache can be arbitrarily stale.

**How to avoid:**
1. Query state fresh before any operation that depends on it (don't cache pattern selection)
2. For shadow state (plugin parameters): add timestamps and warn when shadow state is old
3. Implement a "sync" command that refreshes all cached state
4. Design commands to be idempotent where possible: "set pattern 3 as current" rather than "go to next pattern"
5. Accept that some manual changes will go undetected -- document this limitation
6. Consider polling in OnIdle: FL Bridge could detect state changes and push updates, but this adds complexity and performance cost
7. For plugin parameters specifically: always re-read state before relative operations (even if getParamValue is unreliable -- at least try)

**Warning signs:**
- "Add notes to current pattern" adds to wrong pattern because user switched manually
- Plugin parameter shadow state shows cutoff at 0.5 but user tweaked it to 0.8
- Commands produce unexpected results after user touches FL Studio directly

**Phase to address:** All phases (ongoing concern -- design principle, not one-time fix)

---

## Minor Pitfalls

### Pitfall 14: Windows File Path Issues for Audio Files

**What goes wrong:**
File paths containing unicode characters, spaces, or exceeding 260 characters cause failures when reading/writing audio files (rendered WAV, sample files, Splice downloads).

**Why it happens:**
Windows has a 260-character MAX_PATH limit by default. Splice sample paths can be deeply nested with long names. FL Studio's Python 3.9 interpreter may not handle extended-length paths (`\\?\` prefix). Node.js handles long paths better but must be configured.

**How to avoid:**
1. Use raw strings or forward slashes in Python paths
2. On Node.js side, use `path.resolve()` and handle paths consistently
3. Test with Splice sample paths (typically `C:\Users\...\Splice\Sounds\...` with long folder names)
4. If writing rendered audio, use short output directory names
5. Validate file paths before operations -- check existence and accessibility
6. Handle `ENOENT` and `EPERM` errors gracefully with user-friendly messages

**Warning signs:**
- Audio operations fail on some users' machines but not others
- Paths with spaces or unicode characters cause crashes
- File not found errors for files that clearly exist

**Phase to address:** Audio Rendering / Sample Manipulation

---

### Pitfall 15: Over-Humanizing Fast Passages, Under-Humanizing Slow Passages

**What goes wrong:**
A fixed humanization amount (e.g., +/- 20ms timing offset) sounds appropriate for quarter notes at 120 BPM but is far too much for rapid 16th notes (where the gap between notes is only ~125ms) and imperceptible for whole notes (where 20ms of 2000ms is negligible).

**Why it happens:**
Humanization amount is set as an absolute time value rather than being relative to the note density or tempo. At high note densities, 20ms is 16% of the inter-note interval; at low densities, it is 1%.

**How to avoid:**
1. Scale humanization amount relative to the current note spacing or subdivision grid
2. Make humanization tempo-aware: reduce absolute offsets at higher tempos
3. For rapid passages (32nd notes, drum rolls), use much tighter humanization (3-5ms)
4. For slow passages, increase humanization range proportionally
5. Consider using a percentage of the beat subdivision rather than absolute milliseconds

**Warning signs:**
- Fast drum fills become unintelligible mush
- Slow passages sound perfectly quantized despite humanization being "on"
- Same settings produce good results at 100 BPM but bad results at 160 BPM

**Phase to address:** Humanization Engine

---

### Pitfall 16: Edison Scripts Cannot Be Triggered From MIDI Controller Scripts

**What goes wrong:**
Developers discover that Edison has sample manipulation capabilities (per-sample read/write, amplitude, normalization, sine generation) and try to trigger Edison scripts from the MIDI controller script, but the two scripting systems are completely separate and cannot communicate.

**Why it happens:**
FL Studio has THREE separate Python scripting environments: MIDI Controller Scripts (the FL Bridge), Piano Roll Scripts (ComposeWithBridge.pyscript), and Edison/Audio Scripts. Each runs in its own interpreter with different available modules. There is no inter-script communication mechanism.

**How to avoid:**
1. Do NOT plan to use Edison scripting for sample manipulation -- it cannot be triggered programmatically from MIDI scripts
2. Do sample manipulation in Node.js using JavaScript audio libraries instead
3. If Edison-style DSP is needed, implement it in Node.js (JavaScript can do the same per-sample math)
4. The only connection path from MCP server to Edison would be: write an Edison .pyscript file (like ComposeWithBridge), then instruct user to open Edison and run the script manually -- but this is a poor UX

**Warning signs:**
- Attempting to import Edison modules from MIDI controller script
- Planning features that require Edison scripting to be automated
- Assuming one Python environment can access another

**Phase to address:** Architecture design (decide early: all DSP in Node.js)

**Sources:** [Edison Audio Scripting API](https://il-group.github.io/FL-Studio-API-Stubs/edison_scripting/)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded Serum 2 parameter indices | Quick integration | Breaks on plugin update | Never -- always use name-based resolution |
| Single timeout for all operations | Simple code | Parameter discovery and rendering timeout | Only in initial prototype |
| Uniform random for humanization | Easy to implement | Sounds bad, users disable feature | Never -- brownian walk is not harder to implement |
| No message chunking | Simple protocol | Large payloads silently fail | Until plugin control is added (small payloads are fine for notes) |
| Destructive humanization (no undo) | Less state to manage | Users cannot iterate on humanization | Only if "re-humanize from grid" is available |
| No shadow state for plugin params | Fewer moving parts | Cannot do relative adjustments | Only if all commands are absolute-value only |
| Ignoring PME flags | Simpler handler code | Intermittent failures during playback | Never -- always check or catch TypeError |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Serum 2 via plugins module | Iterating all 4240 parameters every time | Cache parameter map on first discovery, invalidate on plugin change |
| SysEx for large payloads | Sending >5KB in single SysEx message | Implement chunking using continuation byte |
| Plugin setParamValue | Calling during unsafe state | Check PME flags or catch TypeError with retry |
| Plugin getParamValue | Trusting returned value | Maintain shadow state, treat reads as unreliable |
| Audio rendering | Expecting API function exists | No render API -- need UI automation or external workaround |
| Sample loading | Expecting channels.loadSample() | No such function -- manipulate audio in Node.js, provide path to user |
| Edison DSP | Trying to trigger from MIDI script | Use Node.js for DSP, Edison scripts are isolated |
| Humanization timing | Applying fixed ms offset regardless of tempo | Scale offsets relative to tempo and note subdivision |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full parameter discovery (4240 iterations) on every command | Multi-second delays, possible timeout | Cache after first scan, lazy discovery | First time a plugin control command runs |
| Sending parameter names in every response | Large SysEx messages, slow responses | Send parameter map once, reference by index afterward | When returning data for complex plugins (>100 params) |
| Humanization recalculating for every note independently | Slow for large patterns | Pre-calculate humanization curve for the whole pattern at once | Patterns with >200 notes |
| Debug print statements in production | FL Studio memory leak, slowdown | Conditional logging with production flag | Long sessions (>30 min) with verbose logging |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Humanize" produces worse results than quantized | User loses trust, disables feature | Use brownian walk, provide A/B preview |
| Rendering requires manual steps (File > Export) | Breaks flow, defeats purpose of automation | Be transparent about limitation; automate what's possible |
| "Set filter cutoff" changes wrong parameter | User thinks tool is broken | Validate parameter name match, confirm before changing |
| No way to undo humanization | User stuck with bad results | Store original + humanized; provide re-humanize and quantize |
| Plugin parameter changes fail silently during playback | User repeats command, nothing happens | Report PME flag conflicts; suggest stopping playback |
| "Make it brighter" fails because current state unknown | Relative adjustments unreliable | Default to absolute: "Set brightness to 70%" |

## "Looks Done But Isn't" Checklist

- [ ] **Humanization:** Sounds good on isolated drums -- verify it also sounds good on melodic instruments (piano, strings), and at different tempos (80, 120, 160 BPM)
- [ ] **Humanization:** Works for 4/4 time -- verify it handles 3/4, 6/8, 5/4, and odd meters
- [ ] **Plugin discovery:** Works for Serum 2 -- verify it works for other VSTs (Vital, Diva, native FL plugins)
- [ ] **Plugin set:** Works when FL Studio is stopped -- verify it works during playback without "Operation unsafe" errors
- [ ] **Plugin set:** Parameter changes via API -- verify changes are reflected in plugin UI (not just shadow state)
- [ ] **Swing:** Percentage-based shift works -- verify swing interacts correctly with humanization (applied in right order)
- [ ] **Large payloads:** Works with 10 parameters -- verify works with 200+ parameters (chunking needed)
- [ ] **Timeout:** Quick operations work -- verify that slow operations (discovery, batch set) have appropriate timeouts
- [ ] **Rendering:** If workaround found -- verify rendered audio matches what user hears in FL Studio (same sample rate, bit depth, length)
- [ ] **File paths:** Works with ASCII paths -- verify with unicode characters, spaces, and long paths (>200 chars)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Bad humanization algorithm | LOW | Replace distribution model (brownian walk), existing interface stays same |
| Hardcoded parameter indices | MEDIUM | Build name-based lookup, migrate all references |
| No message chunking (large payloads fail) | MEDIUM | Implement chunking on both sides, requires protocol change |
| No render API discovered late | HIGH | Redesign rendering feature, may need to descope |
| No sample loading API discovered late | HIGH | Redesign sample workflow to be Node.js-only with manual FL Studio steps |
| Shadow state divergence | LOW | Add "sync" command, accept manual changes may cause drift |
| Double humanization | LOW | Add grid-reset before re-humanize, store original data |
| Timeout too short | LOW | Add per-command timeout configuration |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Uniform random humanization (#1) | Humanization Engine | A/B test: humanized vs quantized, humanized should always sound better |
| Context-free velocity (#2) | Humanization Engine | Downbeats are consistently louder than upbeats in output |
| Linear swing (#3) | Humanization Engine | Swing + humanization combo sounds musical, not mechanical |
| VST parameter instability (#4) | Generic Plugin Control | Same command works before and after simulated plugin update |
| getParamValue broken (#5) | Generic Plugin Control | Shadow state tracks all setParamValue calls accurately |
| No render API (#6) | Audio Rendering | Feasibility spike completed BEFORE planning implementation |
| No sample loading API (#7) | Sample Manipulation | Feasibility spike completed BEFORE planning implementation |
| SysEx size limits (#8) | Generic Plugin Control | 200+ parameter discovery response arrives intact |
| Timeout issues (#9) | Generic Plugin Control | Parameter discovery for complex VST completes without timeout |
| PME flags (#10) | Generic Plugin Control | Parameter changes work during playback |
| Serum 2 complexity (#11) | Serum 2 Integration | Top 50 parameters discoverable and settable by name |
| Double humanization (#12) | Humanization Engine | Re-humanize returns to grid first, prevents accumulation |
| State sync drift (#13) | All phases | Fresh state query before operations that depend on current state |
| Windows file paths (#14) | Audio/Sample phases | Tests pass with unicode and long path samples |
| Tempo-relative humanization (#15) | Humanization Engine | Same humanization settings sound appropriate at 80 and 160 BPM |
| Edison script isolation (#16) | Architecture design | All DSP implemented in Node.js, no Edison dependency |

## Sources

### High Confidence (Official Documentation)
- [FL Studio Plugins Module API](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/) -- parameter discovery and control functions
- [FL Studio PME Flags](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/midi/pme%20flags/) -- operation safety flags
- [FL Studio Channels Properties](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/properties/) -- no sample loading functions exist
- [FL Studio Edison Scripting](https://il-group.github.io/FL-Studio-API-Stubs/edison_scripting/) -- separate scripting environment
- [FL Studio MIDI Scripting Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm) -- security constraints

### Medium Confidence (Community + Official Verification)
- [FL Studio VST3 Parameter ID Issue](https://forum.image-line.com/viewtopic.php?t=299601) -- parameter instability confirmed
- [Will Python API Get Fixed?](https://forum.image-line.com/viewtopic.php?t=272593) -- getParamValue acknowledged broken
- [Serum 2 Official](https://xferrecords.com/products/serum-2) -- feature list and parameter scope
- [MIDI Humanizer (brownian noise)](https://github.com/vincerubinetti/midi-humanizer) -- humanization algorithm reference

### Lower Confidence (Community Knowledge, Best Practices)
- [Splice: Humanize Your Drums](https://splice.com/blog/humanize-your-drums/) -- humanization techniques
- [Unison: How to Humanize MIDI](https://unison.audio/how-to-humanize-midi/) -- velocity and timing patterns
- [Slam Tracks: Humanizing MIDI Drums](https://www.slamtracks.com/2025/12/20/5-secrets-to-humanizing-midi-drums/) -- velocity range recommendations
- [Apple Logic Pro: Swing Quantize](https://support.apple.com/guide/logicpro/quantize-parameter-values-lgcp47452db8/mac) -- swing implementation reference

---
*Pitfalls research for: FL Studio MCP Server v2.0 Production Pipeline*
*Researched: 2026-02-23*
