/**
 * FL Studio MCP Server
 *
 * Entry point for the Model Context Protocol server that bridges
 * AI assistants to FL Studio via MIDI SysEx communication.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Create the MCP server
const server = new McpServer({
  name: 'fl-studio-mcp',
  version: '1.0.0',
});

// TODO: Register tools in Plan 03 (after implementing MIDI bridge in Plan 01-02)
// Tools will be registered here to:
// - connect/disconnect to FL Studio
// - create/manipulate MIDI patterns
// - control transport (play/stop/record)
// - manage tracks and mixer
// - apply humanization to notes

/**
 * Start the MCP server with stdio transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[fl-studio-mcp] Server started');
}

main().catch((error) => {
  console.error('[fl-studio-mcp] Fatal error:', error);
  process.exit(1);
});

export { server };
