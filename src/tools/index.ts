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
import { registerSampleTools } from './sample.js';
import { registerMixerTools } from './mixer.js';
import { registerPlaylistTools } from './playlist.js';
import { registerProjectTools } from './project.js';

type ToolGroup = readonly [
  name: string,
  register: (server: McpServer, connection: ConnectionManager) => void,
];

const TOOL_GROUPS: readonly ToolGroup[] = [
  ['transport', registerTransportTools],
  ['state', registerStateTools],
  ['patterns', registerPatternTools],
  ['notes', registerNoteTools],
  ['humanize', registerHumanizeTools],
  ['plugins', registerPluginTools],
  ['serum', registerSerumTools],
  ['render', registerRenderTools],
  ['sample', registerSampleTools],
  ['mixer', registerMixerTools],
  ['playlist', registerPlaylistTools],
  ['project', registerProjectTools],
];

/**
 * Register all MCP tools with the server. Iterating over a single source of
 * truth keeps the startup log message in sync with the actual registrations.
 */
export function registerTools(
  server: McpServer,
  connection: ConnectionManager
): void {
  for (const [, register] of TOOL_GROUPS) {
    register(server, connection);
  }

  const groupNames = TOOL_GROUPS.map(([name]) => name).join(', ');
  console.error(`[fl-studio-mcp] Registered tool groups: ${groupNames}`);
}
