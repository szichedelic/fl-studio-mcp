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
import { runBridgeTool } from './util.js';

export function registerStateTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  server.tool(
    'get_channels',
    'Get all channels in the channel rack',
    {},
    () => runBridgeTool(connection, {
      action: 'state.channels',
      args: {},
      describe: 'get channels',
    }),
  );

  server.tool(
    'get_mixer',
    'Get mixer track information including tempo',
    {},
    () => runBridgeTool(connection, {
      action: 'state.mixer',
      args: {},
      describe: 'get mixer',
    }),
  );

  server.tool(
    'get_patterns',
    'Get all patterns in the project',
    {},
    () => runBridgeTool(connection, {
      action: 'state.patterns',
      args: {},
      describe: 'get patterns',
    }),
  );
}
