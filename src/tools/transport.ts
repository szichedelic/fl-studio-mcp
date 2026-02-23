/**
 * Transport Control Tools for FL Studio MCP
 *
 * Provides MCP tools for controlling FL Studio's transport:
 * - Play/Stop
 * - Record toggle
 * - Transport state queries
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';

/**
 * Register transport control tools with the MCP server
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerTransportTools(
  server: McpServer,
  connection: ConnectionManager
): void {
  // Transport Play
  server.tool(
    'transport_play',
    'Start playback in FL Studio',
    {},
    async () => {
      const result = await connection.executeCommand('transport.start', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Transport Stop
  server.tool(
    'transport_stop',
    'Stop playback in FL Studio',
    {},
    async () => {
      const result = await connection.executeCommand('transport.stop', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Transport Record
  server.tool(
    'transport_record',
    'Toggle recording in FL Studio',
    {},
    async () => {
      const result = await connection.executeCommand('transport.record', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Transport State
  server.tool(
    'transport_state',
    'Get current transport state (playing, recording, position)',
    {},
    async () => {
      const result = await connection.executeCommand('transport.state', {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
