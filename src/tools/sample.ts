/**
 * Sample Manipulation Tools for FL Studio MCP
 *
 * Provides MCP tools for audio sample manipulation via SoX:
 * - sample_pitch: Pitch-shift a WAV sample by semitones
 * - sample_reverse: Reverse a WAV sample
 * - sample_timestretch: Time-stretch a WAV sample by a speed factor
 * - sample_info: Get detailed information about a WAV file
 *
 * All tools accept render registry filenames (from list_renders) or
 * absolute file paths as input. Processed files are saved to
 * ~/Documents/FL Studio MCP/Samples/ by default.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';
import { basename, dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
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
}
