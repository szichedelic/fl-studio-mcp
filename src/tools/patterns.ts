/**
 * Pattern Operation Tools for FL Studio MCP
 *
 * Provides MCP tools for pattern manipulation:
 * - Select pattern by index
 * - Create new empty pattern
 * - Rename pattern
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';
import { runBridgeTool } from './util.js';

export function registerPatternTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  const patternSelectSchema = {
    index: z.number().int().min(1).describe('Pattern index (1-based)'),
  };

  const patternRenameSchema = {
    index: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Pattern index (defaults to current pattern)'),
    name: z.string().describe('New pattern name'),
  };

  server.tool(
    'pattern_select',
    'Select a pattern by index',
    patternSelectSchema,
    (args) => runBridgeTool(connection, {
      action: 'pattern.select',
      args,
      describe: 'select pattern',
    }),
  );

  server.tool(
    'pattern_create',
    'Create a new empty pattern',
    {},
    () => runBridgeTool(connection, {
      action: 'pattern.create',
      args: {},
      describe: 'create pattern',
    }),
  );

  server.tool(
    'pattern_rename',
    'Rename a pattern',
    patternRenameSchema,
    (args) => runBridgeTool(connection, {
      action: 'pattern.rename',
      args,
      describe: 'rename pattern',
    }),
  );
}
