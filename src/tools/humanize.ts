/**
 * Humanization MCP Tool for FL Studio
 *
 * Provides the humanize_notes tool that applies timing drift, velocity variation,
 * swing, and articulation to MIDI notes. Supports named presets for quick results
 * or custom parameters for fine-grained control.
 *
 * Optionally writes humanized notes to .pyscript for direct FL Studio staging.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';

import { humanize } from '../music/humanize/index.js';
import { writePyscript } from '../music/pyscript-writer.js';
import type { NoteData, HumanizationParams } from '../music/types.js';

const TRIGGER_HINT = 'Run ComposeWithBridge from Piano Roll > Tools > Scripting to apply.';

/**
 * Register humanization tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerHumanizeTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  const humanizeSchema = {
    notes: z.array(z.object({
      midi: z.number().int().min(0).max(127).describe('MIDI note number'),
      time: z.number().min(0).describe('Start time in beats'),
      duration: z.number().min(0.01).describe('Duration in beats'),
      velocity: z.number().min(0).max(1).describe('Velocity 0-1'),
      pan: z.number().min(0).max(1).optional().describe('Pan 0-1'),
      color: z.number().int().min(0).max(15).optional().describe('Note color'),
    })).describe('Notes to humanize'),

    preset: z.enum(['tight', 'loose', 'jazz', 'lo-fi']).optional()
      .describe('Named preset: tight (electronic), loose (relaxed), jazz (swing+drift), lo-fi (wandering)'),

    instrument: z.enum(['drums', 'piano', 'bass', 'synth', 'default']).optional()
      .describe('Instrument velocity profile'),

    swing: z.number().min(50).max(75).optional()
      .describe('Swing amount 50-75 (50=none, 66=triplet, 75=max)'),

    timing_amount: z.number().min(0).max(1).optional()
      .describe('Timing drift amount 0-1 (maps to sigma 0.001-0.025)'),

    seed: z.string().optional()
      .describe('Seed for reproducible results'),

    write_pyscript: z.boolean().default(false).optional()
      .describe('Write humanized notes to .pyscript for FL Studio'),
    channel: z.number().int().min(0).optional()
      .describe('Target channel (only used with write_pyscript)'),
    clearFirst: z.boolean().default(false).optional()
      .describe('Clear existing notes (only used with write_pyscript)'),
  };

  server.tool(
    'humanize_notes',
    'Humanize MIDI notes with timing drift, velocity variation, swing, and articulation. Makes mechanical patterns sound human. Use presets for quick results or customize individual parameters.',
    humanizeSchema,
    async ({ notes, preset, instrument, swing, timing_amount, seed, write_pyscript, channel, clearFirst }) => {
      try {
        // Map flat schema params to HumanizationParams
        const params: HumanizationParams = {};

        if (preset) {
          params.preset = preset;
        }

        if (instrument) {
          params.velocity = { instrument };
        }

        if (swing !== undefined) {
          params.swing = { enabled: true, amount: swing };
        }

        if (timing_amount !== undefined) {
          // Map 0-1 to sigma range 0.001-0.025
          const sigma = 0.001 + timing_amount * 0.024;
          params.timing = { enabled: true, sigma, contextAware: true };
        }

        if (seed) {
          params.seed = seed;
        }

        // Run humanization pipeline
        const result = humanize(notes as NoteData[], params);

        // Optionally write pyscript for FL Studio staging
        if (write_pyscript) {
          writePyscript('add_notes', result.notes, clearFirst);

          await connection.executeCommand('pianoroll.addNotes', {
            notes: result.notes,
            channel,
            clearFirst,
          });
        }

        // Build response text
        const lines: string[] = [
          `Humanized ${result.notes.length} note(s).`,
          `Transforms applied: ${result.applied.length > 0 ? result.applied.join(', ') : 'none'}`,
          `Seed: ${result.seed} (use this seed to reproduce exact results)`,
        ];

        if (write_pyscript) {
          lines.push('', TRIGGER_HINT);
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error humanizing notes: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
