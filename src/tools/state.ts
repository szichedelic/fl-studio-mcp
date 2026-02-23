/**
 * State Reading Tools for FL Studio MCP
 *
 * Provides MCP tools for querying FL Studio project state:
 * - Channels in the channel rack
 * - Mixer tracks
 * - Patterns
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';

/**
 * Register state reading tools with the MCP server
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerStateTools(
  server: McpServer,
  connection: ConnectionManager
): void {
  // Get Channels
  server.tool(
    'get_channels',
    'Get all channels in the channel rack',
    {},
    async () => {
      const result = await connection.executeCommand('state.channels', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Get Mixer
  server.tool(
    'get_mixer',
    'Get mixer track information including tempo',
    {},
    async () => {
      const result = await connection.executeCommand('state.mixer', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Get Patterns
  server.tool(
    'get_patterns',
    'Get all patterns in the project',
    {},
    async () => {
      const result = await connection.executeCommand('state.patterns', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
