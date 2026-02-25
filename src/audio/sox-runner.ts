/**
 * SoX command builder and executor.
 * Wraps the SoX CLI for pitch-shifting, reversing, tempo changes,
 * mixing, merging, normalization, and file info queries.
 */

import { execFile as execFileCb } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

import { renderRegistry } from './render-registry.js';
import type { SampleInfo, SoxResult } from './types.js';

const execFile = promisify(execFileCb);

/** Timeout for all SoX operations (120 seconds). */
const SOX_TIMEOUT = 120_000;

/**
 * SoX command builder and executor class.
 * Each method maps to a specific SoX operation, building safe argument
 * arrays (never shell-interpolated) and returning typed results.
 */
export class SoxRunner {
  private readonly soxPath: string;

  constructor(soxPath?: string) {
    this.soxPath = soxPath ?? process.env.SOX_PATH ?? 'sox';
  }

  /**
   * Verify SoX is installed and accessible.
   * @returns Version string from `sox --version`.
   * @throws If SoX is not found or not executable.
   */
  async verify(): Promise<string> {
    try {
      const { stdout, stderr } = await this.run(['--version']);
      // SoX prints version to stdout (or stderr on some builds)
      const version = (stdout || stderr).trim();
      return version;
    } catch {
      throw new Error(
        'SoX is not installed or not in PATH. Install via: winget install --id ChrisBagwell.SoX -s winget'
      );
    }
  }

  /**
   * Core executor -- runs SoX with the given argument array.
   * All other methods delegate here.
   */
  async run(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const { stdout, stderr } = await execFile(this.soxPath, args, {
      timeout: SOX_TIMEOUT,
    });
    return { stdout: stdout ?? '', stderr: stderr ?? '' };
  }

  /** Pitch-shift a WAV file by the given number of cents. */
  async pitch(
    input: string,
    output: string,
    cents: number
  ): Promise<SoxResult> {
    const args = [input, output, 'pitch', String(cents)];
    await this.run(args);
    return {
      outputPath: output,
      command: `sox ${args.join(' ')}`,
    };
  }

  /** Reverse a WAV file. */
  async reverse(input: string, output: string): Promise<SoxResult> {
    const args = [input, output, 'reverse'];
    await this.run(args);
    return {
      outputPath: output,
      command: `sox ${args.join(' ')}`,
    };
  }

  /** Change tempo of a WAV file (music mode). */
  async tempo(
    input: string,
    output: string,
    factor: number
  ): Promise<SoxResult> {
    const args = [input, output, 'tempo', '-m', String(factor)];
    await this.run(args);
    return {
      outputPath: output,
      command: `sox ${args.join(' ')}`,
    };
  }

  /**
   * Mix (downmix) multiple inputs into a single output.
   * If volumes provided, each input gets the corresponding volume.
   * Otherwise, auto-balances at 1/N per input.
   */
  async mix(
    inputs: string[],
    output: string,
    volumes?: number[]
  ): Promise<SoxResult> {
    const vols = volumes ?? inputs.map(() => 1 / inputs.length);
    const interleaved: string[] = [];
    for (let i = 0; i < inputs.length; i++) {
      interleaved.push('-v', String(vols[i]), inputs[i]);
    }
    const args = ['-m', ...interleaved, output];
    await this.run(args);
    return {
      outputPath: output,
      command: `sox ${args.join(' ')}`,
    };
  }

  /** Merge inputs into a multi-channel output. */
  async merge(inputs: string[], output: string): Promise<SoxResult> {
    const args = ['-M', ...inputs, output];
    await this.run(args);
    return {
      outputPath: output,
      command: `sox ${args.join(' ')}`,
    };
  }

  /** Normalize audio to 0 dBFS peak. */
  async normalize(input: string, output: string): Promise<SoxResult> {
    const args = [input, output, 'gain', '-n'];
    await this.run(args);
    return {
      outputPath: output,
      command: `sox ${args.join(' ')}`,
    };
  }

  /** Retrieve metadata about a WAV file via SoX --i. */
  async info(input: string): Promise<SampleInfo> {
    const { stdout } = await this.run(['--i', input]);

    const channelsMatch = stdout.match(/Channels\s*:\s*(\d+)/);
    const sampleRateMatch = stdout.match(/Sample Rate\s*:\s*(\d+)/);
    const samplesMatch = stdout.match(/Duration\s*:.*=\s*(\d+)\s*samples/);
    const precisionMatch = stdout.match(/Precision\s*:\s*(.+)/);

    const channels = channelsMatch ? parseInt(channelsMatch[1], 10) : 0;
    const sampleRate = sampleRateMatch
      ? parseInt(sampleRateMatch[1], 10)
      : 0;
    const samples = samplesMatch ? parseInt(samplesMatch[1], 10) : 0;
    const precision = precisionMatch ? precisionMatch[1].trim() : 'unknown';
    const duration = sampleRate > 0 ? samples / sampleRate : 0;

    return {
      path: input,
      sampleRate,
      channels,
      duration,
      samples,
      precision,
    };
  }
}

/** Singleton SoxRunner instance. */
export const soxRunner = new SoxRunner();

// Re-export SoxResult for convenience
export type { SoxResult } from './types.js';

// ---------------------------------------------------------------------------
// File resolution utilities
// ---------------------------------------------------------------------------

/** Default renders directory (matches Phase 6 convention). */
function getDefaultRenderDir(): string {
  return join(homedir(), 'Documents', 'FL Studio MCP', 'Renders');
}

/** Default samples output directory. */
export function getDefaultSampleDir(): string {
  return join(homedir(), 'Documents', 'FL Studio MCP', 'Samples');
}

/**
 * Resolve an input file reference to an absolute path.
 *
 * Resolution order:
 * 1. Render registry lookup by filename
 * 2. Absolute path that exists on disk
 * 3. Relative to default renders directory
 * 4. Relative to default samples directory
 *
 * @throws If the file cannot be found via any strategy.
 */
export function resolveInputFile(filenameOrPath: string): string {
  // 1. Check render registry
  const render = renderRegistry.getByFilename(filenameOrPath);
  if (render) {
    return render.path;
  }

  // 2. Absolute path that exists
  if (isAbsolute(filenameOrPath) && existsSync(filenameOrPath)) {
    return filenameOrPath;
  }

  // 3. Default renders directory
  const inRenders = join(getDefaultRenderDir(), filenameOrPath);
  if (existsSync(inRenders)) {
    return inRenders;
  }

  // 4. Default samples directory
  const inSamples = join(getDefaultSampleDir(), filenameOrPath);
  if (existsSync(inSamples)) {
    return inSamples;
  }

  throw new Error(
    `File not found: "${filenameOrPath}". Use list_renders to see available files, or provide an absolute path.`
  );
}

/**
 * Generate a descriptive output filename for a SoX operation.
 *
 * Example: generateOutputFilename('lead.wav', 'pitch', '-1200') => 'lead_pitch_-1200.wav'
 */
export function generateOutputFilename(
  inputFilename: string,
  operation: string,
  suffix?: string
): string {
  const base = basename(inputFilename, extname(inputFilename));
  return [base, operation, suffix].filter(Boolean).join('_') + '.wav';
}
