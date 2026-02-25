/**
 * Sample Manipulation Tools for FL Studio MCP
 *
 * Provides MCP tools for audio sample manipulation via SoX:
 * - sample_pitch: Pitch-shift a WAV sample by semitones
 * - sample_reverse: Reverse a WAV sample
 * - sample_timestretch: Time-stretch a WAV sample by a speed factor
 * - sample_info: Get detailed information about a WAV file
 * - sample_layer: Layer/mix multiple files, or stereo-detune a single sample
 *
 * All tools accept render registry filenames (from list_renders) or
 * absolute file paths as input. Processed files are saved to
 * ~/Documents/FL Studio MCP/Samples/ by default.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';
import { basename, dirname, join } from 'node:path';
import { mkdir, unlink } from 'node:fs/promises';
import {
  soxRunner,
  resolveInputFile,
  generateOutputFilename,
  getDefaultSampleDir,
} from '../audio/sox-runner.js';

/**
 * Register sample manipulation tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager (unused, kept for interface consistency)
 */
export function registerSampleTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  // ── sample_pitch ──────────────────────────────────────────────────

  server.tool(
    'sample_pitch',
    'Pitch-shift a WAV sample by semitones without changing duration. Use 12/-12 for octave up/down, 7/-7 for fifth up/down.',
    {
      input: z.string().describe('Input WAV filename (from list_renders) or absolute path'),
      semitones: z.number().describe(
        'Semitones to shift. Positive = up, negative = down. 12 = one octave up, -12 = one octave down.',
      ),
      outputFilename: z.string().optional().describe('Custom output filename. Omit for auto-generated name.'),
    },
    async ({ input, semitones, outputFilename }) => {
      try {
        const inputPath = resolveInputFile(input);
        const cents = Math.round(semitones * 100);

        const direction = semitones > 0 ? 'up' : semitones < 0 ? 'down' : 'no_change';
        const suffix = `${direction}_${Math.abs(semitones)}st`;
        const outName = outputFilename ?? generateOutputFilename(basename(inputPath), 'pitch', suffix);
        const outputPath = join(getDefaultSampleDir(), outName);

        await mkdir(dirname(outputPath), { recursive: true });
        const result = await soxRunner.pitch(inputPath, outputPath, cents);

        return {
          content: [{
            type: 'text' as const,
            text: [
              `Pitch-shifted by ${semitones} semitone(s) (${cents} cents) ${direction}.`,
              '',
              `Input:  ${inputPath}`,
              `Output: ${result.outputPath}`,
              '',
              'To use in FL Studio: drag this file into the Channel Rack or Sampler.',
            ].join('\n'),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `sample_pitch failed: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── sample_reverse ────────────────────────────────────────────────

  server.tool(
    'sample_reverse',
    'Reverse a WAV sample. Creates a new file with the audio played backwards.',
    {
      input: z.string().describe('Input WAV filename (from list_renders) or absolute path'),
      outputFilename: z.string().optional().describe('Custom output filename. Omit for auto-generated name.'),
    },
    async ({ input, outputFilename }) => {
      try {
        const inputPath = resolveInputFile(input);
        const outName = outputFilename ?? generateOutputFilename(basename(inputPath), 'reversed');
        const outputPath = join(getDefaultSampleDir(), outName);

        await mkdir(dirname(outputPath), { recursive: true });
        const result = await soxRunner.reverse(inputPath, outputPath);

        return {
          content: [{
            type: 'text' as const,
            text: [
              'Reversed audio successfully.',
              '',
              `Input:  ${inputPath}`,
              `Output: ${result.outputPath}`,
              '',
              'To use in FL Studio: drag this file into the Channel Rack or Sampler.',
            ].join('\n'),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `sample_reverse failed: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── sample_timestretch ────────────────────────────────────────────

  server.tool(
    'sample_timestretch',
    'Time-stretch a WAV sample without changing pitch. Factor < 1 slows down (longer), factor > 1 speeds up (shorter). Uses music-optimized WSOLA algorithm.',
    {
      input: z.string().describe('Input WAV filename (from list_renders) or absolute path'),
      factor: z.number().min(0.1).max(10).describe(
        'Speed factor. 0.5 = half speed (twice as long), 2.0 = double speed (half as long). Range: 0.1 to 10.',
      ),
      outputFilename: z.string().optional().describe('Custom output filename. Omit for auto-generated name.'),
    },
    async ({ input, factor, outputFilename }) => {
      try {
        const inputPath = resolveInputFile(input);
        const outName = outputFilename ?? generateOutputFilename(basename(inputPath), 'stretched', `${factor}x`);
        const outputPath = join(getDefaultSampleDir(), outName);

        await mkdir(dirname(outputPath), { recursive: true });
        const result = await soxRunner.tempo(inputPath, outputPath, factor);

        const speedDesc = factor < 1
          ? `${factor}x speed (${(1 / factor).toFixed(1)}x longer)`
          : factor > 1
            ? `${factor}x speed (${(1 / factor).toFixed(1)}x shorter)`
            : '1x speed (unchanged)';

        return {
          content: [{
            type: 'text' as const,
            text: [
              `Time-stretched at ${speedDesc}.`,
              '',
              `Input:  ${inputPath}`,
              `Output: ${result.outputPath}`,
              '',
              'To use in FL Studio: drag this file into the Channel Rack or Sampler.',
            ].join('\n'),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `sample_timestretch failed: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── sample_info ───────────────────────────────────────────────────

  server.tool(
    'sample_info',
    'Get detailed information about a WAV file: duration, sample rate, channels, bit depth.',
    {
      input: z.string().describe('Input WAV filename (from list_renders) or absolute path'),
    },
    async ({ input }) => {
      try {
        const inputPath = resolveInputFile(input);
        const info = await soxRunner.info(inputPath);

        // Format duration as mm:ss.ms
        const totalSeconds = info.duration;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds - minutes * 60;
        const formattedDuration = `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;

        const channelLabel = info.channels === 1 ? 'mono' : info.channels === 2 ? 'stereo' : `${info.channels}ch`;

        return {
          content: [{
            type: 'text' as const,
            text: [
              `Sample Info: ${basename(inputPath)}`,
              '─'.repeat(40),
              `  Path:        ${info.path}`,
              `  Duration:    ${formattedDuration}`,
              `  Sample Rate: ${info.sampleRate} Hz`,
              `  Channels:    ${info.channels} (${channelLabel})`,
              `  Precision:   ${info.precision}`,
              `  Samples:     ${info.samples.toLocaleString()}`,
            ].join('\n'),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `sample_info failed: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── sample_layer ─────────────────────────────────────────────────

  server.tool(
    'sample_layer',
    'Layer and mix audio files, or create a stereo-detuned version of a single sample for rich, wide textures. Supports two modes: "mix" layers multiple files together, "stereo_detune" creates a wide stereo effect from one file.',
    {
      inputs: z.array(z.string()).min(1).describe(
        'Input WAV filenames (from list_renders) or absolute paths. For stereo_detune mode, provide exactly 1 file.',
      ),
      mode: z.enum(['mix', 'stereo_detune']).default('mix').describe(
        'Mode: "mix" to layer multiple files together, "stereo_detune" to create a stereo-widened version of a single sample.',
      ),
      detuneCents: z.number().min(1).max(50).default(8).optional().describe(
        'For stereo_detune mode: detune amount in cents. 8 cents is subtle and musical. Range: 1-50.',
      ),
      delayMs: z.number().min(0).max(30).default(0).optional().describe(
        'For stereo_detune mode: micro-delay in ms applied to right channel for extra width. 0 = no delay. 10-15ms is typical for Haas effect.',
      ),
      outputFilename: z.string().optional().describe('Custom output filename. Omit for auto-generated name.'),
    },
    async ({ inputs, mode, detuneCents, delayMs, outputFilename }) => {
      try {
        if (mode === 'mix') {
          // ── Mix mode: layer multiple files ──────────────────────
          const inputPaths = inputs.map(resolveInputFile);
          if (inputPaths.length < 2) {
            return {
              content: [{ type: 'text' as const, text: 'sample_layer mix mode requires at least 2 input files.' }],
              isError: true,
            };
          }

          const outName = outputFilename ??
            generateOutputFilename(basename(inputPaths[0]), 'layered', `${inputPaths.length}files`);
          const outputPath = join(getDefaultSampleDir(), outName);
          await mkdir(dirname(outputPath), { recursive: true });

          // Auto-balance volumes at 1/N to prevent clipping
          const volumes = inputPaths.map(() => 1 / inputPaths.length);
          const tmpMixed = outputPath.replace('.wav', '_tmp_mix.wav');

          try {
            await soxRunner.mix(inputPaths, tmpMixed, volumes);
            await soxRunner.normalize(tmpMixed, outputPath);
          } finally {
            await unlink(tmpMixed).catch(() => {});
          }

          return {
            content: [{
              type: 'text' as const,
              text: [
                `Layered ${inputPaths.length} files together with auto-balanced volumes (${(1 / inputPaths.length).toFixed(2)} each).`,
                '',
                'Inputs:',
                ...inputPaths.map((p, i) => `  ${i + 1}. ${p}`),
                '',
                `Output: ${outputPath}`,
                '',
                'To use in FL Studio: drag this file into the Channel Rack or Sampler.',
              ].join('\n'),
            }],
          };
        }

        // ── Stereo detune mode ─────────────────────────────────────
        if (inputs.length !== 1) {
          return {
            content: [{ type: 'text' as const, text: 'sample_layer stereo_detune mode requires exactly 1 input file.' }],
            isError: true,
          };
        }

        const inputPath = resolveInputFile(inputs[0]);
        const cents = detuneCents ?? 8;
        const delay = delayMs ?? 0;

        const detuneLabel = `${cents}c` + (delay > 0 ? `_${delay}ms` : '');
        const outName = outputFilename ??
          generateOutputFilename(basename(inputPath), 'stereo_detune', detuneLabel);
        const outputPath = join(getDefaultSampleDir(), outName);
        await mkdir(dirname(outputPath), { recursive: true });

        const base = basename(outputPath, '.wav');
        const dir = dirname(outputPath);
        const leftTmp = join(dir, `${base}_L_tmp.wav`);
        const rightTmp = join(dir, `${base}_R_tmp.wav`);
        const rightDelayedTmp = join(dir, `${base}_R_delayed_tmp.wav`);
        const mergedTmp = join(dir, `${base}_merged_tmp.wav`);

        try {
          // Step 1: Pitch-shift up for left channel
          await soxRunner.pitch(inputPath, leftTmp, cents);

          // Step 2: Pitch-shift down for right channel
          await soxRunner.pitch(inputPath, rightTmp, -cents);

          // Step 3: Optional micro-delay on right channel (Haas effect)
          let rightSource = rightTmp;
          if (delay > 0) {
            const delaySec = (delay / 1000).toFixed(4);
            await soxRunner.run([rightTmp, rightDelayedTmp, 'delay', delaySec]);
            rightSource = rightDelayedTmp;
          }

          // Step 4: Merge left + right into stereo
          await soxRunner.merge([leftTmp, rightSource], mergedTmp);

          // Step 5: Normalize to prevent clipping
          await soxRunner.normalize(mergedTmp, outputPath);
        } finally {
          // Clean up ALL temp files
          const temps = [leftTmp, rightTmp, rightDelayedTmp, mergedTmp];
          await Promise.all(temps.map(f => unlink(f).catch(() => {})));
        }

        return {
          content: [{
            type: 'text' as const,
            text: [
              `Created stereo-detuned version: +${cents}/-${cents} cents` +
                (delay > 0 ? ` with ${delay}ms micro-delay (Haas effect)` : '') + '.',
              '',
              `Input:  ${inputPath}`,
              `Output: ${outputPath}`,
              '',
              'The left channel is pitched slightly up and the right channel slightly down,',
              'creating a rich, wide stereo texture from a mono/stereo source.',
              '',
              'To use in FL Studio: drag this file into the Channel Rack or Sampler.',
            ].join('\n'),
          }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `sample_layer failed: ${msg}` }],
          isError: true,
        };
      }
    },
  );
}
