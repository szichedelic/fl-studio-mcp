/**
 * Project Control Tools for FL Studio MCP
 *
 * Provides MCP tools for controlling FL Studio project settings:
 * - Tempo get/set
 * - Playback position get/set
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { runBridgeTool } from './util.js';

/**
 * Register project control tools with the MCP server
 */
export function registerProjectTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  server.tool(
    'get_tempo',
    'Get current project tempo (BPM)',
    {},
    () => runBridgeTool(connection, {
      action: 'project.get_tempo',
      args: {},
      describe: 'get tempo',
    }),
  );

  server.tool(
    'set_tempo',
    'Set project tempo in BPM',
    {
      bpm: z.number().min(10).max(999).describe('Tempo in BPM (10-999)'),
    },
    (args) => runBridgeTool(connection, {
      action: 'project.set_tempo',
      args,
      describe: 'set tempo',
    }),
  );

  server.tool(
    'get_position',
    'Get current playback position (bars, steps, ticks, ms)',
    {},
    () => runBridgeTool(connection, {
      action: 'project.get_position',
      args: {},
      describe: 'get position',
    }),
  );

  server.tool(
    'set_position',
    'Jump to playback position (by bars, ticks, ms, or seconds)',
    {
      bars: z.number().min(1).optional().describe('Bar number (1-indexed)'),
      ticks: z.number().min(0).optional().describe('Absolute tick position'),
      ms: z.number().min(0).optional().describe('Position in milliseconds'),
      seconds: z.number().min(0).optional().describe('Position in seconds'),
    },
    (args) => runBridgeTool(connection, {
      action: 'project.set_position',
      args,
      describe: 'set position',
    }),
  );

  server.tool(
    'undo',
    'Undo the last operation in FL Studio',
    {},
    () => runBridgeTool(connection, {
      action: 'project.undo',
      args: {},
      describe: 'undo',
    }),
  );

  server.tool(
    'redo',
    'Redo the last undone operation in FL Studio',
    {},
    () => runBridgeTool(connection, {
      action: 'project.redo',
      args: {},
      describe: 'redo',
    }),
  );
}
