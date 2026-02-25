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

/**
 * Register project control tools with the MCP server
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerProjectTools(
  server: McpServer,
  connection: ConnectionManager
): void {
  // Get Tempo
  server.tool(
    'get_tempo',
    'Get current project tempo (BPM)',
    {},
    async () => {
      const result = await connection.executeCommand('project.get_tempo', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Set Tempo
  server.tool(
    'set_tempo',
    'Set project tempo in BPM',
    {
      bpm: z.number().min(10).max(999).describe('Tempo in BPM (10-999)'),
    },
    async ({ bpm }) => {
      const result = await connection.executeCommand('project.set_tempo', { bpm });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Get Position
  server.tool(
    'get_position',
    'Get current playback position (bars, steps, ticks, ms)',
    {},
    async () => {
      const result = await connection.executeCommand('project.get_position', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Set Position
  server.tool(
    'set_position',
    'Jump to playback position (by bars, ticks, ms, or seconds)',
    {
      bars: z.number().min(1).optional().describe('Bar number (1-indexed)'),
      ticks: z.number().min(0).optional().describe('Absolute tick position'),
      ms: z.number().min(0).optional().describe('Position in milliseconds'),
      seconds: z.number().min(0).optional().describe('Position in seconds'),
    },
    async (params) => {
      // Pass through whichever param was provided
      const result = await connection.executeCommand('project.set_position', params);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
