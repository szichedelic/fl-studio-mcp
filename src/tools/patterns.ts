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

/**
 * Register pattern operation tools with the MCP server
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerPatternTools(
  server: McpServer,
  connection: ConnectionManager
): void {
  // Define schemas separately to avoid deep type instantiation
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

  // Pattern Select
  server.tool(
    'pattern_select',
    'Select a pattern by index',
    patternSelectSchema,
    async ({ index }) => {
      const result = await connection.executeCommand('pattern.select', {
        index,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Pattern Create
  server.tool('pattern_create', 'Create a new empty pattern', {}, async () => {
    const result = await connection.executeCommand('pattern.create', {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  });

  // Pattern Rename
  server.tool(
    'pattern_rename',
    'Rename a pattern',
    patternRenameSchema,
    async ({ index, name }) => {
      const result = await connection.executeCommand('pattern.rename', {
        index,
        name,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
