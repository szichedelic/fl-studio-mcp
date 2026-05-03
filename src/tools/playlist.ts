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
 * Live Clip tools (Phase 10 Plan 03):
 * - trigger_live_clip: Trigger a live clip in Performance Mode
 * - stop_live_clips: Stop all live clips on a track
 * - get_live_status: Get live clip playback status
 *
 * IMPORTANT: Playlist tracks are 1-indexed (first track = 1, not 0).
 * This differs from mixer tracks which are 0-indexed (0=Master).
 *
 * NOTE: Live clip functions require Performance Mode to be enabled in FL Studio.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';
import { rgbHexToBgr, RGB_HEX_RE } from '../util/color.js';
import { runBridgeTool } from './util.js';

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
    () => runBridgeTool(connection, {
      action: 'playlist.get_tracks',
      args: {},
      describe: 'get playlist tracks',
    }),
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
    (args) => runBridgeTool(connection, {
      action: 'playlist.mute',
      args,
      buildParams: ({ track, mute }) => ({ index: track, mute }),
      describe: 'mute/unmute playlist track',
    }),
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
    (args) => runBridgeTool(connection, {
      action: 'playlist.solo',
      args,
      buildParams: ({ track, solo }) => ({ index: track, solo }),
      describe: 'solo/unsolo playlist track',
    }),
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
    (args) => runBridgeTool(connection, {
      action: 'playlist.set_name',
      args,
      buildParams: ({ track, name }) => ({ index: track, name }),
      describe: 'set playlist track name',
    }),
  );

  // ── set_playlist_track_color ────────────────────────────────────────────

  const setColorSchema = {
    track: z.number().int().min(1)
      .describe('Playlist track index (1-indexed, first track = 1)'),
    color: z.string().regex(RGB_HEX_RE, 'Color must be #RRGGBB or RRGGBB hex')
      .describe("Color as RGB hex string (e.g., '#FF0000' for red, '#00FF00' for green)"),
  };

  server.tool(
    'set_playlist_track_color',
    "Set a playlist track's color (accepts RGB hex like '#FF0000'). Tracks are 1-indexed.",
    setColorSchema,
    (args) => runBridgeTool(connection, {
      action: 'playlist.set_color',
      args,
      buildParams: ({ track, color }) => ({ index: track, color: rgbHexToBgr(color) }),
      describe: 'set playlist track color',
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKER TOOLS (Phase 10 Plan 02)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── list_markers ──────────────────────────────────────────────────────────

  server.tool(
    'list_markers',
    'List all time markers in the project. Returns marker names and indices.',
    {},
    () => runBridgeTool(connection, {
      action: 'playlist.list_markers',
      args: {},
      describe: 'list markers',
    }),
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
    (args) => runBridgeTool(connection, {
      action: 'playlist.add_marker',
      args,
      buildParams: ({ name, bar }) => bar !== undefined ? { name, bar } : { name },
      describe: 'add marker',
    }),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVE CLIP TOOLS (Phase 10 Plan 03)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── trigger_live_clip ────────────────────────────────────────────────────

  const triggerLiveClipSchema = {
    track: z.number().int().min(1)
      .describe('Playlist track (1-indexed)'),
    block: z.number().int().min(0)
      .describe('Block number (0-indexed) to trigger'),
  };

  server.tool(
    'trigger_live_clip',
    'Trigger a live clip in Performance Mode. Track is 1-indexed, block is 0-indexed. Note: Performance Mode must be enabled in FL Studio for clips to play.',
    triggerLiveClipSchema,
    (args) => runBridgeTool(connection, {
      action: 'playlist.trigger_clip',
      args,
      describe: 'trigger live clip',
    }),
  );

  // ── stop_live_clips ──────────────────────────────────────────────────────

  const stopLiveClipsSchema = {
    track: z.number().int().min(1)
      .describe('Playlist track (1-indexed) to stop clips on'),
  };

  server.tool(
    'stop_live_clips',
    'Stop all live clips on a playlist track. Track is 1-indexed. Requires Performance Mode.',
    stopLiveClipsSchema,
    (args) => runBridgeTool(connection, {
      action: 'playlist.stop_clips',
      args,
      describe: 'stop live clips',
    }),
  );

  // ── get_live_status ──────────────────────────────────────────────────────

  const getLiveStatusSchema = {
    track: z.number().int().min(1)
      .describe('Playlist track (1-indexed) to check status'),
  };

  server.tool(
    'get_live_status',
    'Get live clip status for a playlist track. Track is 1-indexed. Returns status indicating if clips are playing/scheduled. Requires Performance Mode.',
    getLiveStatusSchema,
    (args) => runBridgeTool(connection, {
      action: 'playlist.get_live_status',
      args,
      describe: 'get live status',
    }),
  );
}
