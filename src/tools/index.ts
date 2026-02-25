/**
 * Tool Registration for FL Studio MCP
 *
 * Central module for registering all MCP tools with the server.
 * Imports all tool modules and provides a single registerTools function.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';

import { registerTransportTools } from './transport.js';
import { registerStateTools } from './state.js';
import { registerPatternTools } from './patterns.js';
import { registerNoteTools } from './notes.js';
import { registerHumanizeTools } from './humanize.js';
import { registerPluginTools } from './plugins.js';
import { registerSerumTools } from './serum.js';
import { registerRenderTools } from './render.js';

/**
 * Register all MCP tools with the server
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerTools(
  server: McpServer,
  connection: ConnectionManager
): void {
  registerTransportTools(server, connection);
  registerStateTools(server, connection);
  registerPatternTools(server, connection);
  registerNoteTools(server, connection);
  registerHumanizeTools(server, connection);
  registerPluginTools(server, connection);
  registerSerumTools(server, connection);
  registerRenderTools(server, connection);

  console.error('[fl-studio-mcp] Registered tools: transport, state, patterns, notes, humanize, plugins, serum, render');
}
