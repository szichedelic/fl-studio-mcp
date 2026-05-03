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
import { runBridgeTool } from './util.js';

export function registerTransportTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  server.tool(
    'transport_play',
    'Start playback in FL Studio',
    {},
    () => runBridgeTool(connection, {
      action: 'transport.start',
      args: {},
      describe: 'start playback',
    }),
  );

  server.tool(
    'transport_stop',
    'Stop playback in FL Studio',
    {},
    () => runBridgeTool(connection, {
      action: 'transport.stop',
      args: {},
      describe: 'stop playback',
    }),
  );

  server.tool(
    'transport_record',
    'Toggle recording in FL Studio',
    {},
    () => runBridgeTool(connection, {
      action: 'transport.record',
      args: {},
      describe: 'toggle recording',
    }),
  );

  server.tool(
    'transport_state',
    'Get current transport state (playing, recording, position)',
    {},
    () => runBridgeTool(connection, {
      action: 'transport.state',
      args: {},
      describe: 'get transport state',
    }),
  );
}
