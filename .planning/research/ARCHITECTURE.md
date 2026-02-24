# Architecture Patterns: Production Pipeline (v2.0)

**Domain:** DAW Integration / FL Studio MCP Production Pipeline
**Researched:** 2026-02-23
**Milestone:** v2.0 Production Pipeline (humanization, Serum 2, audio rendering, sample manipulation)
**Confidence:** MEDIUM-HIGH (FL Studio API verified via official stubs; Serum 2 parameter specifics need hands-on testing)

## Executive Summary

The v2.0 Production Pipeline adds four major capability areas to the existing FL Studio MCP architecture: humanization, plugin parameter control (with Serum 2 as the primary target), audio rendering, and sample manipulation. Each area integrates differently with the existing bridge architecture, and some face hard constraints from FL Studio's Python API limitations.

**Key architectural finding:** Humanization should run entirely in Node.js (TypeScript) as a pre-processing step before notes reach FL Studio. Plugin control flows through the existing SysEx bridge with new Python handlers. Audio rendering has NO programmatic API -- it requires a UI-automation workaround or manual user step. Sample manipulation is best handled in Node.js using audio processing libraries, with FL Studio handling only the loading step.

## Existing Architecture (v1.0 Baseline)

```
+------------------+     MCP/JSON-RPC      +------------------+     SysEx/MIDI      +------------------+
|                  |        (stdio)         |                  |     (loopMIDI)      |                  |
|   Claude Code    | <------------------> |   MCP Server     | <------------------> |   FL Studio      |
|   (MCP Client)   |                      |   (TypeScript)   |                      |   + FL Bridge    |
|                  |                      |                  |                      |   (Python)       |
+------------------+                      +------------------+                      +------------------+
                                          |                  |
                                          | - Music theory   |
                                          | - Pyscript writer|
                                          | - Zod schemas    |
                                          +------------------+
```

### Current Components

| Component | Location | Technology | Role |
|-----------|----------|------------|------|
| MCP Server | `src/index.ts` | TypeScript/Node.js | MCP protocol, tool definitions |
| Bridge Connection | `src/bridge/` | TypeScript | MIDI client, SysEx codec, connection manager |
| Music Engine | `src/music/` | TypeScript (tonal) | Scales, chords, melody, bass generation |
| Tool Definitions | `src/tools/` | TypeScript (Zod) | transport, patterns, state, notes |
| Pyscript Writer | `src/music/pyscript-writer.ts` | TypeScript | Writes .pyscript with embedded note data |
| FL Bridge | `fl-bridge/device_FLBridge.py` | Python | SysEx listener, command router |
| Bridge Handlers | `fl-bridge/handlers/` | Python | transport, state, patterns, pianoroll |
| Protocol Layer | `fl-bridge/protocol/` | Python | SysEx parsing, command registration |

### Current Data Flows

**Note creation flow:**
1. Claude calls MCP tool (e.g., `create_chord_progression`)
2. MCP Server generates notes via music theory engine
3. Pyscript writer embeds note data as Python literals in `.pyscript` file
4. MCP Server sends `pianoroll.addNotes` command via SysEx to FL Bridge
5. FL Bridge opens piano roll, selects channel
6. User manually triggers ComposeWithBridge script in FL Studio

**State reading flow:**
1. Claude calls MCP tool (e.g., `get_channels`)
2. MCP Server sends command via SysEx
3. FL Bridge reads FL Studio state via Python API
4. FL Bridge sends response via SysEx
5. MCP Server returns result to Claude

---

## Integration Architecture: Four New Capabilities

### Capability 1: Humanization Engine

**Architecture Decision: Node.js (TypeScript), NOT FL Studio (Python)**

| Factor | Node.js (Recommended) | FL Studio (Python) |
|--------|------------------------|--------------------|
| Where it runs | Before notes are sent | After notes are placed |
| Complexity | Full TypeScript math libraries | FL Studio's stripped Python 3.9 |
| Access to note data | Direct -- notes are NoteData objects | Would need to read back from piano roll |
| Musical context | Has scale/key/chord context from generation | Lost once notes are placed |
| Debugging | Standard Node.js debugging | print() in FL Studio script output only |
| Dependencies | None -- pure math on existing data | Would require reading notes back (fragile) |
| Latency | Zero additional latency | Additional SysEx round-trip |

**Rationale:** Humanization is fundamentally a transformation on note data (timing, velocity, duration). The note data already exists as TypeScript `NoteData[]` objects in the MCP server before being written to the .pyscript. Humanization should be applied at this stage, as a processing pipeline step between generation and serialization.

**Integration point:** Insert between music engine output and pyscript writer.

```
Music Engine ──> NoteData[] ──> Humanization Engine ──> NoteData[] ──> Pyscript Writer
                                     ^
                                     |
                              HumanizationConfig
                              {
                                timingVariance: number,    // beats of jitter
                                velocityCurve: string,     // 'linear'|'exponential'|'breathing'
                                swingAmount: number,       // 0-1
                                swingGrid: number,         // swing subdivision
                                articulationMode: string,  // 'legato'|'staccato'|'mixed'
                                driftAmount: number,       // gradual timing drift
                                accentPattern: number[],   // beat accents
                              }
```

**New components:**

| Component | Location | Type |
|-----------|----------|------|
| `src/music/humanize.ts` | New file | Core humanization algorithms |
| `src/music/humanize-types.ts` | New file | HumanizationConfig types |
| `src/tools/humanize.ts` | New file | MCP tool definitions for humanization |

**Modified components:**

| Component | Change |
|-----------|--------|
| `src/tools/notes.ts` | Add optional `humanize` parameter to all note tools |
| `src/music/pyscript-writer.ts` | No change -- receives already-humanized NoteData |

**Data flow (humanized note creation):**
```
1. Claude: "Create a chord progression and humanize it"
2. MCP Server: Generate chords via music engine
3. MCP Server: Apply humanization to NoteData[]
4. MCP Server: Write humanized notes to .pyscript
5. SysEx: Send pianoroll.addNotes to FL Bridge
6. FL Bridge: Opens piano roll
7. User: Triggers ComposeWithBridge
```

**Humanization as standalone tool (post-hoc):**
```
1. Claude: "Humanize the last notes I created"
2. MCP Server: Retrieve cached NoteData[] from last generation
3. MCP Server: Apply humanization
4. MCP Server: Overwrite .pyscript with humanized version
5. User: Re-trigger ComposeWithBridge
```

**NOTE:** This means the MCP server needs to cache the last generated NoteData[]. This is a new state requirement.

---

### Capability 2: Plugin Parameter Control (Generic + Serum 2)

**Architecture Decision: New FL Bridge handler + Node.js parameter resolution layer**

#### FL Studio `plugins` Module API (HIGH confidence -- official API stubs)

The `plugins` module provides these key functions:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `isValid` | `(index, slotIndex=-1, useGlobalIndex=False) -> bool` | Check if plugin exists |
| `getPluginName` | `(index, slotIndex=-1, userName=False, useGlobalIndex=False) -> str` | Get plugin name |
| `getParamCount` | `(index, slotIndex=-1, useGlobalIndex=False) -> int` | Total parameter count |
| `getParamName` | `(paramIndex, index, slotIndex=-1, useGlobalIndex=False) -> str` | Parameter name by index |
| `getParamValue` | `(paramIndex, index, slotIndex=-1, useGlobalIndex=False) -> float` | Get value (0.0-1.0) |
| `setParamValue` | `(value, paramIndex, index, slotIndex=-1, pickupMode=0, useGlobalIndex=False) -> None` | Set value |
| `getParamValueString` | `(paramIndex, index, slotIndex=-1, pickupMode=0, useGlobalIndex=False) -> str` | Human-readable value |
| `getPresetCount` | `(index, slotIndex=-1, useGlobalIndex=False) -> int` | Number of presets |
| `nextPreset` | `(index, slotIndex=-1, useGlobalIndex=False) -> None` | Next preset |
| `prevPreset` | `(index, slotIndex=-1, useGlobalIndex=False) -> None` | Previous preset |
| `getName` | `(index, slotIndex=-1, flag=0, paramIndex=0, useGlobalIndex=False) -> str` | Various names by flag |

**Plugin name flags (for `getName`):**

| Flag Constant | Value | Returns |
|---------------|-------|---------|
| `FPN_Param` | 0 | Parameter name |
| `FPN_ParamValue` | 1 | Text value of parameter |
| `FPN_Semitone` | 2 | Note name defined by plugin |
| `FPN_Patch` | 3 | Patch name |
| `FPN_Preset` | 6 | Internal preset name |

**Plugin addressing:**
- **Generator plugins (channel rack):** `index` = channel index, `slotIndex` = -1
- **Effect plugins (mixer):** `index` = mixer track index, `slotIndex` = 0-9 (mixer slot)

#### VST Parameter Count (HIGH confidence -- official docs)

VST plugins report **4240 parameters** to FL Studio:
- 4096 plugin-defined parameters (indices 0-4095)
- 128 MIDI CC parameters (indices 4096-4223)
- 16 aftertouch parameters (indices 4224-4239)

This means iterating all parameters to build a name map is feasible but expensive (4240 calls to `getParamName`). This should be done ONCE per plugin session and cached.

#### Known Bug: `getParamValue` (MEDIUM confidence -- forum reports)

Forum reports indicate that "getting and setting the values of some VST plugin parameters has been broken" for certain plugins. This was reported in 2023-2024 timeframe. The bug may or may not be fixed in FL Studio 2025. **This needs hands-on testing with Serum 2 specifically.**

Workaround if `getParamValue` is broken:
- Maintain a **shadow state** in the MCP server (TypeScript side)
- When `setParamValue` is called, also store the value in the shadow state
- When reading values, return from shadow state
- Caveat: Shadow state diverges if user manually changes parameters in FL Studio

#### Serum 2 Parameter Architecture (LOW-MEDIUM confidence -- needs testing)

Serum 2 as a VST plugin will expose its parameters via the standard VST parameter interface. Based on Serum 2's architecture, expected parameter categories include:

| Category | Expected Parameters | Estimated Count |
|----------|--------------------|-----------------|
| Oscillator A | Wavetable position, level, pan, octave, semi, fine, phase, random, unison voices, detune, blend, stereo | ~30 |
| Oscillator B | Same as Osc A | ~30 |
| Sub oscillator | Shape, level, octave, direct out | ~10 |
| Noise oscillator | Level, phase, pitch, direct out | ~10 |
| Filter 1 | Type, cutoff, resonance, drive, fat, mix, pan, key track | ~15 |
| Filter 2 | Same as Filter 1 | ~15 |
| Envelopes (x4) | Attack, hold, decay, sustain, release, velocity | ~24 |
| LFOs (x10) | Rate, shape, rise, delay, smooth, phase, BPM sync | ~70 |
| FX rack | Distortion, flanger, phaser, chorus, delay, compressor, multiband, EQ, filter, reverb, hyper/dimension | ~80+ |
| Macros (x4) | Value | 4 |
| Global | Master volume, voicing, glide, etc. | ~20 |
| **Total estimated** | | **~300-400 meaningful parameters** |

The remaining ~3700 of the 4096 VST parameter slots may be unused/blank or map to less common controls.

**Critical for Serum 2: Name-based parameter resolution**

Parameter indices are positional and may change between Serum versions. The architecture MUST use name-based resolution:

```
User: "Set filter cutoff to 75%"
  1. MCP Server: Resolve "filter cutoff" to parameter name
  2. SysEx command: plugins.findParam("Filter 1 Cutoff")
  3. FL Bridge: Iterate params to find matching name -> paramIndex
  4. FL Bridge: plugins.setParamValue(0.75, paramIndex, channelIndex)
```

#### New Components for Plugin Control

**FL Bridge side (Python):**

| Component | Location | Purpose |
|-----------|----------|---------|
| `fl-bridge/handlers/plugins.py` | New file | Plugin parameter handlers |

**Handlers to register:**
- `plugins.discover` -- Enumerate all plugin parameters (name + index + current value)
- `plugins.getParam` -- Get parameter value by name or index
- `plugins.setParam` -- Set parameter value by name or index
- `plugins.findPlugin` -- Find plugin by name in channel rack or mixer
- `plugins.getPresets` -- List available presets
- `plugins.nextPreset` / `plugins.prevPreset` -- Navigate presets
- `plugins.getInfo` -- Get plugin name, type, parameter count

**MCP Server side (TypeScript):**

| Component | Location | Purpose |
|-----------|----------|---------|
| `src/tools/plugins.ts` | New file | MCP tool definitions for plugin control |
| `src/plugins/param-cache.ts` | New file | Parameter name-to-index cache |
| `src/plugins/serum2.ts` | New file | Serum 2 semantic parameter mapping |

**Parameter discovery flow:**
```
1. Claude: "What plugins are loaded?"
2. MCP Server sends plugins.findPlugin to FL Bridge
3. FL Bridge: channels.channelCount() -> iterate -> plugins.isValid() -> plugins.getPluginName()
4. Returns list of plugin names with channel indices

5. Claude: "Show me Serum 2's parameters"
6. MCP Server sends plugins.discover(channelIndex) to FL Bridge
7. FL Bridge: plugins.getParamCount() -> iterate -> plugins.getParamName()
8. Returns {paramIndex: paramName} map (cached in MCP server)
```

**SysEx payload size concern:** Discovering 4240 parameters will produce a large JSON response. The existing SysEx protocol may need chunking for this response. Consider:
- Option A: Chunk the discovery into batches (0-500, 500-1000, etc.)
- Option B: Only return non-empty parameter names (skip blank slots)
- Option C: Filter to the first 500 parameters (covers most meaningful ones)

**Recommendation: Option B** -- return only parameters with non-empty names. This likely reduces the response to 300-500 entries, which is manageable in a single SysEx message.

#### Serum 2 Semantic Layer

Beyond raw parameter control, the Serum 2 semantic layer provides musical abstractions:

```typescript
// src/plugins/serum2.ts

// Semantic parameter groups for natural language mapping
const SERUM2_PARAM_GROUPS = {
  oscillator: {
    a: { wavetablePos: 'Osc A WT Pos', level: 'Osc A Level', ... },
    b: { wavetablePos: 'Osc B WT Pos', level: 'Osc B Level', ... },
  },
  filter: {
    1: { cutoff: 'Filter 1 Cutoff', resonance: 'Filter 1 Res', ... },
    2: { cutoff: 'Filter 2 Cutoff', resonance: 'Filter 2 Res', ... },
  },
  macro: { 1: 'Macro 1', 2: 'Macro 2', 3: 'Macro 3', 4: 'Macro 4' },
  fx: { ... },
};
```

**Important:** The exact parameter names must be discovered via hands-on testing with Serum 2 in FL Studio. The names above are educated guesses based on Serum 2's UI labels. The semantic layer maps natural language concepts ("filter cutoff", "oscillator wavetable position") to actual parameter names returned by `plugins.getParamName()`.

**Wavetable loading:** Serum 2 stores wavetables as files. There is NO known API to load wavetables programmatically via FL Studio's `plugins` module. Wavetable selection would need to be done via parameter automation (if Serum exposes a wavetable select parameter) or left as a manual user step.

---

### Capability 3: Audio Rendering

**Architecture Decision: UI automation workaround -- NO direct API exists**

#### What the FL Studio API Supports (HIGH confidence -- verified)

The FL Studio MIDI Controller Scripting API has **NO export/render function**. Verified by checking:
- `general` module: Contains `getVersion`, `getRecPPQ`, `safeToEdit`, `processRECEvent`, `dumpScoreLog`, `clearLog` -- NO export function
- `transport` module: Contains play/stop/record, `globalTransport()`, position control -- NO render function
- `ui` module: Contains keyboard shortcuts (`cut`, `copy`, `paste`, `up`, `down`, `enter`, `escape`) and window management -- NO export menu trigger
- `transport.globalTransport()`: Offers 80+ command IDs (FPT_ constants) including `FPT_Save` (92) and `FPT_SaveNew` (93) but NO render/export command

**The export dialog is a GUI-only operation in FL Studio.**

#### Rendering Options Analysis

| Option | Feasibility | Reliability | User Experience |
|--------|-------------|-------------|-----------------|
| A. `globalTransport(FPT_Save)` + manual export | Works but only saves project | HIGH | Poor -- still manual |
| B. Keyboard shortcut simulation (Ctrl+R) | Not possible via Python API | N/A | N/A |
| C. Windows automation (pyautogui/ahk) | Works outside FL Studio | LOW | Brittle, breaks with UI changes |
| D. Manual user step with guidance | Always works | HIGH | Acceptable with good UX |
| E. FL Studio batch export via CLI | FL Studio supports `/R` flag | MEDIUM | Only for full project, not patterns |

**Recommendation: Option D with enhancement path to E**

**Option D (Primary -- Phase 1):** Guide the user to render manually.
```
MCP Tool: "render_pattern"
1. MCP Server prepares render instructions
2. Returns: "To render this pattern:
   1. File > Export > Wave File (Ctrl+R)
   2. Select 'Pattern' mode
   3. Choose output location
   4. Click Start"
3. MCP Server watches a configured output directory for new .wav files
4. When file appears, loads it for sample manipulation
```

**Option E (Enhancement -- Later):** FL Studio command-line rendering.
FL Studio supports `FL64.exe /R /Pn /Opath project.flp` for command-line rendering:
- `/R` -- render mode
- `/Pn` -- render pattern n
- `/Opath` -- output path
- Requires saving the project first

This could be triggered from Node.js:
```typescript
import { execSync } from 'child_process';
execSync('"C:/Program Files/Image-Line/FL Studio/FL64.exe" /R /P1 /O"output.wav" "project.flp"');
```
**Caveat:** This launches a separate FL Studio instance, which is heavyweight and may conflict with the running instance. Needs testing.

#### File Watcher Pattern

For both rendering options, the MCP server needs to detect new audio files:

```typescript
// src/audio/file-watcher.ts
import { watch } from 'fs';

const RENDER_DIR = join(homedir(), 'Documents', 'FL Studio Renders');

function watchForRender(expectedFilename: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const watcher = watch(RENDER_DIR, (event, filename) => {
      if (filename === expectedFilename) {
        watcher.close();
        resolve(join(RENDER_DIR, filename));
      }
    });
    setTimeout(() => { watcher.close(); reject(new Error('Render timeout')); }, timeout);
  });
}
```

---

### Capability 4: Sample Manipulation

**Architecture Decision: Node.js audio processing + FL Studio for loading**

#### Where Each Operation Runs

| Operation | Where | Why |
|-----------|-------|-----|
| Pitch shifting | Node.js | Full audio processing libraries available |
| Time stretching | Node.js | Same |
| Reversing | Node.js | Trivial buffer reversal |
| Chopping/slicing | Node.js | Needs precise sample math |
| Layering | Node.js | Combine multiple audio buffers |
| Detuning | Node.js | Pitch shift variant |
| Loading into FL Studio | FL Bridge | Need to load sample into channel |
| Normalizing | Node.js | Sample-level math |

#### FL Studio Sample Loading Limitation (HIGH confidence)

The `channels` module does **NOT** have a function to load a sample file into a channel. Verified functions:
- `getChannelName/setChannelName` -- name only
- `getChannelVolume/setChannelVolume` -- volume
- `getChannelPan/setChannelPan` -- pan
- `getChannelType` -- read-only type
- `getTargetFxTrack/setTargetFxTrack` -- mixer routing
- NO `loadSample`, `setSamplePath`, or file loading function

**Workaround options for loading samples:**

| Option | How | Reliability |
|--------|-----|-------------|
| A. Drag-and-drop guidance | Tell user to drag file into channel rack | HIGH but manual |
| B. `channels.showEditor` + clipboard | Open channel settings, paste sample path | LOW -- clipboard is text, not file |
| C. `processRECEvent` | Use REC events to trigger sample loading | UNKNOWN -- needs testing |
| D. Browser navigation | Use `ui` module to navigate FL Studio's browser to the file | MEDIUM -- fragile UI automation |

**Recommendation: Option A initially, with Option D as an enhancement.**

Option D approach using FL Studio browser:
```python
# FL Bridge
import ui
# Navigate FL Studio's browser to the file
# ui.navigateBrowserMenu(path) -- if such a function exists
# This needs hands-on testing
```

**Alternative: Direct file placement**

Since FL Studio monitors certain folders, an alternative workflow:
1. Node.js processes the sample and saves it to a known location
2. The file appears in FL Studio's browser automatically
3. MCP tool instructs the user: "Drag 'processed_sample.wav' from the browser into a new channel"

This is the most reliable approach given API limitations.

#### Edison Scripting API (MEDIUM confidence)

Edison (FL Studio's audio editor) has a separate Python scripting API that CAN manipulate audio:

| Function | Purpose |
|----------|---------|
| `EditorSample.GetSampleAt(pos, ch) -> float` | Read sample data |
| `EditorSample.SetSampleAt(pos, ch, val)` | Write sample data |
| `EditorSample.AmpFromTo(start, end, vol)` | Amplify |
| `EditorSample.SilenceFromTo(start, end, vol)` | Silence a region |
| `EditorSample.NormalizeFromTo(start, end, vol, only_if_above)` | Normalize |
| `EditorSample.SineFromTo(start, end, freq, phase, vol)` | Generate sine wave |
| `EditorSample.LoadFromClipboard()` | Load from clipboard |
| `EditorSample.Length` | Sample length |
| `EditorSample.NumChans` | Channel count |
| `EditorSample.SampleRate` | Sample rate |

**However:** Edison scripts run in a separate Python subinterpreter, just like piano roll scripts. They must be triggered manually by the user (Tools > Run script in Edison). They cannot be invoked from the MIDI Controller Script. And they have NO file I/O -- no loading or saving audio files directly.

**Verdict:** Edison scripting is not useful for our sample manipulation pipeline. Node.js is the correct place for audio processing.

#### Node.js Audio Processing Stack

| Library | Purpose | Status |
|---------|---------|--------|
| `wavefile` | Read/write WAV files | Stable, well-maintained |
| `soundtouch-js` | Pitch shifting, time stretching | Port of SoundTouch library |
| `audiobuffer-to-wav` | Convert AudioBuffer to WAV | Utility |
| `web-audio-api` | Node.js implementation of Web Audio API | For effects processing |
| Raw buffer manipulation | Reverse, chop, layer | No library needed |

**Recommended approach:** Use `wavefile` for I/O and raw buffer manipulation for most operations. Use `soundtouch-js` only for pitch shifting/time stretching where proper algorithm quality matters.

#### New Components for Sample Manipulation

| Component | Location | Purpose |
|-----------|----------|---------|
| `src/audio/wav-io.ts` | New file | Read/write WAV files |
| `src/audio/effects.ts` | New file | Pitch shift, reverse, chop, layer |
| `src/audio/sample-cache.ts` | New file | Track processed samples |
| `src/tools/samples.ts` | New file | MCP tool definitions |

**Sample manipulation data flow:**
```
1. Claude: "Render that chord, pitch it down an octave, and reverse it"
2. MCP Server: Check sample-cache for last render
   - If no render: Guide user to render, watch for file
   - If render exists: Load WAV from disk
3. MCP Server: Apply pitch shift (-12 semitones) via soundtouch-js
4. MCP Server: Reverse buffer
5. MCP Server: Write processed WAV to known output directory
6. MCP Server: Return instructions to load into FL Studio
   "Processed sample saved to: ~/Documents/FL Studio MCP/Samples/chord_pitched_reversed.wav
    Drag this file into a new channel in FL Studio."
```

---

## Complete v2.0 Architecture Diagram

```
+------------------+     MCP/JSON-RPC      +------------------------------------------+
|                  |        (stdio)         |            MCP Server (Node.js)           |
|   Claude Code    | <------------------> |                                          |
|   (MCP Client)   |                      |  src/tools/                              |
|                  |                      |    transport.ts     (existing)            |
+------------------+                      |    patterns.ts      (existing)            |
                                          |    state.ts         (existing)            |
                                          |    notes.ts         (existing, modified)  |
                                          |    plugins.ts       (NEW)                 |
                                          |    humanize.ts      (NEW)                 |
                                          |    samples.ts       (NEW)                 |
                                          |    render.ts        (NEW)                 |
                                          |                                          |
                                          |  src/music/                              |
                                          |    theory.ts        (existing)            |
                                          |    chords.ts        (existing)            |
                                          |    melody.ts        (existing)            |
                                          |    scales.ts        (existing)            |
                                          |    humanize.ts      (NEW)                 |
                                          |    pyscript-writer.ts (existing)          |
                                          |                                          |
                                          |  src/plugins/                            |
                                          |    param-cache.ts   (NEW)                 |
                                          |    serum2.ts        (NEW)                 |
                                          |                                          |
                                          |  src/audio/                              |
                                          |    wav-io.ts        (NEW)                 |
                                          |    effects.ts       (NEW)                 |
                                          |    sample-cache.ts  (NEW)                 |
                                          |    file-watcher.ts  (NEW)                 |
                                          |                                          |
                                          +-------|-----|-----|----------------------+
                                                  |     |     |
                                      SysEx/MIDI  |     |     | File System
                                      (loopMIDI)  |     |     | (read/write WAV,
                                                  |     |     |  .pyscript)
                                                  v     |     v
                                          +-------------+ +------------------+
                                          | FL Studio   | | Local filesystem |
                                          | + FL Bridge | | ~/Documents/     |
                                          | (Python)    | |  FL Studio MCP/  |
                                          |             | |  Samples/        |
                                          | handlers/   | +------------------+
                                          |  transport  |
                                          |  state      |
                                          |  patterns   |
                                          |  pianoroll  |
                                          |  plugins.py | (NEW)
                                          +-------------+
```

## New vs Modified Components Summary

### New Files (11 files)

| File | Purpose | Depends On |
|------|---------|------------|
| `src/music/humanize.ts` | Humanization algorithms | NoteData types |
| `src/music/humanize-types.ts` | Humanization config types | None |
| `src/tools/humanize.ts` | MCP humanization tools | humanize.ts, connection |
| `src/tools/plugins.ts` | MCP plugin control tools | param-cache, connection |
| `src/plugins/param-cache.ts` | Parameter name-to-index cache | None |
| `src/plugins/serum2.ts` | Serum 2 semantic parameter map | param-cache |
| `src/audio/wav-io.ts` | WAV file read/write | wavefile library |
| `src/audio/effects.ts` | Audio processing (pitch, reverse, chop) | wav-io |
| `src/audio/sample-cache.ts` | Track processed samples | None |
| `src/audio/file-watcher.ts` | Watch for rendered files | None |
| `src/tools/samples.ts` | MCP sample manipulation tools | audio/, connection |
| `fl-bridge/handlers/plugins.py` | FL Bridge plugin parameter handlers | plugins module |

### Modified Files (3 files)

| File | Change |
|------|--------|
| `src/tools/notes.ts` | Add optional humanization parameter to all note tools |
| `src/tools/index.ts` | Register new tool modules |
| `fl-bridge/handlers/__init__.py` | Import plugins handler |
| `fl-bridge/device_FLBridge.py` | Import `plugins` module at top level |

## Suggested Build Order

Build order is driven by three factors: (1) dependency chain, (2) validation risk, and (3) immediate user value.

### Phase 1: Humanization Engine

**Why first:**
- Zero dependency on unvalidated FL Studio APIs
- Immediate value -- improves ALL existing note generation tools
- Pure TypeScript -- no bridge changes needed
- Can be tested entirely in Node.js without FL Studio running

**Components:** `humanize.ts`, `humanize-types.ts`, `src/tools/humanize.ts`
**Modified:** `src/tools/notes.ts`

### Phase 2: Generic Plugin Parameter Control

**Why second:**
- Validates the `plugins` Python module works (critical unknown)
- Discovers if `getParamValue` bug exists in FL Studio 2025
- Foundation for Serum 2 integration
- Establishes the parameter cache pattern
- Requires FL Bridge changes (new handler)

**Components:** `fl-bridge/handlers/plugins.py`, `src/tools/plugins.ts`, `src/plugins/param-cache.ts`
**Risk:** If `getParamValue` is broken, need shadow state fallback

### Phase 3: Serum 2 Sound Design

**Why third:**
- Depends on Phase 2 (generic plugin control must work)
- Requires hands-on parameter discovery (exact names from running Serum 2)
- High value -- core to v2.0 vision

**Components:** `src/plugins/serum2.ts`
**Risk:** Parameter names may differ from assumptions; needs iterative discovery

### Phase 4: Audio Rendering

**Why fourth:**
- No API exists -- requires establishing the "manual render + file watcher" pattern
- Less critical than humanization and sound design
- Needed before sample manipulation (provides source material)

**Components:** `src/audio/file-watcher.ts`, render guidance tool
**Risk:** Low -- the manual approach always works

### Phase 5: Sample Manipulation

**Why fifth:**
- Depends on Phase 4 (needs rendered audio to manipulate)
- Node.js audio processing is well-understood
- Loading into FL Studio requires workaround

**Components:** `src/audio/wav-io.ts`, `src/audio/effects.ts`, `src/audio/sample-cache.ts`, `src/tools/samples.ts`
**Risk:** Audio library compatibility; FL Studio sample loading workaround

## Anti-Patterns to Avoid

### Anti-Pattern 1: Humanizing Inside FL Studio

**What:** Running humanization algorithms in FL Bridge Python
**Why bad:** FL Studio's Python is stripped-down (no numpy, no random module availability uncertain), debugging is print-only, and you would need to read notes back from the piano roll (additional complexity and fragility)
**Instead:** Humanize in Node.js before notes are serialized to .pyscript

### Anti-Pattern 2: Full Parameter Scan on Every Request

**What:** Iterating all 4240 parameters every time a plugin command is issued
**Why bad:** 4240 calls to `getParamName` is slow and generates massive SysEx traffic
**Instead:** Scan once, cache the name-to-index map, invalidate only when plugin changes

### Anti-Pattern 3: Attempting Programmatic Audio Rendering

**What:** Spending effort trying to find a way to trigger FL Studio's export dialog programmatically
**Why bad:** It does not exist in the API. `globalTransport` has no render command. UI keyboard functions are limited to basic keys (no Ctrl+R combination). Time spent here is wasted.
**Instead:** Accept the manual render step. Optimize the workflow around it (file watcher, good instructions, predictable output paths).

### Anti-Pattern 4: Using Edison for Sample Processing

**What:** Trying to use Edison's Python scripting API for audio manipulation
**Why bad:** Edison scripts have the same limitations as piano roll scripts -- separate subinterpreter, no file I/O, must be triggered manually. Plus, Edison must be open with the correct audio loaded.
**Instead:** Process audio entirely in Node.js where you have full file system access and proper audio libraries.

### Anti-Pattern 5: Hardcoding Serum 2 Parameter Indices

**What:** Using numeric indices (e.g., paramIndex 47 = filter cutoff) in code
**Why bad:** Parameter indices are positional and can change between Serum versions, plugin updates, or even FL Studio versions
**Instead:** Always resolve by name. Cache the name-to-index map. Log warnings if expected names are not found.

## Open Questions Requiring Hands-On Testing

1. **Does `plugins.getParamValue()` work with Serum 2 in FL Studio 2025?** -- Forum reports say it was broken for some VSTs. Must test.

2. **What are Serum 2's exact parameter names as reported by `plugins.getParamName()`?** -- The names may differ from Serum's UI labels. Must iterate and catalog.

3. **How many non-blank parameters does Serum 2 actually expose?** -- Out of 4096 slots, how many have meaningful names?

4. **Can `plugins.setParamValue()` reliably change Serum 2 parameters?** -- Setting values is more critical than reading them.

5. **Does FL Studio's command-line `/R` flag work when FL Studio is already running?** -- If so, this enables automated rendering without a second instance.

6. **What is the maximum SysEx message size the bridge can handle reliably?** -- Parameter discovery responses may be large. Need to test with real payloads.

7. **Can `general.processRECEvent()` be used to load samples into channels?** -- REC events control automatable values; sample loading may have a REC event ID.

## Sources

### HIGH Confidence
- [FL Studio Python API Stubs -- Official](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/) -- Module documentation
- [FL Studio Plugins Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/) -- Parameter functions
- [FL Studio Channels Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/) -- No sample loading API
- [FL Studio Transport Module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/) -- No render function
- [FL Studio globalTransport Commands](https://github.com/IL-Group/FL-Studio-API-Stubs) -- FPT_ constants (no render ID)
- [FL Studio UI Keyboard Functions](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/ui/) -- Limited keyboard simulation
- [Edison Scripting API](https://il-group.github.io/FL-Studio-API-Stubs/edison_scripting/) -- Separate subinterpreter, no file I/O
- [FL Studio MIDI Scripting Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm)

### MEDIUM Confidence
- [FL Studio Forum: API Bug Reports](https://forum.image-line.com/viewtopic.php?t=272593) -- getParamValue issues confirmed
- [Serum 2 Official Site](https://xferrecords.com/products/serum-2) -- Feature overview
- [Flapi Project](https://github.com/MaddyGuthridge/Flapi) -- Validates MIDI bridge approach, unmaintained
- [FL Studio Export Documentation](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/fformats_save_export.htm) -- GUI-only export

### LOW Confidence
- Serum 2 exact parameter names and count (needs hands-on testing)
- FL Studio CLI rendering with running instance (needs testing)
- `processRECEvent` for sample loading (needs investigation)
- SysEx message size limits for large payloads (needs benchmarking)
