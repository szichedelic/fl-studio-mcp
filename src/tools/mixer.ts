/**
 * Mixer Control Tools for FL Studio MCP
 *
 * Provides MCP tools for controlling mixer tracks:
 * - set_mixer_volume: Set track volume (0.0-1.0, 0.8 = 0dB)
 * - set_mixer_pan: Set track pan (-1.0 to 1.0)
 * - mute_mixer_track: Mute/unmute track
 * - solo_mixer_track: Solo/unsolo track
 * - set_mixer_track_name: Rename track
 * - set_mixer_track_color: Set track color (RGB hex input, converted to BGR)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';

/**
 * Convert RGB hex string (#RRGGBB) to FL Studio BGR integer.
 * FL Studio uses BGR format (0x00BBGGRR).
 *
 * @param hex - RGB hex string (e.g., "#FF0000" for red)
 * @returns BGR integer value
 */
function rgbHexToBgr(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (b << 16) | (g << 8) | r;
}

/**
 * Register mixer control tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerMixerTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  // ── set_mixer_volume ─────────────────────────────────────────────────────

  const setVolumeSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    volume: z.number().min(0).max(1)
      .describe('Volume level (0.0-1.0, where 0.8 = 0dB unity gain)'),
  };

  server.tool(
    'set_mixer_volume',
    "Set a mixer track's volume level (0.0-1.0, where 0.8 = unity/0dB)",
    setVolumeSchema,
    async ({ track, volume }) => {
      try {
        const result = await connection.executeCommand('mixer.set_volume', {
          index: track,
          volume,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set mixer volume: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting mixer volume: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_mixer_pan ────────────────────────────────────────────────────────

  const setPanSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    pan: z.number().min(-1).max(1)
      .describe('Pan position (-1.0=hard left, 0=center, 1.0=hard right)'),
  };

  server.tool(
    'set_mixer_pan',
    "Set a mixer track's pan position (-1.0=left, 0=center, 1.0=right)",
    setPanSchema,
    async ({ track, pan }) => {
      try {
        const result = await connection.executeCommand('mixer.set_pan', {
          index: track,
          pan,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set mixer pan: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting mixer pan: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── mute_mixer_track ─────────────────────────────────────────────────────

  const muteSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    mute: z.boolean()
      .describe('True to mute, false to unmute'),
  };

  server.tool(
    'mute_mixer_track',
    'Mute or unmute a mixer track',
    muteSchema,
    async ({ track, mute }) => {
      try {
        const result = await connection.executeCommand('mixer.mute', {
          index: track,
          mute,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to mute/unmute track: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error muting/unmuting track: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── solo_mixer_track ─────────────────────────────────────────────────────

  const soloSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    solo: z.boolean()
      .describe('True to solo, false to unsolo'),
  };

  server.tool(
    'solo_mixer_track',
    'Solo or unsolo a mixer track',
    soloSchema,
    async ({ track, solo }) => {
      try {
        const result = await connection.executeCommand('mixer.solo', {
          index: track,
          solo,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to solo/unsolo track: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error solo/unsolo track: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_mixer_track_name ─────────────────────────────────────────────────

  const setNameSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    name: z.string()
      .describe('New track name (empty string resets to default)'),
  };

  server.tool(
    'set_mixer_track_name',
    "Set a mixer track's display name",
    setNameSchema,
    async ({ track, name }) => {
      try {
        const result = await connection.executeCommand('mixer.set_name', {
          index: track,
          name,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set track name: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting track name: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_mixer_track_color ────────────────────────────────────────────────

  const setColorSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    color: z.string()
      .describe('Color as RGB hex string (e.g., "#FF0000" for red, "#00FF00" for green)'),
  };

  server.tool(
    'set_mixer_track_color',
    "Set a mixer track's color (accepts RGB hex like '#FF0000' for red)",
    setColorSchema,
    async ({ track, color }) => {
      try {
        // Convert RGB hex to FL Studio BGR format
        const bgrValue = rgbHexToBgr(color);

        const result = await connection.executeCommand('mixer.set_color', {
          index: track,
          color: bgrValue,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set track color: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting track color: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
