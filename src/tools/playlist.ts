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
 * Marker tools (Phase 10 Plan 02):
 * - list_markers: List all time markers in the project
 * - add_marker: Add a marker at a specific bar or current position
 * - jump_to_marker: Navigate to a marker by name or index
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKER TOOLS (Phase 10 Plan 02)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── list_markers ──────────────────────────────────────────────────────────

  server.tool(
    'list_markers',
    'List all time markers in the project. Returns marker names and indices.',
    {},
    async () => {
      try {
        const result = await connection.executeCommand('playlist.list_markers', {});

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to list markers: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error listing markers: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── add_marker ────────────────────────────────────────────────────────────

  const addMarkerSchema = {
    name: z.string()
      .describe('Name for the marker'),
    bar: z.number().int().min(1).optional()
      .describe('Bar number (1-indexed) to place marker. If not provided, places at current playhead position.'),
  };

  server.tool(
    'add_marker',
    'Add a time marker at a specific bar or the current playhead position. Bar numbers are 1-indexed.',
    addMarkerSchema,
    async ({ name, bar }) => {
      try {
        // Only include bar if defined
        const params: { name: string; bar?: number } = { name };
        if (bar !== undefined) {
          params.bar = bar;
        }

        const result = await connection.executeCommand('playlist.add_marker', params);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to add marker: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error adding marker: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── jump_to_marker ────────────────────────────────────────────────────────

  const jumpToMarkerSchema = {
    name: z.string().optional()
      .describe('Marker name to jump to (case-insensitive partial match)'),
    index: z.number().int().min(0).optional()
      .describe('Marker index (0-indexed) to jump to'),
  };

  server.tool(
    'jump_to_marker',
    "Jump to a marker by name or index. Provide either name (partial match supported) or index. Note: Navigation uses FL Studio's relative marker jump API.",
    jumpToMarkerSchema,
    async ({ name, index }) => {
      try {
        // Validate that at least one is provided
        if (name === undefined && index === undefined) {
          return {
            content: [{ type: 'text', text: 'Must provide either name or index' }],
            isError: true,
          };
        }

        // Only include defined values
        const params: { name?: string; index?: number } = {};
        if (name !== undefined) {
          params.name = name;
        }
        if (index !== undefined) {
          params.index = index;
        }

        const result = await connection.executeCommand('playlist.jump_to_marker', params);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to jump to marker: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error jumping to marker: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
