/**
 * Playlist Track Control Tools for FL Studio MCP
 *
 * Provides MCP tools for controlling playlist tracks:
 * - get_playlist_tracks: Query all tracks with name/color/mute/solo state
 * - mute_playlist_track: Mute/unmute track
 * - solo_playlist_track: Solo/unsolo track
 * - set_playlist_track_name: Rename track
 * - set_playlist_track_color: Set track color (RGB hex input, converted to BGR)
 *
 * IMPORTANT: Playlist tracks are 1-indexed (first track = 1, not 0).
 * This differs from mixer tracks which are 0-indexed (0=Master).
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
 * Register playlist track control tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerPlaylistTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  // ── get_playlist_tracks ─────────────────────────────────────────────────

  server.tool(
    'get_playlist_tracks',
    'Get all playlist tracks with their names, colors, mute, and solo states. Note: Playlist tracks are 1-indexed (first track = 1).',
    {},
    async () => {
      try {
        const result = await connection.executeCommand('playlist.get_tracks', {});

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to get playlist tracks: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error getting playlist tracks: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── mute_playlist_track ─────────────────────────────────────────────────

  const muteSchema = {
    track: z.number().int().min(1)
      .describe('Playlist track index (1-indexed, first track = 1)'),
    mute: z.boolean()
      .describe('True to mute, false to unmute'),
  };

  server.tool(
    'mute_playlist_track',
    'Mute or unmute a playlist track. Tracks are 1-indexed (first track = 1).',
    muteSchema,
    async ({ track, mute }) => {
      try {
        const result = await connection.executeCommand('playlist.mute', {
          index: track,
          mute,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to mute/unmute playlist track: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error muting/unmuting playlist track: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── solo_playlist_track ─────────────────────────────────────────────────

  const soloSchema = {
    track: z.number().int().min(1)
      .describe('Playlist track index (1-indexed, first track = 1)'),
    solo: z.boolean()
      .describe('True to solo, false to unsolo'),
  };

  server.tool(
    'solo_playlist_track',
    'Solo or unsolo a playlist track. Tracks are 1-indexed (first track = 1).',
    soloSchema,
    async ({ track, solo }) => {
      try {
        const result = await connection.executeCommand('playlist.solo', {
          index: track,
          solo,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to solo/unsolo playlist track: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error solo/unsolo playlist track: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_playlist_track_name ─────────────────────────────────────────────

  const setNameSchema = {
    track: z.number().int().min(1)
      .describe('Playlist track index (1-indexed, first track = 1)'),
    name: z.string()
      .describe('New track name (empty string resets to default)'),
  };

  server.tool(
    'set_playlist_track_name',
    "Set a playlist track's display name. Empty string resets to default. Tracks are 1-indexed.",
    setNameSchema,
    async ({ track, name }) => {
      try {
        const result = await connection.executeCommand('playlist.set_name', {
          index: track,
          name,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set playlist track name: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting playlist track name: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_playlist_track_color ────────────────────────────────────────────

  const setColorSchema = {
    track: z.number().int().min(1)
      .describe('Playlist track index (1-indexed, first track = 1)'),
    color: z.string()
      .describe("Color as RGB hex string (e.g., '#FF0000' for red, '#00FF00' for green)"),
  };

  server.tool(
    'set_playlist_track_color',
    "Set a playlist track's color (accepts RGB hex like '#FF0000'). Tracks are 1-indexed.",
    setColorSchema,
    async ({ track, color }) => {
      try {
        // Convert RGB hex to FL Studio BGR format
        const bgrValue = rgbHexToBgr(color);

        const result = await connection.executeCommand('playlist.set_color', {
          index: track,
          color: bgrValue,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set playlist track color: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting playlist track color: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
