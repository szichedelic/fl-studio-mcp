# Phase 7: Sample Manipulation - Research

**Researched:** 2026-02-25
**Domain:** Audio processing via SoX CLI, Node.js child_process integration, stereo detune/layering techniques, resampling workflow orchestration
**Confidence:** HIGH (SoX is mature/stable at v14.4.2; Node.js child_process is well-documented; project patterns are established)

## Summary

Phase 7 implements audio sample manipulation tools that operate on WAV files produced by Phase 6's render workflow. The core approach, decided in STATE.md, is to use **SoX (Sound eXchange) CLI** invoked via Node.js `child_process.execFile`. SoX is the standard command-line audio processing tool, supporting pitch shifting, time stretching, reversing, mixing/merging, and effects chaining -- all the operations required by SAM-01 through SAM-04.

The architecture follows the existing MCP tool pattern: new TypeScript modules under `src/audio/` encapsulate SoX command building and execution, while new MCP tools under `src/tools/sample.ts` expose natural-language-friendly operations. Input files come from the Phase 6 `renderRegistry` or from user-specified paths. Output files go to a configurable directory (default: `~/Documents/FL Studio MCP/Samples/`). The stereo detune/layering feature (SAM-04) requires a multi-step SoX pipeline: pitch-shift copies at different cent offsets, optionally add micro-delay, then merge into a stereo file.

SAM-05 (full resampling workflow) is an orchestration concern, not a new technical capability -- it chains Phase 2 (note generation), Phase 6 (render), Phase 7 (manipulate), and then provides reload instructions (drag-and-drop, since FL Studio has no sample-loading API).

**Primary recommendation:** Build a `SoxRunner` class that constructs and executes SoX commands via `promisify(execFile)`. Expose 4-5 MCP tools (`sample_pitch`, `sample_reverse`, `sample_timestretch`, `sample_layer`, `sample_info`) that accept render registry filenames or absolute paths and produce new WAV files. Detect SoX availability at server startup and provide a clear error if not found.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SoX CLI | 14.4.2 | Audio processing (pitch, reverse, tempo, mix, merge) | The standard CLI audio tool; 30+ years of development; cross-platform; supports all needed operations natively |
| node:child_process | Built-in | Execute SoX commands from Node.js | Standard Node.js API for spawning external processes |
| node:util (promisify) | Built-in | Promise-wrap execFile for async/await | Standard pattern for callback-to-promise conversion |
| node:path | Built-in | Path manipulation for input/output files | Already used throughout project |
| node:fs/promises | Built-in | File existence checks, directory creation | Already used in Phase 6 |
| zod (already installed) | ^3.25.30 | MCP tool input validation | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| renderRegistry (Phase 6) | Already built | Resolve render filenames to absolute paths | Every sample manipulation tool that references a render |
| renderWatcher (Phase 6) | Already built | Detect new WAV files (manipulation outputs could be watched too) | Optional: watch output directory |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SoX CLI via child_process | node-sox.js npm wrapper | Unmaintained (limited activity), no TypeScript types, only 18 GitHub stars. Raw child_process is cleaner and gives full control over SoX arguments. |
| SoX CLI via child_process | sox-audio npm wrapper | Also low maintenance, adds abstraction we don't need. Our command set is small and well-defined. |
| SoX CLI via child_process | ffmpeg | ffmpeg is better for video/container formats; SoX is purpose-built for audio effects and has better pitch/tempo algorithms. User already decided on SoX. |
| promisify(execFile) | execa npm package | execa adds a dependency for marginal benefit. Built-in promisified execFile is sufficient for our use case. |
| Raw SoX commands | pysox (Python) | We're a Node.js/TypeScript project. No reason to bring in Python for this. |

**Installation:**

SoX must be installed on the system (it is an external CLI tool, not an npm package):
```bash
# Windows (winget)
winget install --id ChrisBagwell.SoX -s winget

# Windows (chocolatey)
choco install sox.portable

# Manual: Download from https://sourceforge.net/projects/sox/files/sox/14.4.2/
# Add sox.exe directory to PATH
```

No new npm dependencies are needed. All Node.js APIs used are built-in.

## Architecture Patterns

### Recommended Project Structure

```
src/
  audio/
    sox-runner.ts          # NEW: SoX command builder and executor
    sample-registry.ts     # NEW: Track manipulated sample outputs
    render-registry.ts     # EXISTING: Phase 6 render tracking
    render-watcher.ts      # EXISTING: Phase 6 file watcher
    types.ts               # MODIFY: Add SampleInfo, SoxEffect types
  tools/
    sample.ts              # NEW: MCP tools for sample manipulation
    index.ts               # MODIFY: Register sample tools
```

### Pattern 1: SoxRunner -- Command Builder and Executor

**What:** A class that builds SoX CLI argument arrays and executes them via promisified `execFile`. Encapsulates all SoX interaction behind a typed TypeScript API.
**When to use:** Every sample manipulation operation.

```typescript
// src/audio/sox-runner.ts
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

const execFile = promisify(execFileCb);

/** Result of a SoX operation */
export interface SoxResult {
  outputPath: string;
  command: string;  // For debugging/logging
}

export class SoxRunner {
  private soxPath: string;

  constructor(soxPath: string = 'sox') {
    this.soxPath = soxPath;
  }

  /**
   * Verify SoX is available on the system.
   * Call once at startup. Throws if SoX not found.
   */
  async verify(): Promise<string> {
    try {
      const { stdout } = await execFile(this.soxPath, ['--version']);
      return stdout.trim();
    } catch {
      throw new Error(
        'SoX is not installed or not in PATH. ' +
        'Install via: winget install --id ChrisBagwell.SoX -s winget'
      );
    }
  }

  /**
   * Execute a SoX command with the given arguments.
   */
  async run(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const { stdout, stderr } = await execFile(this.soxPath, args, {
      timeout: 60000,  // 60 second timeout for long operations
    });
    return { stdout, stderr };
  }

  /** Pitch shift a WAV file by cents (100 cents = 1 semitone) */
  async pitch(input: string, output: string, cents: number): Promise<SoxResult> {
    const args = [input, output, 'pitch', String(cents)];
    await this.run(args);
    return { outputPath: output, command: `sox ${args.join(' ')}` };
  }

  /** Reverse a WAV file */
  async reverse(input: string, output: string): Promise<SoxResult> {
    const args = [input, output, 'reverse'];
    await this.run(args);
    return { outputPath: output, command: `sox ${args.join(' ')}` };
  }

  /** Time-stretch a WAV file (factor: 0.5 = half speed, 2.0 = double speed) */
  async tempo(input: string, output: string, factor: number): Promise<SoxResult> {
    const args = [input, output, 'tempo', '-m', String(factor)];
    await this.run(args);
    return { outputPath: output, command: `sox ${args.join(' ')}` };
  }

  /** Mix multiple files together (equal weight) */
  async mix(inputs: string[], output: string): Promise<SoxResult> {
    const args = ['-m', ...inputs, output];
    await this.run(args);
    return { outputPath: output, command: `sox ${args.join(' ')}` };
  }

  /** Merge files into multi-channel (e.g., two mono -> one stereo) */
  async merge(inputs: string[], output: string): Promise<SoxResult> {
    const args = ['-M', ...inputs, output];
    await this.run(args);
    return { outputPath: output, command: `sox ${args.join(' ')}` };
  }

  /** Get file info using soxi-equivalent */
  async info(input: string): Promise<{
    sampleRate: number;
    channels: number;
    duration: number;
    samples: number;
  }> {
    const { stdout } = await this.run(['--i', input]);
    // Parse the output
    // ...
    return { sampleRate: 0, channels: 0, duration: 0, samples: 0 };
  }
}
```

### Pattern 2: Stereo Detune Pipeline (SAM-04)

**What:** A multi-step SoX workflow that creates a stereo-widened, detuned version of a sample. This is the most complex operation.
**When to use:** When user wants to create "thick" or "wide" textures from a single sample.

The technique:
1. Pitch-shift the input UP by N cents (e.g., +8 cents) -> left channel source
2. Pitch-shift the input DOWN by N cents (e.g., -8 cents) -> right channel source
3. Optionally add a micro-delay (5-15ms) to one channel for more width
4. Merge the two into a stereo file using `sox -M left.wav right.wav output.wav`
5. Normalize the result to prevent clipping

```typescript
// Stereo detune workflow
async function stereoDetune(
  runner: SoxRunner,
  input: string,
  output: string,
  detuneCents: number = 8,
  delayMs: number = 0,
): Promise<SoxResult> {
  const dir = dirname(output);
  const base = basename(output, '.wav');
  const leftTmp = join(dir, `${base}_L_tmp.wav`);
  const rightTmp = join(dir, `${base}_R_tmp.wav`);

  try {
    // Step 1: Create pitch-shifted copies
    await runner.pitch(input, leftTmp, detuneCents);
    await runner.pitch(input, rightTmp, -detuneCents);

    // Step 2: Optionally delay the right channel
    if (delayMs > 0) {
      const delayedTmp = join(dir, `${base}_R_delayed_tmp.wav`);
      const delaySec = delayMs / 1000;
      await runner.run([rightTmp, delayedTmp, 'delay', String(delaySec)]);
      await rename(delayedTmp, rightTmp);
    }

    // Step 3: Merge left and right into stereo
    await runner.merge([leftTmp, rightTmp], output);

    // Step 4: Normalize to prevent clipping
    // (handled by SoX --norm if needed)

    return { outputPath: output, command: `stereo-detune pipeline` };
  } finally {
    // Clean up temp files
    await unlink(leftTmp).catch(() => {});
    await unlink(rightTmp).catch(() => {});
  }
}
```

### Pattern 3: File Resolution from Render Registry

**What:** MCP tools accept either a render registry filename or an absolute path. The resolver checks the registry first, then falls back to path checking.
**When to use:** Every sample manipulation tool's input resolution.

```typescript
// Resolve an input file from registry filename or absolute path
function resolveInputFile(filenameOrPath: string): string {
  // First: check the render registry by filename
  const render = renderRegistry.getByFilename(filenameOrPath);
  if (render) return render.path;

  // Second: check if it's an absolute path that exists
  if (isAbsolute(filenameOrPath) && existsSync(filenameOrPath)) {
    return filenameOrPath;
  }

  // Third: check in default renders directory
  const defaultPath = join(getDefaultRenderDir(), filenameOrPath);
  if (existsSync(defaultPath)) return defaultPath;

  throw new Error(
    `File not found: "${filenameOrPath}". ` +
    `Use list_renders to see available files, or provide an absolute path.`
  );
}
```

### Pattern 4: Output Filename Generation

**What:** Generate descriptive output filenames that indicate what operation was performed.
**When to use:** When the user doesn't specify a custom output filename.

```typescript
function generateOutputFilename(
  inputFilename: string,
  operation: string,
  suffix?: string,
): string {
  const base = basename(inputFilename, extname(inputFilename));
  const parts = [base, operation];
  if (suffix) parts.push(suffix);
  return parts.join('_') + '.wav';
}

// Examples:
// "my_pattern_render.wav" + "pitch" + "up_5st" -> "my_pattern_render_pitch_up_5st.wav"
// "bass_render.wav" + "reversed" -> "bass_render_reversed.wav"
// "pad_render.wav" + "stretched" + "2x" -> "pad_render_stretched_2x.wav"
```

### Anti-Patterns to Avoid

- **Calling SoX with `exec` instead of `execFile`:** `exec` spawns a shell, which is unnecessary and introduces shell injection risks. Use `execFile` which calls the binary directly.
- **Not checking SoX availability before tool use:** If SoX is not installed, the error from `execFile` is cryptic ("ENOENT"). Check at server startup and provide a clear installation message.
- **Overwriting input files:** SoX can sometimes write to the same file as input, but this is fragile. Always use a separate output path, even for in-place-style operations.
- **Ignoring SoX stderr:** SoX writes progress and warnings to stderr. Capture and log it for debugging but don't treat it as an error (SoX often writes informational messages to stderr even on success).
- **Building one giant SoX command for stereo detune:** The detune effect requires multiple SoX invocations (pitch left, pitch right, merge). Don't try to do it in one command -- SoX's effects chain runs sequentially on a single file.
- **Using `speed` when you want `pitch` or `tempo`:** `speed` changes BOTH pitch and duration (like playing a tape faster). `pitch` changes pitch without duration. `tempo` changes duration without pitch. Use the right one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pitch shifting | Custom FFT-based pitch shifter | SoX `pitch` effect | SoX uses WSOLA algorithm, handles edge cases, anti-aliasing |
| Time stretching | Custom time-domain stretcher | SoX `tempo` effect | WSOLA with configurable segment/search/overlap parameters |
| Audio reversal | Manual WAV sample reversal | SoX `reverse` effect | SoX handles headers, multi-channel, different bit depths correctly |
| Audio mixing/layering | Custom sample-by-sample addition | SoX `-m` (mix) combiner | SoX handles different sample rates, bit depths, channel counts, and auto-balances volumes |
| Stereo merge | Custom interleaved WAV writer | SoX `-M` (merge) combiner | SoX handles WAV header creation, channel mapping |
| Audio normalization | Custom peak detection + scaling | SoX `gain -n` or `--norm` | Handles clipping prevention, multi-channel normalization |
| WAV file info parsing | Custom WAV header reader | SoX `--i` (soxi) flag | Returns sample rate, channels, duration, encoding, bit depth |
| Volume adjustment | Custom sample multiplication | SoX `-v` flag or `gain` effect | Handles clipping, bit depth conversion |

**Key insight:** SoX is a complete audio processing toolkit. Every audio operation in this phase has a direct SoX equivalent. The only "custom" code is the stereo detune pipeline, which is an orchestration of multiple SoX calls.

## Common Pitfalls

### Pitfall 1: SoX Not Installed or Not in PATH

**What goes wrong:** `execFile('sox', ...)` fails with ENOENT. The error message is unhelpful ("spawn sox ENOENT").
**Why it happens:** SoX is an external dependency that must be installed separately. Windows users may not have it.
**How to avoid:** Check SoX availability at MCP server startup using `sox --version`. If unavailable, log a clear warning with installation instructions. Each tool should also check and return a user-friendly error.
**Warning signs:** All sample tools fail with ENOENT errors.

### Pitfall 2: Confusing `speed`, `pitch`, and `tempo`

**What goes wrong:** User says "pitch down an octave" and the code uses `speed 0.5`, which changes both pitch AND duration. Or user says "slow down" and code uses `pitch`, which doesn't change duration.
**Why it happens:** SoX has three related but distinct effects:
- `speed factor` -- changes BOTH pitch and tempo (like vinyl speed change). Factor 2.0 = double speed + one octave up.
- `pitch cents` -- changes pitch WITHOUT changing duration. 1200 cents = 1 octave.
- `tempo factor` -- changes duration WITHOUT changing pitch. Factor 2.0 = double speed, same pitch.
**How to avoid:** Map user intent clearly:
- "Pitch up/down" -> `pitch` (cents)
- "Slow down / speed up without pitch change" -> `tempo` (factor)
- "Slow down with pitch change (vinyl effect)" -> `speed` (factor)
**Warning signs:** Output has unexpected duration or unexpected pitch.

### Pitfall 3: Temp File Cleanup on Error

**What goes wrong:** The stereo detune pipeline creates temporary files (pitch-shifted left/right channels). If SoX fails mid-pipeline, temp files are left behind.
**Why it happens:** Multi-step pipelines create intermediate files that should be cleaned up.
**How to avoid:** Use try/finally blocks to clean up temp files. Use a consistent temp file naming convention. Consider using `os.tmpdir()` for temp files.
**Warning signs:** Accumulating `_L_tmp.wav` and `_R_tmp.wav` files in the output directory.

### Pitfall 4: SoX stderr Is Not Always an Error

**What goes wrong:** Code treats any stderr output from SoX as an error and reports failure, even when the operation succeeded.
**Why it happens:** SoX writes informational messages (like "samples read", clipping warnings) to stderr. Only a non-zero exit code indicates failure.
**How to avoid:** Check the exit code (thrown as an error by `execFile` if non-zero). Log stderr for debugging but don't treat it as failure. Only report errors when `execFile` throws.
**Warning signs:** Tools report "errors" that aren't actually errors; operations succeed but tool says they failed.

### Pitfall 5: Path Escaping on Windows

**What goes wrong:** File paths with spaces (e.g., `C:\Users\jared\Documents\FL Studio MCP\Renders\my file.wav`) cause SoX to misparse arguments.
**Why it happens:** `execFile` handles argument quoting correctly when args are passed as an array (not a string). But if someone accidentally uses `exec` with string concatenation, spaces break it.
**How to avoid:** Always use `execFile` with an args array, never `exec` with string interpolation. Each path is a single array element, so spaces are handled automatically by the OS.
**Warning signs:** SoX errors like "can't open input file" for files that clearly exist.

### Pitfall 6: Large File Processing Timeouts

**What goes wrong:** `execFile` times out for very large WAV files or complex operations (like time-stretching a 5-minute render).
**Why it happens:** Default `execFile` timeout may be too short for large files.
**How to avoid:** Set a generous timeout (60 seconds minimum, 120 seconds for time-stretch/pitch operations). Consider logging progress to stderr if operations are slow.
**Warning signs:** Tools fail intermittently on larger files.

## Code Examples

### SoX Pitch Shifting (SAM-01)

```bash
# Pitch down by 1 octave (1200 cents)
sox input.wav output.wav pitch -1200

# Pitch up by 5 semitones (500 cents)
sox input.wav output.wav pitch 500

# Fine detune down by 50 cents (half a semitone)
sox input.wav output.wav pitch -50

# Pitch up by 7 semitones with normalization
sox input.wav output.wav pitch 700 gain -n
```

### SoX Reverse (SAM-02)

```bash
# Simple reverse
sox input.wav output.wav reverse

# Reverse with normalization
sox input.wav output.wav reverse gain -n
```

### SoX Time Stretch (SAM-03)

```bash
# Slow down to half speed (duration doubles), pitch unchanged
sox input.wav output.wav tempo -m 0.5

# Speed up to double speed (duration halves), pitch unchanged
sox input.wav output.wav tempo -m 2.0

# Slow to 75% speed, optimized for music
sox input.wav output.wav tempo -m 0.75

# Note: -m flag = "music" mode, best for musical content
# -s = "speech" mode, -l = "linear" mode
```

### SoX Mixing and Merging (SAM-04)

```bash
# Mix two files together (same duration assumed)
sox -m file1.wav file2.wav mixed.wav

# Mix with volume control (prevent clipping)
sox -m -v 0.5 file1.wav -v 0.5 file2.wav mixed.wav

# Merge two mono files into stereo (L/R channels)
sox -M left.wav right.wav stereo.wav

# Normalize after mixing
sox -m file1.wav file2.wav mixed.wav gain -n
```

### Stereo Detune Pipeline (SAM-04)

```bash
# Step 1: Create detuned copies
sox input.wav left_tmp.wav pitch 8
sox input.wav right_tmp.wav pitch -8

# Step 2 (optional): Add micro-delay to right channel for width
sox right_tmp.wav right_delayed_tmp.wav delay 0.012

# Step 3: Merge into stereo
sox -M left_tmp.wav right_delayed_tmp.wav output_stereo.wav

# Step 4: Normalize
sox output_stereo.wav output_final.wav gain -n

# Cleanup temp files (handled in code)
```

### File Info Query

```bash
# Get all file info (soxi mode)
sox --i input.wav

# Output example:
# Input File     : 'input.wav'
# Channels       : 2
# Sample Rate    : 44100
# Precision      : 16-bit
# Duration       : 00:00:04.52 = 199332 samples = 339.0 CDDA sectors
# File Size      : 797k
# Bit Rate       : 1.41M
# Sample Encoding: 16-bit Signed Integer PCM
```

### MCP Tool: sample_pitch

```typescript
// src/tools/sample.ts

const samplePitchSchema = {
  input: z.string()
    .describe('Input WAV filename (from list_renders) or absolute path'),
  semitones: z.number()
    .describe('Semitones to shift: positive = up, negative = down. Use 12 for one octave up, -12 for one octave down.'),
  outputFilename: z.string().optional()
    .describe('Custom output filename. Omit for auto-generated name.'),
};

server.tool(
  'sample_pitch',
  'Pitch-shift a WAV sample by a number of semitones without changing its duration.',
  samplePitchSchema,
  async ({ input, semitones, outputFilename }) => {
    try {
      const inputPath = resolveInputFile(input);
      const cents = Math.round(semitones * 100);
      const direction = semitones > 0 ? 'up' : 'down';
      const outName = outputFilename
        ?? generateOutputFilename(basename(inputPath), 'pitch', `${direction}_${Math.abs(semitones)}st`);
      const outputPath = join(getDefaultSampleDir(), outName);

      await mkdir(dirname(outputPath), { recursive: true });
      const result = await soxRunner.pitch(inputPath, outputPath, cents);

      return {
        content: [{
          type: 'text',
          text: [
            `Pitch shifted ${semitones > 0 ? 'up' : 'down'} by ${Math.abs(semitones)} semitone(s) (${cents} cents)`,
            `Input: ${inputPath}`,
            `Output: ${result.outputPath}`,
            '',
            'To use in FL Studio: drag this file into the Channel Rack or Sampler.',
          ].join('\n'),
        }],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Pitch shift failed: ${msg}` }],
        isError: true,
      };
    }
  }
);
```

### SoX Availability Check at Startup

```typescript
// In src/index.ts or src/audio/sox-runner.ts

import { execFileSync } from 'node:child_process';

function checkSoxAvailability(): string | null {
  try {
    const output = execFileSync('sox', ['--version'], { timeout: 5000 });
    return output.toString().trim();
  } catch {
    return null;
  }
}

// At startup:
const soxVersion = checkSoxAvailability();
if (soxVersion) {
  console.error(`[fl-studio-mcp] SoX available: ${soxVersion}`);
} else {
  console.error(
    '[fl-studio-mcp] WARNING: SoX is not installed. ' +
    'Sample manipulation tools will not work. ' +
    'Install via: winget install --id ChrisBagwell.SoX -s winget'
  );
}
```

## SoX Effects Quick Reference

Complete reference for the SoX effects used in this phase:

| Effect | Syntax | Unit | Example | What It Does |
|--------|--------|------|---------|--------------|
| `pitch` | `pitch [-q] cents` | cents (100 = 1 semitone) | `pitch -1200` | Change pitch, keep duration |
| `tempo` | `tempo [-q] [-m\|-s\|-l] factor` | ratio (1.0 = no change) | `tempo -m 0.5` | Change duration, keep pitch |
| `speed` | `speed [-c] factor` | ratio (1.0 = no change) | `speed 2.0` | Change BOTH pitch and duration |
| `reverse` | `reverse` | (none) | `reverse` | Reverse audio |
| `gain` | `gain [-n] [dB]` | decibels | `gain -n` | Amplify/normalize |
| `delay` | `delay seconds` | seconds | `delay 0.012` | Delay channel(s) |
| `pad` | `pad start end` | seconds | `pad 0.5 0` | Add silence |
| `trim` | `trim start [length]` | seconds | `trim 1.0 3.0` | Extract portion |
| `remix` | `remix chan-spec` | channel numbers | `remix 1` | Remap channels |
| `channels` | `channels N` | count | `channels 1` | Mono/stereo convert |
| `rate` | `rate [-q\|-h] Hz` | Hz | `rate 44100` | Resample |

**Combining files:**

| Mode | Flag | Syntax | What It Does |
|------|------|--------|--------------|
| Mix | `-m` | `sox -m in1.wav in2.wav out.wav` | Sum samples (layer audio) |
| Merge | `-M` | `sox -M in1.wav in2.wav out.wav` | Combine channels (L+R) |
| Concat | (default) | `sox in1.wav in2.wav out.wav` | Append sequentially |

**Volume per-file:** `-v factor` before each input file (e.g., `sox -m -v 0.7 a.wav -v 0.3 b.wav out.wav`)

**Global normalize:** `--norm` flag auto-normalizes output

## Cents/Semitone/Octave Reference

For pitch operations (used by `pitch` and `speed -c` effects):

| Musical Interval | Cents | Example |
|------------------|-------|---------|
| 1 cent | 1 | Imperceptible fine-tune |
| Quarter-tone | 50 | Microtonal interval |
| 1 semitone | 100 | C to C# |
| 1 whole tone | 200 | C to D |
| Minor 3rd | 300 | C to Eb |
| Major 3rd | 400 | C to E |
| Perfect 4th | 500 | C to F |
| Tritone | 600 | C to F# |
| Perfect 5th | 700 | C to G |
| 1 octave | 1200 | C4 to C5 |
| 2 octaves | 2400 | C4 to C6 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SoX `stretch` effect | SoX `tempo` effect | SoX 14.3+ | `tempo` is a superset of `stretch` with better defaults; `stretch` is deprecated |
| Browser-based audio processing (Web Audio API) | CLI-based processing (SoX) | Project decision v2.0 | More reliable, better quality, simpler architecture |
| Multiple npm audio packages | Single external tool (SoX) | Project decision v2.0 | One dependency, complete feature set, battle-tested |

**Deprecated/outdated:**
- SoX `stretch` effect: Deprecated in favor of `tempo`. Use `tempo -m factor` for music time-stretching.
- SoX development: No new releases since v14.4.2 (2015). This is stable, not abandoned -- the tool is feature-complete. No API changes expected.
- `soxmix` command: Old alias for `sox -m`. Use `sox -m` instead.

## MCP Tool Design

### Proposed Tools

| Tool Name | Purpose | Requirements Covered |
|-----------|---------|---------------------|
| `sample_pitch` | Pitch shift by semitones/cents | SAM-01 |
| `sample_reverse` | Reverse a sample | SAM-02 |
| `sample_timestretch` | Time-stretch without pitch change | SAM-03 |
| `sample_layer` | Layer/mix files with optional stereo detune | SAM-04 |
| `sample_info` | Get WAV file details (duration, sample rate, channels) | Supporting tool |

SAM-05 (full resampling workflow) is orchestration of existing tools, not a separate tool. The LLM already has all the tools it needs to chain the workflow.

### Input Resolution Strategy

All tools accept either:
1. A filename from the render registry (e.g., `"Pattern_1_render.wav"`)
2. An absolute path to any WAV file (e.g., `"C:/Users/jared/Documents/FL Studio MCP/Samples/bass_pitched.wav"`)

This lets users reference Phase 6 renders naturally and also work with files from the sample manipulation output directory.

### Output Directory

Default output: `~/Documents/FL Studio MCP/Samples/`

This is a sibling of the renders directory, keeping the project organized:
```
~/Documents/FL Studio MCP/
  Renders/     # Phase 6 output
  Samples/     # Phase 7 output
```

## Open Questions

1. **SoX installation on user's system**
   - What we know: SoX is NOT currently installed on this Windows 11 system (verified: `sox --version` returns "not found", `where sox` returns "not found").
   - What's unclear: Whether the user will install SoX before using these tools, or whether installation should be part of Phase 7 setup.
   - Recommendation: Phase 7 Plan 1 should include SoX installation as its first task. The `SoxRunner.verify()` method provides clear installation instructions if SoX is missing.

2. **SoX Windows PATH configuration**
   - What we know: The winget installer should add SoX to PATH automatically. The chocolatey `sox.portable` package may not.
   - What's unclear: Whether the MCP server process (started via Claude Code) will pick up PATH changes made during the same session.
   - Recommendation: Support a configurable SoX path (environment variable `SOX_PATH`) as a fallback if PATH detection fails. Default to `'sox'` for PATH lookup.

3. **SoX tempo quality for musical content**
   - What we know: `tempo -m` uses music-optimized WSOLA settings. Quality is good for small adjustments (0.5x to 2x). Extreme stretching (>4x) degrades quality.
   - What's unclear: Exact quality difference between `-m` (music), `-s` (speech), and `-l` (linear) for synthesizer content.
   - Recommendation: Default to `-m` (music mode). Document the flag options in the tool description so the LLM can choose based on context.

4. **Reload into FL Studio**
   - What we know: FL Studio has no API for loading samples into channels. STATE.md confirms "user drag-and-drop required (Phase 7)."
   - What's unclear: Whether there's a more automated path (e.g., putting files in a specific FL Studio folder).
   - Recommendation: Tools should return the output file path and clear instructions for drag-and-drop reload. This is consistent with Phase 6's guided manual workflow pattern.

## Sources

### Primary (HIGH confidence)
- [SoX man page (manpages.org)](https://manpages.org/sox) - Effect syntax, combining modes, global options
- [SoX man page (Debian)](https://manpages.debian.org/stretch/sox/sox.1.en.html) - gain, delay, pad syntax
- [PySoX API documentation](https://pysox.readthedocs.io/en/latest/api.html) - Verified exact parameters for pitch (semitones), tempo (factor + audio_type), speed, reverse, remix, gain, delay, pad, trim, channels, rate, Combiner class
- [Node.js child_process documentation](https://nodejs.org/api/child_process.html) - execFile, promisify pattern
- [SoX cheat sheet (GitHub Gist)](https://gist.github.com/ideoforms/d64143e2bad16b18de6e97b91de494fd) - Verified mix (-m), merge (-M), gain, reverse, trim, remix commands
- Phase 6 codebase (`src/audio/`, `src/tools/render.ts`) - Existing architecture patterns, render registry, file watcher

### Secondary (MEDIUM confidence)
- [SoX vs Rubberband comparison](https://www.justinsalamon.com/news/sox-vs-rubberband-for-pitch-shifting-and-time-stretching) - Quality assessment (content-dependent, no universal winner)
- [SoX SourceForge](https://sourceforge.net/projects/sox/) - Version 14.4.2 is latest release
- [SoX Wikipedia](https://en.wikipedia.org/wiki/SoX) - Cross-platform, last release 2015
- [KVR Audio forum on stereo widening](https://www.kvraudio.com/forum/viewtopic.php?t=431287) - Detune 8-10 cents, delay 11-14ms technique
- [node-sox.js GitHub](https://github.com/ArtskydJ/node-sox.js) - Evaluated and rejected (unmaintained, no TS types)

### Tertiary (LOW confidence)
- Exact quality difference between SoX tempo modes (-m, -s, -l) for synthesizer content (no authoritative comparison found)
- Whether SoX 14.4.2 Windows installer auto-adds to PATH (varied reports)
- Optimal detune amounts for different instrument types (musical preference, not technical fact)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - SoX is the decided tool (STATE.md), Node.js child_process is built-in and well-documented
- Architecture: HIGH - Follows established project patterns (Phase 6 tools, registry, types separation)
- SoX effects syntax: HIGH - Verified via official man pages and PySoX documentation cross-reference
- Stereo detune technique: MEDIUM - Multi-step pipeline verified via audio production best practices, but exact detune/delay values are artistic choices
- Pitfalls: HIGH - Based on concrete analysis of SoX CLI behavior, Windows path issues, and project constraints

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (SoX is stable at v14.4.2 since 2015; no changes expected)
