/**
 * Note Generation Tools for FL Studio MCP
 *
 * Provides MCP tools for creating and manipulating notes in FL Studio's piano roll:
 * - add_notes: Place raw MIDI notes
 * - create_chord_progression: Generate chords from roman numerals
 * - create_melody: Generate scale-locked melodies
 * - create_bass_line: Generate bass lines following chords
 * - get_scale_info: Look up scale notes and intervals
 * - clear_notes: Clear piano roll notes
 *
 * All note tools stage data as JSON for the ComposeWithBridge.pyscript to apply.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';

import { generateChordProgression } from '../music/chords.js';
import { generateMelody, generateBassLine } from '../music/melody.js';
import { getAvailableScales, getScaleInfo } from '../music/scales.js';
import { writePyscript } from '../music/pyscript-writer.js';
import { humanize as humanizeNotes } from '../music/humanize/index.js';
import type { NoteData } from '../music/types.js';

const TRIGGER_HINT = 'Run ComposeWithBridge from Piano Roll > Tools > Scripting to apply.';

/**
 * Format a NoteData array into a human-readable summary.
 */
function summarizeNotes(notes: NoteData[]): string {
  if (notes.length === 0) return 'No notes generated.';

  const minMidi = Math.min(...notes.map((n) => n.midi));
  const maxMidi = Math.max(...notes.map((n) => n.midi));
  const totalBeats = Math.max(...notes.map((n) => n.time + n.duration));

  return `${notes.length} notes, MIDI range ${minMidi}-${maxMidi}, spanning ${totalBeats} beats.`;
}

/**
 * Register note generation tools with the MCP server
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerNoteTools(
  server: McpServer,
  connection: ConnectionManager
): void {
  // Define schemas separately to avoid deep type instantiation

  const addNotesSchema = {
    notes: z
      .array(
        z.object({
          midi: z.number().int().min(0).max(127).describe('MIDI note number (60 = middle C)'),
          time: z.number().min(0).describe('Start time in beats (quarter notes)'),
          duration: z.number().min(0.01).describe('Duration in beats'),
          velocity: z.number().min(0).max(1).default(0.78).describe('Note velocity 0-1'),
          pan: z
            .number()
            .min(0)
            .max(1)
            .default(0.5)
            .optional()
            .describe('Pan 0-1 (0.5=center)'),
          color: z
            .number()
            .int()
            .min(0)
            .max(15)
            .default(0)
            .optional()
            .describe('Note color 0-15'),
        })
      )
      .describe('Array of notes to add'),
    channel: z.number().int().min(0).optional().describe('Target channel index (0-based)'),
    clearFirst: z
      .boolean()
      .default(false)
      .optional()
      .describe('Clear existing notes before adding'),
  };

  const chordProgressionSchema = {
    key: z.string().describe('Musical key, e.g. "C", "A", "F#"'),
    scale: z.string().default('major').describe('Scale type: "major", "minor", "dorian", etc.'),
    progression: z.array(z.string()).describe('Roman numerals: ["I", "V", "vi", "IV"]'),
    octave: z.number().int().min(1).max(8).default(4).describe('Base octave'),
    beatsPerChord: z.number().default(4).describe('Beats per chord'),
    velocity: z.number().min(0).max(1).default(0.78).describe('Note velocity'),
    channel: z.number().int().min(0).optional().describe('Target channel index'),
    clearFirst: z
      .boolean()
      .default(false)
      .optional()
      .describe('Clear existing notes first'),
    humanize: z.enum(['tight', 'loose', 'jazz', 'lo-fi']).optional()
      .describe('Apply humanization preset to generated notes'),
    humanize_instrument: z.enum(['drums', 'piano', 'bass', 'synth', 'default']).optional()
      .describe('Instrument profile for velocity humanization'),
  };

  const melodySchema = {
    key: z.string().describe('Musical key'),
    scale: z.string().default('major').describe('Scale type'),
    octave: z.number().int().min(1).max(8).default(4).describe('Base octave'),
    bars: z.number().int().min(1).max(32).default(4).describe('Number of bars'),
    noteDensity: z
      .enum(['sparse', 'medium', 'dense'])
      .default('medium')
      .describe('Note density'),
    direction: z
      .enum(['ascending', 'descending', 'mixed'])
      .default('mixed')
      .describe('Melodic direction tendency'),
    velocity: z.number().min(0).max(1).default(0.75).describe('Note velocity'),
    channel: z.number().int().min(0).optional().describe('Target channel index'),
    clearFirst: z
      .boolean()
      .default(false)
      .optional()
      .describe('Clear existing notes first'),
    humanize: z.enum(['tight', 'loose', 'jazz', 'lo-fi']).optional()
      .describe('Apply humanization preset to generated notes'),
    humanize_instrument: z.enum(['drums', 'piano', 'bass', 'synth', 'default']).optional()
      .describe('Instrument profile for velocity humanization'),
  };

  const bassLineSchema = {
    key: z.string().describe('Musical key'),
    scale: z.string().default('major').describe('Scale type'),
    chordProgression: z.array(z.string()).describe('Roman numerals the bass follows'),
    octave: z.number().int().min(1).max(4).default(2).describe('Bass octave'),
    beatsPerChord: z.number().default(4).describe('Beats per chord'),
    style: z
      .enum(['whole', 'half', 'walking', 'eighth'])
      .default('whole')
      .describe('Bass rhythm style'),
    velocity: z.number().min(0).max(1).default(0.82).describe('Note velocity'),
    channel: z.number().int().min(0).optional().describe('Target channel index'),
    clearFirst: z
      .boolean()
      .default(false)
      .optional()
      .describe('Clear existing notes first'),
    humanize: z.enum(['tight', 'loose', 'jazz', 'lo-fi']).optional()
      .describe('Apply humanization preset to generated notes'),
    humanize_instrument: z.enum(['drums', 'piano', 'bass', 'synth', 'default']).optional()
      .describe('Instrument profile for velocity humanization'),
  };

  const scaleInfoSchema = {
    key: z.string().describe('Root note, e.g. "C", "Ab", "F#"'),
    scale: z.string().default('major').describe('Scale name (or "list" to see all scales)'),
  };

  const clearNotesSchema = {
    channel: z.number().int().min(0).optional().describe('Channel to clear (omit for all)'),
  };

  // ── add_notes ──────────────────────────────────────────────────────────

  server.tool(
    'add_notes',
    'Add raw MIDI notes to FL Studio piano roll. Notes are staged as JSON for the ComposeWithBridge piano roll script.',
    addNotesSchema,
    async ({ notes, channel, clearFirst }) => {
      try {
        // Write .pyscript with embedded note data (Node.js has full FS access)
        writePyscript('add_notes', notes as NoteData[], clearFirst);

        // Tell FL Bridge to open piano roll and select channel
        const result = await connection.executeCommand('pianoroll.addNotes', {
          notes,
          channel,
          clearFirst,
        });

        const summary = summarizeNotes(notes as NoteData[]);
        const text = [
          `Staged ${notes.length} note(s) for piano roll.`,
          summary,
          '',
          TRIGGER_HINT,
          '',
          'FL Bridge response:',
          JSON.stringify(result, null, 2),
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error adding notes: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── create_chord_progression ───────────────────────────────────────────

  server.tool(
    'create_chord_progression',
    'Generate a chord progression from roman numerals (e.g. I-V-vi-IV) and stage it in FL Studio piano roll.',
    chordProgressionSchema,
    async ({ key, scale, progression, octave, beatsPerChord, velocity, channel, clearFirst, humanize, humanize_instrument }) => {
      try {
        let notes = generateChordProgression({
          key,
          scale,
          progression,
          octave,
          beatsPerChord,
          velocity,
        });

        // Apply humanization if requested
        let humanizeInfo = '';
        if (humanize) {
          const hResult = humanizeNotes(notes, {
            preset: humanize,
            velocity: humanize_instrument ? { instrument: humanize_instrument } : undefined,
          });
          notes = hResult.notes;
          humanizeInfo = `\nHumanized with "${humanize}" preset (seed: ${hResult.seed}, transforms: ${hResult.applied.join(', ')})`;
        }

        // Write .pyscript with embedded note data
        writePyscript('add_notes', notes, clearFirst);

        const result = await connection.executeCommand('pianoroll.addNotes', {
          notes,
          channel,
          clearFirst,
        });

        const chordNames = progression.join(' - ');
        const text = [
          `Generated ${progression.length} chords: ${chordNames} in ${key} ${scale}.`,
          `${notes.length} notes staged across ${progression.length * beatsPerChord} beats.`,
          `Octave: ${octave}, Velocity: ${velocity}`,
          humanizeInfo,
          '',
          TRIGGER_HINT,
          '',
          'FL Bridge response:',
          JSON.stringify(result, null, 2),
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: 'text', text: `Error creating chord progression: ${message}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ── create_melody ──────────────────────────────────────────────────────

  server.tool(
    'create_melody',
    'Generate a scale-locked melody and stage it in FL Studio piano roll.',
    melodySchema,
    async ({ key, scale, octave, bars, noteDensity, direction, velocity, channel, clearFirst, humanize, humanize_instrument }) => {
      try {
        let notes = generateMelody({
          key,
          scale,
          octave,
          bars,
          noteDensity,
          direction,
          velocity,
        });

        // Apply humanization if requested
        let humanizeInfo = '';
        if (humanize) {
          const hResult = humanizeNotes(notes, {
            preset: humanize,
            velocity: humanize_instrument ? { instrument: humanize_instrument } : undefined,
          });
          notes = hResult.notes;
          humanizeInfo = `\nHumanized with "${humanize}" preset (seed: ${hResult.seed}, transforms: ${hResult.applied.join(', ')})`;
        }

        // Write .pyscript with embedded note data
        writePyscript('add_notes', notes, clearFirst);

        const result = await connection.executeCommand('pianoroll.addNotes', {
          notes,
          channel,
          clearFirst,
        });

        const summary = summarizeNotes(notes);
        const text = [
          `Generated melody in ${key} ${scale}, ${bars} bars, ${noteDensity} density, ${direction} direction.`,
          summary,
          humanizeInfo,
          '',
          TRIGGER_HINT,
          '',
          'FL Bridge response:',
          JSON.stringify(result, null, 2),
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error creating melody: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── create_bass_line ───────────────────────────────────────────────────

  server.tool(
    'create_bass_line',
    'Generate a bass line following a chord progression and stage it in FL Studio piano roll.',
    bassLineSchema,
    async ({
      key,
      scale,
      chordProgression,
      octave,
      beatsPerChord,
      style,
      velocity,
      channel,
      clearFirst,
      humanize,
      humanize_instrument,
    }) => {
      try {
        let notes = generateBassLine({
          key,
          scale,
          chordProgression,
          octave,
          beatsPerChord,
          style,
          velocity,
        });

        // Apply humanization if requested
        let humanizeInfo = '';
        if (humanize) {
          const hResult = humanizeNotes(notes, {
            preset: humanize,
            velocity: humanize_instrument ? { instrument: humanize_instrument } : undefined,
          });
          notes = hResult.notes;
          humanizeInfo = `\nHumanized with "${humanize}" preset (seed: ${hResult.seed}, transforms: ${hResult.applied.join(', ')})`;
        }

        // Write .pyscript with embedded note data
        writePyscript('add_notes', notes, clearFirst);

        const result = await connection.executeCommand('pianoroll.addNotes', {
          notes,
          channel,
          clearFirst,
        });

        const chordNames = chordProgression.join(' - ');
        const summary = summarizeNotes(notes);
        const text = [
          `Generated ${style} bass line following ${chordNames} in ${key} ${scale}.`,
          summary,
          `Octave: ${octave}, Velocity: ${velocity}`,
          humanizeInfo,
          '',
          TRIGGER_HINT,
          '',
          'FL Bridge response:',
          JSON.stringify(result, null, 2),
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error creating bass line: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── get_scale_info ─────────────────────────────────────────────────────

  server.tool(
    'get_scale_info',
    'Get information about a musical scale: notes, intervals, and available scale types. Use scale="list" to see all available scales.',
    scaleInfoSchema,
    async ({ key, scale: scaleName }) => {
      try {
        // Special case: list all available scales
        if (scaleName === 'list') {
          const scales = getAvailableScales();
          const text = [
            `Available scales (${scales.length} total):`,
            '',
            scales.join(', '),
            '',
            'Use any of these with the key parameter to see notes and intervals.',
          ].join('\n');

          return { content: [{ type: 'text', text }] };
        }

        const info = getScaleInfo(key, scaleName);

        if (info.notes.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Scale "${key} ${scaleName}" not found. Use scale="list" to see available scales.`,
              },
            ],
          };
        }

        const text = [
          `${key} ${scaleName} scale:`,
          '',
          `Notes:     ${info.notes.join(' - ')}`,
          `Intervals: ${info.intervals.join(' - ')}`,
          `Chroma:    ${info.chroma}`,
          '',
          `${info.notes.length} notes per octave.`,
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error getting scale info: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── clear_notes ────────────────────────────────────────────────────────

  server.tool(
    'clear_notes',
    'Clear notes from the FL Studio piano roll. Stages a clear action for the ComposeWithBridge piano roll script.',
    clearNotesSchema,
    async ({ channel }) => {
      try {
        // Write .pyscript with clear action
        writePyscript('clear');

        const result = await connection.executeCommand('pianoroll.clearNotes', {
          channel,
        });

        const text = [
          'Clear request staged.',
          '',
          TRIGGER_HINT,
          '',
          'FL Bridge response:',
          JSON.stringify(result, null, 2),
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error clearing notes: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
