/**
 * FL Studio MCP Server
 *
 * Entry point for the Model Context Protocol server that bridges
 * AI assistants to FL Studio via MIDI SysEx communication.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConnectionManager } from './bridge/connection.js';
import { registerTools } from './tools/index.js';

// Create the MCP server
const server = new McpServer({
  name: 'fl-studio-mcp',
  version: '1.0.0',
});

// Create the connection manager for FL Studio communication
const connection = new ConnectionManager();

// MIDI port names (can be overridden via environment variables)
// These are loopMIDI port names - named from FL Studio's perspective:
//   "FL Bridge In"  = commands flow IN to FL Studio (MCP sends here)
//   "FL Bridge Out" = responses flow OUT from FL Studio (MCP receives here)
const MIDI_PORT_TO_FL = process.env.FL_PORT_TO_FL || process.env.FL_MIDI_OUT || 'FL Bridge In';
const MIDI_PORT_FROM_FL = process.env.FL_PORT_FROM_FL || process.env.FL_MIDI_IN || 'FL Bridge Out';

/**
 * Attempt to connect to FL Studio via MIDI
 *
 * Non-fatal if connection fails - tools will error when used
 */
async function connectToFLStudio(): Promise<boolean> {
  try {
    console.error('[fl-studio-mcp] Available MIDI ports:');
    const ports = connection.listPorts();
    console.error(`  Inputs: ${ports.inputs.join(', ') || 'none'}`);
    console.error(`  Outputs: ${ports.outputs.join(', ') || 'none'}`);

    console.error(
      `[fl-studio-mcp] Attempting MIDI connection (from FL: ${MIDI_PORT_FROM_FL}, to FL: ${MIDI_PORT_TO_FL})`
    );

    const success = await connection.connect(MIDI_PORT_FROM_FL, MIDI_PORT_TO_FL);

    if (success) {
      console.error('[fl-studio-mcp] Connected to FL Studio via MIDI');
      return true;
    } else {
      console.error(
        '[fl-studio-mcp] Warning: Failed to connect to MIDI ports'
      );
      console.error(
        '[fl-studio-mcp] Tools will error until FL Studio is connected'
      );
      return false;
    }
  } catch (error) {
    console.error(`[fl-studio-mcp] Warning: MIDI connection error: ${error}`);
    console.error(
      '[fl-studio-mcp] Tools will error until FL Studio is connected'
    );
    return false;
  }
}

/**
 * Start the MCP server with stdio transport
 */
async function main() {
  // Register all tools with the server
  registerTools(server, connection);

  // Attempt MIDI connection (non-fatal if it fails)
  await connectToFLStudio();

  // Check SoX availability for sample manipulation tools
  try {
    const { soxRunner } = await import('./audio/sox-runner.js');
    const version = await soxRunner.verify();
    console.error(`[fl-studio-mcp] SoX available: ${version}`);
  } catch {
    console.error(
      '[fl-studio-mcp] WARNING: SoX is not installed. ' +
      'Sample manipulation tools will not work. ' +
      'Install via: winget install --id ChrisBagwell.SoX -s winget'
    );
  }

  // Start the MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[fl-studio-mcp] Server started');
}

main().catch((error) => {
  console.error('[fl-studio-mcp] Fatal error:', error);
  process.exit(1);
});

export { server, connection };
