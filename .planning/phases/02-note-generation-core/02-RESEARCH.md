# Phase 2: Note Generation Core - Research

**Researched:** 2026-02-23
**Domain:** FL Studio Note/Score Manipulation, Music Theory Generation, Piano Roll API
**Confidence:** HIGH (architecture approach), MEDIUM (some API details need runtime validation)

## Summary

This research covers how to create musical notes (chords, melodies, bass lines) in FL Studio patterns from a MIDI controller script (our FL Bridge), and how to implement music theory logic (scales, chords, progressions) on the MCP server side in TypeScript.

The critical finding is that **FL Studio has two completely separate scripting APIs** that cannot directly interact: MIDI Controller Scripts (our FL Bridge) and Piano Roll Scripts (.pyscript files). The `flpianoroll` module -- which has the best note creation API (`score.addNote()`) -- is ONLY available in Piano Roll Scripts and CANNOT be imported or called from MIDI Controller Scripts.

This forces a choice between three architectural approaches:
1. **Step Sequencer API** (`channels.setGridBit` + `channels.setStepParameterByIndex`) - works directly from MIDI Controller Script but limited to step-sequencer-style notes with constrained timing resolution
2. **Hybrid Approach** (.pyscript + file-based IPC + keyboard trigger) - uses `flpianoroll` for rich note creation, triggered via keystroke from MIDI Controller Script, with JSON file for data exchange
3. **MIDI Recording Approach** (`channels.midiNoteOn` with transport recording) - triggers notes in real-time while FL Studio records them to the piano roll

**Primary recommendation:** Use the **Hybrid Approach** (option 2). Ship a companion `.pyscript` file alongside the FL Bridge that reads note data from a JSON file and uses `flpianoroll.score.addNote()` for full-fidelity note creation. The FL Bridge writes note data to a JSON file and triggers the pyscript via keyboard shortcut simulation. This is the approach proven by calvinw/fl-studio-mcp and karl-andres/fl-studio-mcp. All music theory (scale locking, chord generation, melody construction) lives in the TypeScript MCP server using the `tonal` library.

## Standard Stack

### Core (MCP Server - TypeScript)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tonal | ^6.x | Music theory: scales, chords, notes, MIDI numbers, intervals | De facto standard for JS/TS music theory, pure functions, TypeScript-native, 12K+ GitHub stars |
| @tonaljs/note | (included in tonal) | Note name to MIDI number conversion | `Note.midi("C4")` returns 60 |
| @tonaljs/scale | (included in tonal) | Scale generation and degree lookup | `Scale.get("C major").notes` returns note names |
| @tonaljs/chord | (included in tonal) | Chord note generation | `Chord.get("Cmaj7").notes` returns chord tones |

### Core (FL Bridge - Python)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| flpianoroll (via .pyscript) | Built into FL Studio | Rich note creation in piano roll | Only API for full-fidelity note creation (timing, velocity, pitch, pan, filters) |
| channels (via MIDI controller script) | Built into FL Studio | Step sequencer manipulation (fallback) | Available from MIDI controller scripts for simple pattern programming |
| ui | Built into FL Studio | Window management | `ui.showWindow(3)` opens piano roll |
| general | Built into FL Studio | PPQ/timing info | `general.getRecPPQ()` gets ticks per quarter note |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hybrid (.pyscript) approach | Step sequencer only (setGridBit) | Step sequencer limited to 16th-note grid, single fixed pitch per step, no continuous timing |
| Hybrid (.pyscript) approach | MIDI recording (midiNoteOn + transport.record) | Requires real-time playback, complex timing, fragile recording state management |
| tonal (TypeScript) | Custom music theory code | Reinventing the wheel; tonal handles edge cases (enharmonics, modes, inversions) |
| tonal (TypeScript) | teoria.js | teoria is older, less maintained, not TypeScript-native |

**Installation:**
```bash
# MCP Server
npm install tonal
```

No additional installation for FL Studio side - `flpianoroll` is built into FL Studio.

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
fl-studio-mcp/
src/
  tools/
    notes.ts              # MCP tools: add_notes, create_chord_progression, etc.
  music/
    theory.ts             # Scale/chord/note logic using tonal
    scales.ts             # Scale locking and note constraint
    chords.ts             # Chord progression generation
    melody.ts             # Melody generation algorithms
    midi-convert.ts       # Note name to MIDI number helpers
fl-bridge/
  handlers/
    pianoroll.py          # Handler for note commands (writes JSON, triggers pyscript)
  shared/                 # Shared data directory for JSON IPC
piano-roll-scripts/
  ComposeWithBridge.pyscript  # Piano roll script that reads JSON + adds notes
```

### Pattern 1: Hybrid Piano Roll Script Architecture

**What:** Two-part system where the MIDI Controller Script (FL Bridge) writes note data to a JSON file, then triggers a companion Piano Roll Script (.pyscript) which reads the JSON and calls `flpianoroll.score.addNote()`.

**When to use:** ALL note creation operations (chords, melodies, bass lines)

**Why:** The `flpianoroll` module is the ONLY FL Studio API with full-fidelity note creation (arbitrary timing, velocity, pitch, pan, filter cutoff, slide, portamento). It is NOT accessible from MIDI Controller Scripts.

**Data flow:**
```
MCP Tool (TypeScript)
  -> generates note data (MIDI numbers, timing, velocity)
  -> sends via SysEx to FL Bridge

FL Bridge (MIDI Controller Script, Python)
  -> receives command with note array
  -> writes note data to JSON file in shared directory
  -> optionally opens piano roll: ui.showWindow(3)
  -> signals completion back to MCP

User (or automation):
  -> triggers piano roll script (Ctrl+Alt+Y or menu)
  -> OR: FL Bridge sends keystroke trigger

Piano Roll Script (.pyscript)
  -> reads JSON file from shared directory
  -> creates flpianoroll.Note objects
  -> calls flpianoroll.score.addNote() for each note
  -> writes response/state back to JSON
  -> clears the request file
```

**Example - JSON data format for note exchange:**
```json
{
  "action": "add_notes",
  "pattern": 1,
  "channel": 0,
  "notes": [
    {"midi": 60, "time": 0.0, "duration": 1.0, "velocity": 0.8},
    {"midi": 64, "time": 0.0, "duration": 1.0, "velocity": 0.75},
    {"midi": 67, "time": 0.0, "duration": 1.0, "velocity": 0.7}
  ]
}
```
Where `time` and `duration` are in quarter notes (beats), converted to ticks in the .pyscript using `score.PPQ`.

**Example - Piano Roll Script (.pyscript):**
```python
# Source: calvinw/fl-studio-mcp ComposeWithLLM.pyscript pattern
import flpianoroll as flp
import json
import os

# Shared data path
DATA_DIR = os.path.join(
    os.path.expanduser("~"),
    "Documents", "Image-Line", "FL Studio", "Settings", "Hardware",
    "fl-bridge", "shared"
)

def apply(form):
    """Main entry point - called when script is triggered."""
    request_path = os.path.join(DATA_DIR, "note_request.json")

    if not os.path.exists(request_path):
        flp.Utils.ShowMessage("No pending note request found.")
        return

    with open(request_path, "r") as f:
        request = json.load(f)

    ppq = flp.score.PPQ  # Ticks per quarter note (default 96)

    if request.get("action") == "add_notes":
        for note_data in request.get("notes", []):
            note = flp.Note()
            note.number = note_data["midi"]
            note.time = int(note_data["time"] * ppq)
            note.length = int(note_data["duration"] * ppq)
            note.velocity = note_data.get("velocity", 0.8)
            note.pan = note_data.get("pan", 0.5)
            note.color = note_data.get("color", 0)
            flp.score.addNote(note)

    elif request.get("action") == "clear":
        flp.score.clearNotes(all=True)

    # Clean up request file
    os.remove(request_path)

    # Export current state for MCP awareness
    export_state()

def export_state():
    """Export current piano roll state to JSON for MCP to read."""
    state_path = os.path.join(DATA_DIR, "piano_roll_state.json")
    notes = []
    ppq = flp.score.PPQ

    for i in range(flp.score.noteCount):
        n = flp.score.getNote(i)
        notes.append({
            "midi": n.number,
            "time": n.time / ppq,
            "duration": n.length / ppq,
            "velocity": n.velocity,
            "pan": n.pan,
            "selected": n.selected,
        })

    state = {
        "ppq": ppq,
        "noteCount": flp.score.noteCount,
        "notes": notes,
        "tsnum": flp.score.tsnum,
        "tsden": flp.score.tsden,
    }

    with open(state_path, "w") as f:
        json.dump(state, f, indent=2)
```

### Pattern 2: Music Theory on the MCP Server Side

**What:** All music theory logic (scale construction, chord voicings, melody generation) runs in TypeScript on the MCP server using the `tonal` library. The FL Bridge only receives concrete MIDI note data.

**When to use:** ALWAYS. Never put music theory logic in the FL Bridge or .pyscript.

**Why:** TypeScript has excellent music theory libraries (tonal). Claude can generate note data directly. The FL Bridge should be a thin relay.

**Example - Scale-locked note generation:**
```typescript
// Source: tonal documentation
import { Note, Scale, Chord, Key } from "tonal";

// Scale locking: get all notes in A minor
function getScaleNotes(root: string, scale: string, octaveRange: [number, number]): number[] {
  const scaleData = Scale.get(`${root} ${scale}`);
  const midiNotes: number[] = [];

  for (let octave = octaveRange[0]; octave <= octaveRange[1]; octave++) {
    for (const noteName of scaleData.notes) {
      const midi = Note.midi(`${noteName}${octave}`);
      if (midi !== null) midiNotes.push(midi);
    }
  }
  return midiNotes;
}

// Chord progression: I-V-vi-IV in C major
function generateChordProgression(
  key: string,
  progression: string[],  // e.g., ["I", "V", "vi", "IV"]
  octave: number = 4,
  beatDuration: number = 4.0  // beats per chord
): NoteData[] {
  const notes: NoteData[] = [];
  let currentBeat = 0;

  for (const numeral of progression) {
    // Map roman numeral to chord name in key
    const chordName = romanNumeralToChord(key, numeral);
    const chord = Chord.get(chordName);

    for (const noteName of chord.notes) {
      const midi = Note.midi(`${noteName}${octave}`);
      if (midi !== null) {
        notes.push({
          midi,
          time: currentBeat,
          duration: beatDuration,
          velocity: 0.8,
        });
      }
    }
    currentBeat += beatDuration;
  }
  return notes;
}

interface NoteData {
  midi: number;     // MIDI note number 0-127 (60 = middle C)
  time: number;     // Start time in quarter notes (beats)
  duration: number; // Duration in quarter notes
  velocity: number; // 0.0 - 1.0
  pan?: number;     // 0.0 - 1.0, default 0.5 (center)
  color?: number;   // 0-15, FL Studio note color
}
```

### Pattern 3: Step Sequencer Fallback

**What:** Use `channels.setGridBit()` + `channels.setStepParameterByIndex()` from the MIDI Controller Script for simple drum/percussion patterns where the piano roll approach is overkill.

**When to use:** Simple step-sequencer patterns (drums in Phase 4), quick prototyping.

**Why:** Works directly from FL Bridge without needing the piano roll open or a companion .pyscript.

**Limitations:**
- Fixed to the step sequencer grid (16 steps per bar by default)
- Each step has a single pitch (the channel's pitch, adjustable via pPitch parameter)
- No arbitrary note timing - snapped to grid
- Good for drums (one-shot samples per channel), bad for melodies

**Example:**
```python
# Source: FL Studio API stubs channels/__sequencer.py
import channels

# Step parameter constants
pPitch = 0      # Note pitch
pVelocity = 1   # Velocity
pRelease = 2    # Release velocity
pFinePitch = 3  # Fine pitch
pPan = 4        # Panning
pModX = 5       # Mod X
pModY = 6       # Mod Y
pShift = 7      # Shift
pRepeat = 8     # Repeat

def handle_set_grid_pattern(params):
    """Set step sequencer grid bits for a channel."""
    channel_index = params.get("channel", 0)
    pattern_num = params.get("pattern", 1)
    steps = params.get("steps", [])  # list of {position, velocity, ...}

    for step in steps:
        position = step["position"]  # 0-based step index
        active = step.get("active", True)

        # Toggle the grid bit on/off
        channels.setGridBit(channel_index, position, active)

        # Set velocity for this step (if active)
        if active and "velocity" in step:
            # Velocity range: 0-127 for step params
            vel = int(step["velocity"] * 127)
            channels.setStepParameterByIndex(
                channel_index, pattern_num, position, pVelocity, vel
            )

    return {"success": True}
```

### Anti-Patterns to Avoid

- **Importing flpianoroll in the MIDI Controller Script:** This will fail. `flpianoroll` is only available in Piano Roll Scripts (.pyscript). The FL Bridge CANNOT use it.

- **Using channels.midiNoteOn for persistent note creation:** `midiNoteOn` triggers notes in real-time (like pressing a key) but does NOT write them to the pattern unless FL Studio is recording. Unreliable for composition.

- **Putting music theory in Python/FL Bridge:** Keep all chord/scale/melody logic in TypeScript where tonal library is available. FL Bridge should receive pre-computed MIDI note numbers.

- **Assuming fixed PPQ:** FL Studio's default PPQ is 96, but users can change it. Always read `score.PPQ` (in .pyscript) or `general.getRecPPQ()` (in MIDI controller script) at runtime.

- **Hardcoding 16 steps for step sequencer:** Step count can vary. Use pattern length information to determine step count.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Note name to MIDI number | Custom lookup table | `tonal` `Note.midi("C4")` | Handles accidentals, octaves, enharmonics correctly |
| Scale note generation | Manual interval math | `tonal` `Scale.get("C major")` | Supports 70+ scale types, handles edge cases |
| Chord voicing | Manual semitone offsets | `tonal` `Chord.get("Cmaj7")` | Supports complex jazz chords, inversions, slash chords |
| Roman numeral to chord | Switch statement | Map with tonal's `Key` module | Handles major/minor key differences, borrowed chords |
| Note timing conversion | Manual PPQ math | Centralized `beatsToTicks(beats, ppq)` helper | One place to handle PPQ, avoids off-by-one everywhere |
| Piano roll note creation | Custom binary format | `flpianoroll.score.addNote()` via .pyscript | Full-fidelity: velocity, pan, filter, slide, porta, color |

**Key insight:** Music theory is well-solved. Use `tonal` for all theory. The novel work is the bridge between MCP commands and FL Studio's dual-API system.

## Common Pitfalls

### Pitfall 1: flpianoroll Not Available in MIDI Controller Scripts

**What goes wrong:** Attempting to `import flpianoroll` in the FL Bridge Python script fails silently or throws ImportError.
**Why it happens:** FL Studio has two completely separate Python scripting environments. MIDI Controller Scripts and Piano Roll Scripts cannot share modules.
**How to avoid:** Use the Hybrid Approach: FL Bridge writes JSON, companion .pyscript reads it and uses flpianoroll.
**Warning signs:** ImportError on flpianoroll, notes not appearing despite no error.

### Pitfall 2: Piano Roll Must Be Open and Focused

**What goes wrong:** Piano roll script operations fail or affect wrong channel when piano roll is not visible.
**Why it happens:** Piano roll scripts operate on the CURRENTLY VISIBLE piano roll. If no piano roll is open, or the wrong channel's piano roll is shown, notes go to the wrong place or nowhere.
**How to avoid:**
1. Use `ui.showWindow(3)` from the MIDI Controller Script to ensure piano roll is open
2. Select the target channel first with `channels.selectOneChannel(index)`
3. Verify piano roll visibility with `ui.getVisible(3)`
**Warning signs:** Notes appearing in wrong channel, or "no pending request" errors.

### Pitfall 3: PPQ Mismatch Between Server and FL Studio

**What goes wrong:** Notes placed at wrong times - early, late, or squished together.
**Why it happens:** MCP server assumes PPQ=96 but project uses different value. Time calculations are off.
**How to avoid:** Always read PPQ from FL Studio at runtime. Pass timing in beats (quarter notes), convert to ticks in the .pyscript using `score.PPQ`.
**Warning signs:** Notes that look correct in data but are positioned wrong in piano roll.

### Pitfall 4: Keyboard Shortcut Trigger Fragility

**What goes wrong:** The keyboard shortcut (Ctrl+Alt+Y) to trigger the piano roll script doesn't work.
**Why it happens:** Shortcut depends on piano roll being focused, correct script being "last run", and FL Studio version. Some setups don't support this shortcut.
**How to avoid:**
1. Document manual trigger path as fallback: Tools > Scripting > [script name]
2. Consider alternative trigger: have the user assign a custom shortcut
3. Design the system so the trigger step is explicit rather than automated
4. Explore using `ui.showWindow(3)` + script auto-selection
**Warning signs:** Script works manually from menu but not via shortcut.

### Pitfall 5: Note Velocity Scale Difference

**What goes wrong:** Notes too quiet or too loud.
**Why it happens:** `flpianoroll.Note.velocity` is 0.0-1.0 (float), but standard MIDI velocity is 0-127 (int). Step sequencer `setStepParameterByIndex` with `pVelocity` uses 0-127 range. Mixing them up causes wrong dynamics.
**How to avoid:** Standardize on 0.0-1.0 in the JSON exchange format and MCP tools. Convert to 0-127 only when needed for step sequencer.
**Warning signs:** All notes at full volume, or barely audible notes.

### Pitfall 6: File Path Issues Across Environments

**What goes wrong:** Piano roll script can't find the JSON file written by FL Bridge.
**Why it happens:** Different working directories, path separator issues, user profile path differences.
**How to avoid:** Use absolute paths based on `os.path.expanduser("~")`. Store shared files in a known location within the fl-bridge directory structure. Use `os.path.join()` for all path construction.
**Warning signs:** FileNotFoundError in piano roll script output.

## Code Examples

### MCP Tool: Create Chord Progression

```typescript
// Source: tonal docs + existing MCP tool pattern
import { Note, Scale, Chord } from "tonal";
import { z } from "zod";

const chordProgressionSchema = {
  key: z.string().describe('Musical key, e.g., "C", "Am", "F#"'),
  scale: z.string().default("major").describe('Scale type: "major", "minor", "dorian", etc.'),
  progression: z.array(z.string()).describe('Roman numerals: ["I", "V", "vi", "IV"]'),
  octave: z.number().int().min(1).max(8).default(4).describe('Base octave'),
  beatsPerChord: z.number().default(4).describe('Duration of each chord in beats'),
  velocity: z.number().min(0).max(1).default(0.8).describe('Note velocity 0-1'),
};

// In tool handler:
async ({ key, scale, progression, octave, beatsPerChord, velocity }) => {
  const notes = generateChordProgression(key, scale, progression, octave, beatsPerChord, velocity);
  const result = await connection.executeCommand("pianoroll.addNotes", { notes });
  return { content: [{ type: "text", text: `Added ${notes.length} notes...` }] };
};
```

### FL Bridge Handler: Write JSON and Signal

```python
# Source: existing handler pattern + calvinw approach
import json
import os

try:
    import ui
    import channels
except ImportError:
    ui = None
    channels = None

from protocol.commands import register_handler

# Shared data directory path
SHARED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shared')

def handle_pianoroll_add_notes(params):
    """Write note data to JSON for piano roll script to consume."""
    try:
        notes = params.get("notes", [])
        if not notes:
            return {"success": False, "error": "No notes provided"}

        # Ensure shared directory exists
        os.makedirs(SHARED_DIR, exist_ok=True)

        # Write request JSON
        request = {
            "action": "add_notes",
            "notes": notes,
        }

        request_path = os.path.join(SHARED_DIR, "note_request.json")
        with open(request_path, "w") as f:
            json.dump(request, f)

        # Ensure piano roll is visible
        if ui is not None:
            # Select target channel if specified
            channel = params.get("channel")
            if channel is not None and channels is not None:
                channels.selectOneChannel(channel)

            ui.showWindow(3)  # widPianoRoll = 3

        return {
            "success": True,
            "noteCount": len(notes),
            "message": "Notes queued. Trigger piano roll script to apply.",
            "triggerHint": "Run ComposeWithBridge from Piano Roll > Tools > Scripting"
        }

    except Exception as e:
        return {"success": False, "error": str(e)}

def handle_pianoroll_read_state(params):
    """Read the exported piano roll state."""
    try:
        state_path = os.path.join(SHARED_DIR, "piano_roll_state.json")
        if not os.path.exists(state_path):
            return {"success": False, "error": "No piano roll state available"}

        with open(state_path, "r") as f:
            state = json.load(f)

        return {"success": True, **state}

    except Exception as e:
        return {"success": False, "error": str(e)}

register_handler("pianoroll.addNotes", handle_pianoroll_add_notes)
register_handler("pianoroll.readState", handle_pianoroll_read_state)
```

### Note Properties Reference (flpianoroll.Note)

```python
# Source: IL-Group FL-Studio-API-Stubs piano_roll_scripting/flpianoroll/note
# All properties of a Note object in the piano roll:

note = flp.Note()
note.number = 60       # int, 0-127, MIDI note number (60 = middle C / C5)
note.time = 0          # int, position in ticks (multiply beats * PPQ)
note.length = 96       # int, duration in ticks (96 = 1 quarter note at PPQ=96)
note.group = 0         # int, group number for linked notes (0 = ungrouped)
note.pan = 0.5         # float, 0-1, panning (0.5 = center)
note.velocity = 0.8    # float, 0-1, note velocity
note.release = 0.5     # float, 0-1, release value
note.color = 0         # int, 0-15, note color in piano roll
note.fcut = 0.5        # float, 0-1, filter cutoff
note.fres = 0.5        # float, 0-1, filter resonance
note.pitchofs = 0      # int, -120 to 120, pitch offset in 10-cent units
note.repeats = 0       # int, 0-14, repeat subdivisions
note.slide = False     # bool, slide note
note.porta = False     # bool, portamento note
note.muted = False     # bool, muted
note.selected = False  # bool, selected in piano roll
```

### Scale Locking Implementation

```typescript
// Source: tonal docs
import { Note, Scale } from "tonal";

/**
 * Constrain a MIDI note to the nearest note in the given scale.
 */
function snapToScale(midiNote: number, root: string, scaleName: string): number {
  const scale = Scale.get(`${root} ${scaleName}`);
  const scaleNotes = scale.notes;

  // Get all MIDI numbers for this scale across all octaves
  const scaleMidi: number[] = [];
  for (let octave = 0; octave <= 10; octave++) {
    for (const noteName of scaleNotes) {
      const midi = Note.midi(`${noteName}${octave}`);
      if (midi !== null) scaleMidi.push(midi);
    }
  }

  // Find closest scale note
  let closest = scaleMidi[0];
  let minDist = Math.abs(midiNote - closest);

  for (const sn of scaleMidi) {
    const dist = Math.abs(midiNote - sn);
    if (dist < minDist) {
      closest = sn;
      minDist = dist;
    }
  }

  return closest;
}

/**
 * Check if a MIDI note is in the given scale.
 */
function isInScale(midiNote: number, root: string, scaleName: string): boolean {
  const scale = Scale.get(`${root} ${scaleName}`);
  const noteChroma = midiNote % 12;
  return scale.chroma.split("").some((bit, idx) =>
    bit === "1" && idx === noteChroma
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| flpianoroll direct from MIDI script | Hybrid: JSON file + .pyscript companion | N/A (never worked directly) | Must use two-part architecture |
| Custom music theory code | tonal library (npm) | Mature (v6.x) | Don't write chord/scale logic by hand |
| Recording MIDI notes in real-time | Direct score manipulation via .pyscript | FL Studio 21.1+ | Deterministic, no timing jitter |
| Step sequencer only | Piano roll script for rich notes | FL Studio 21.1+ (Piano Roll Scripting) | Full note properties (velocity, pan, filter, slide) |

**Deprecated/outdated:**
- **channels.midiNoteOn for composition:** Only for real-time triggering, not persistent note creation
- **Step sequencer for melodies:** Too limited; use piano roll for anything beyond drums

## Key API Reference

### FL Studio Window Constants (for ui module)

| Constant | Value | Window |
|----------|-------|--------|
| widMixer | 0 | Mixer |
| widChannelRack | 1 | Channel Rack |
| widPlaylist | 2 | Playlist |
| widPianoRoll | 3 | Piano Roll |
| widBrowser | 4 | Browser |

### Step Parameter Constants (for channels module)

| Constant | Value | Description |
|----------|-------|-------------|
| pPitch | 0 | Note pitch |
| pVelocity | 1 | Velocity (0-127) |
| pRelease | 2 | Release velocity |
| pFinePitch | 3 | Fine pitch |
| pPan | 4 | Panning |
| pModX | 5 | Mod X value |
| pModY | 6 | Mod Y value |
| pShift | 7 | Shift |
| pRepeat | 8 | Repeat |

### FL Studio Timing

- Default PPQ: 96 ticks per quarter note (configurable per project)
- 4 steps per beat (default)
- 16 steps per bar (in 4/4 time)
- Read PPQ at runtime: `general.getRecPPQ()` (MIDI script) or `score.PPQ` (.pyscript)
- 1 bar = 4 beats = PPQ * 4 ticks = 384 ticks (at PPQ=96)
- 1 beat = PPQ ticks = 96 ticks (at PPQ=96)
- 1 16th note = PPQ / 4 = 24 ticks (at PPQ=96)

### MIDI Note Numbers (Common Reference)

| Note | MIDI | Note | MIDI |
|------|------|------|------|
| C3 | 48 | C5 | 72 |
| C4 (middle C) | 60 | C6 | 84 |
| A4 (440Hz) | 69 | C7 | 96 |

Note: FL Studio uses C5 = 60 convention (some software uses C4 = 60). Verify in FL Studio.

## Open Questions

1. **Keyboard Shortcut Trigger Reliability**
   - What we know: calvinw/fl-studio-mcp uses Ctrl+Alt+Y to trigger the piano roll script
   - What's unclear: Whether this shortcut works reliably across FL Studio versions and Windows configurations. The official piano roll scripting docs do NOT document any keyboard shortcut for re-running scripts.
   - Recommendation: Design the MCP UX so the user can manually trigger the script from the piano roll menu. Explore programmatic trigger as enhancement. The FL Bridge response should include clear instructions.

2. **Piano Roll Channel Targeting**
   - What we know: `channels.selectOneChannel(index)` selects a channel, and `ui.showWindow(3)` opens the piano roll
   - What's unclear: Whether opening the piano roll after selecting a channel reliably shows THAT channel's piano roll
   - Recommendation: Test in FL Studio. May need `channels.selectOneChannel()` then `ui.showWindow(3)` in sequence.

3. **Concurrent Request Handling**
   - What we know: JSON file-based IPC is inherently sequential
   - What's unclear: What happens if MCP sends a second note command before the first .pyscript run completes
   - Recommendation: Use a request queue (array of actions in the JSON) or implement a simple lock file mechanism.

4. **SysEx Size Limits for Large Note Arrays**
   - What we know: SysEx messages have practical size limits. A chord progression might have 20-50 notes. A full melody could have 100+ notes.
   - What's unclear: Exact SysEx size limit through loopMIDI and FL Studio
   - Recommendation: The JSON file approach sidesteps this - only the command metadata goes over SysEx, the actual note data is in the JSON file on disk.

5. **Piano Roll Script Discovery Path**
   - What we know: .pyscript files go in `Documents/Image-Line/FL Studio/Settings/Piano roll scripts/`
   - What's unclear: Whether a .pyscript can be placed in a subdirectory there, or must be at root level
   - Recommendation: Test both. Place at root level initially for reliability.

## Sources

### Primary (HIGH confidence)
- [FL Studio API Stubs - flpianoroll](https://il-group.github.io/FL-Studio-API-Stubs/piano_roll_scripting/flpianoroll/) - Module overview, NOT accessible in MIDI scripts
- [FL Studio API Stubs - Score](https://il-group.github.io/FL-Studio-API-Stubs/piano_roll_scripting/flpianoroll/score/) - addNote, getNote, deleteNote, clearNotes, PPQ, noteCount
- [FL Studio API Stubs - Note](https://il-group.github.io/FL-Studio-API-Stubs/piano_roll_scripting/flpianoroll/note/) - Note properties (number, time, length, velocity, pan, etc.)
- [FL Studio API Stubs - channels module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/channels/) - setGridBit, getGridBit, midiNoteOn, setStepParameterByIndex
- [FL Studio API Stubs - UI windows](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/ui/windows/) - showWindow, widPianoRoll constant
- [FL Studio API Stubs - Time Units](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/tutorials/time_units/) - PPQ, ticks, beats
- [FL Studio Official - Piano Roll Scripting API](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_scripting_api.htm) - .pyscript format, script locations
- [FL Studio Official - MIDI Scripting](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm) - channels functions, step parameters
- [IL-Group/FL-Studio-API-Stubs GitHub](https://github.com/IL-Group/FL-Studio-API-Stubs) - Source stubs for channels/__sequencer.py, channels/__notes.py
- [tonal.js](https://github.com/tonaljs/tonal) - TypeScript music theory library, Note.midi(), Scale.get(), Chord.get()
- [tonal Getting Started](https://tonaljs.github.io/tonal/docs) - API reference

### Secondary (MEDIUM confidence)
- [calvinw/fl-studio-mcp](https://github.com/calvinw/fl-studio-mcp) - Proven hybrid approach: JSON + .pyscript + keyboard trigger
- [karl-andres/fl-studio-mcp](https://github.com/karl-andres/fl-studio-mcp) - MIDI controller + .pyscript combined approach
- [ohhalim/flstudio-mcp](https://github.com/ohhalim/flstudio-mcp) - MIDI recording approach (midiNoteOn + live recording)
- [TommyX12/music-copilot](https://github.com/TommyX12/music-copilot) - Piano roll script with subprocess for API calls

### Tertiary (LOW confidence)
- Ctrl+Alt+Y keyboard shortcut for re-running last piano roll script - mentioned in community projects, not in official docs
- channels.selectOneChannel() reliably targeting piano roll view - needs runtime validation
- SysEx message size limits through loopMIDI - needs empirical testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - tonal is well-established, FL Studio APIs well-documented
- Architecture (hybrid approach): HIGH - proven by multiple existing FL Studio MCP implementations
- Note creation API: HIGH - flpianoroll.score.addNote() is officially documented with clear signatures
- Piano Roll script triggering: MEDIUM - keyboard shortcut approach unverified in official docs
- Step sequencer fallback: HIGH - setGridBit/setStepParameterByIndex officially documented
- Music theory patterns: HIGH - tonal library API verified from official docs
- Pitfalls: HIGH - based on official documentation about module separation and API constraints

**Research date:** 2026-02-23
**Valid until:** 2026-04-23 (60 days - stable domain, FL Studio API changes infrequently)
