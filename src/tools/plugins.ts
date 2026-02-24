/**
 * Plugin Control Tools for FL Studio MCP
 *
 * Provides MCP tools for discovering and controlling VST plugin parameters:
 * - discover_plugin_params: Scan a plugin for all named parameters
 * - get_plugin_param: Read a parameter value by name (fuzzy matched)
 * - set_plugin_param: Set a parameter value by name (fuzzy matched)
 *
 * Uses ParamCache for name-to-index resolution and ShadowState for reliable
 * value tracking (workaround for unreliable getParamValue on some VSTs).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';
import { paramCache } from '../plugins/param-cache.js';
import { shadowState } from '../plugins/shadow-state.js';
import type { DiscoveredParam } from '../plugins/types.js';

/** Shape of plugins.discover response data */
interface DiscoverData {
  channelIndex?: number;
  pluginName?: string;
  params?: DiscoveredParam[];
}

/** Shape of plugins.get_param response data */
interface GetParamData {
  value?: number;
  displayString?: string;
}

/** Shape of plugins.set_param response data */
interface SetParamData {
  readBack?: number;
  displayString?: string;
}

/**
 * Auto-discover parameters for a plugin if not already cached.
 * Returns the cached plugin data, or undefined if discovery fails.
 */
async function autoDiscover(
  connection: ConnectionManager,
  channelIndex: number | undefined,
  slotIndex: number,
): Promise<{ channelIndex: number; pluginName: string; params: DiscoveredParam[] } | undefined> {
  const result = await connection.executeCommand(
    'plugins.discover',
    { index: channelIndex, slotIndex },
    15000,
  );

  if (!result.success) {
    return undefined;
  }

  const data = (result.data ?? {}) as DiscoverData;
  const actualChannel = data.channelIndex ?? channelIndex ?? 0;
  const pluginName = data.pluginName ?? 'Unknown';
  const params = data.params ?? [];

  paramCache.store(actualChannel, slotIndex, pluginName, params);
  shadowState.populateFromDiscovery(actualChannel, slotIndex, params);

  return { channelIndex: actualChannel, pluginName, params };
}

/**
 * Format a list of parameter names for error messages (first 20).
 */
function formatAvailableParams(channelIndex: number, slotIndex: number): string {
  const cached = paramCache.get(channelIndex, slotIndex);
  if (!cached || cached.params.length === 0) return '(none cached)';
  const names = cached.params.slice(0, 20).map((p) => p.name);
  const suffix = cached.params.length > 20 ? ` ... and ${cached.params.length - 20} more` : '';
  return names.join(', ') + suffix;
}

/**
 * Register plugin control tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerPluginTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  // ── discover_plugin_params ────────────────────────────────────────────

  const discoverSchema = {
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel rack index. Omit to use the currently selected channel.'),
    slotIndex: z.number().int().min(-1).max(9).default(-1)
      .describe('Mixer effect slot index. Use -1 (default) for channel rack plugins, 0-9 for mixer effect slots.'),
    refresh: z.boolean().default(false)
      .describe('Force re-scan even if parameters are cached.'),
  };

  server.tool(
    'discover_plugin_params',
    'Discover all named parameters of a loaded plugin. Returns real parameter names and current values, filtering out the thousands of blank VST parameter slots.',
    discoverSchema,
    async ({ channelIndex, slotIndex, refresh }) => {
      try {
        // Check cache first (unless refresh requested)
        if (!refresh && channelIndex !== undefined && paramCache.has(channelIndex, slotIndex)) {
          const cached = paramCache.get(channelIndex, slotIndex)!;
          const lines: string[] = [
            `Plugin: ${cached.pluginName} (cached)`,
            `Channel: ${cached.channelIndex}, Slot: ${slotIndex}`,
            `Parameters: ${cached.params.length}`,
            '',
          ];
          for (const p of cached.params) {
            lines.push(`  ${p.name}: ${p.value.toFixed(4)}`);
          }
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }

        // Discover from FL Studio
        const discovered = await autoDiscover(connection, channelIndex, slotIndex);

        if (!discovered) {
          return {
            content: [{ type: 'text', text: 'Failed to discover plugin parameters. Make sure a plugin is loaded on the specified channel/slot.' }],
            isError: true,
          };
        }

        const lines: string[] = [
          `Plugin: ${discovered.pluginName}`,
          `Channel: ${discovered.channelIndex}, Slot: ${slotIndex}`,
          `Parameters: ${discovered.params.length}`,
          '',
        ];
        for (const p of discovered.params) {
          lines.push(`  ${p.name}: ${p.value.toFixed(4)}`);
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error discovering plugin parameters: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_plugin_param ──────────────────────────────────────────────────

  const getParamSchema = {
    name: z.string()
      .describe('Parameter name to look up (fuzzy matched). E.g., "Filter Cutoff", "Volume", "Osc1 Level".'),
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel rack index. Omit to use the currently selected channel.'),
    slotIndex: z.number().int().min(-1).max(9).default(-1)
      .describe('Mixer effect slot index. Use -1 for channel rack plugins.'),
  };

  server.tool(
    'get_plugin_param',
    'Get the current value of a plugin parameter by name. Uses fuzzy name matching (exact, prefix, or contains). Returns both the FL Studio live value and shadow state value if available.',
    getParamSchema,
    async ({ name, channelIndex, slotIndex }) => {
      try {
        let actualChannel = channelIndex;

        // Try to resolve from cache first
        let resolved: DiscoveredParam | undefined;
        if (actualChannel !== undefined) {
          resolved = paramCache.resolveParam(actualChannel, slotIndex, name);
        }

        // If not found in cache, auto-discover
        if (!resolved) {
          const discovered = await autoDiscover(connection, channelIndex, slotIndex);
          if (!discovered) {
            return {
              content: [{ type: 'text', text: 'Failed to discover plugin parameters. Make sure a plugin is loaded on the specified channel/slot.' }],
              isError: true,
            };
          }
          actualChannel = discovered.channelIndex;
          resolved = paramCache.resolveParam(actualChannel, slotIndex, name);
        }

        // Still not found after discovery
        if (!resolved || actualChannel === undefined) {
          const ch = actualChannel ?? 0;
          return {
            content: [{
              type: 'text',
              text: `Parameter "${name}" not found. Available parameters: ${formatAvailableParams(ch, slotIndex)}`,
            }],
            isError: true,
          };
        }

        // Get live value from FL Studio
        const result = await connection.executeCommand('plugins.get_param', {
          paramIndex: resolved.index,
          index: actualChannel,
          slotIndex,
        });

        const data = (result.data ?? {}) as GetParamData;
        const liveValue = data.value;
        const displayStr = data.displayString;

        // Check shadow state
        const shadow = shadowState.get(actualChannel, slotIndex, resolved.index);

        const lines: string[] = [
          `Parameter: ${resolved.name} (index ${resolved.index})`,
          `Channel: ${actualChannel}, Slot: ${slotIndex}`,
        ];

        if (liveValue !== undefined) {
          lines.push(`Live value: ${liveValue.toFixed(4)}`);
        }
        if (displayStr) {
          lines.push(`Display: ${displayStr}`);
        }
        if (shadow) {
          lines.push(`Shadow value: ${shadow.value.toFixed(4)} (source: ${shadow.source})`);
          if (liveValue !== undefined && Math.abs(shadow.value - liveValue) > 0.001) {
            lines.push(`Note: Shadow and live values differ (external change or VST reporting lag)`);
          }
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error getting plugin parameter: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_plugin_param ──────────────────────────────────────────────────

  const setParamSchema = {
    name: z.string()
      .describe('Parameter name to set (fuzzy matched). E.g., "Filter Cutoff", "Volume".'),
    value: z.number().min(0).max(1)
      .describe('Parameter value from 0.0 to 1.0 (normalized).'),
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel rack index. Omit to use the currently selected channel.'),
    slotIndex: z.number().int().min(-1).max(9).default(-1)
      .describe('Mixer effect slot index. Use -1 for channel rack plugins.'),
  };

  server.tool(
    'set_plugin_param',
    'Set a plugin parameter by name to a specific value. Value is normalized 0.0-1.0 (e.g., 0.75 = 75%). Uses fuzzy name matching.',
    setParamSchema,
    async ({ name, value, channelIndex, slotIndex }) => {
      try {
        let actualChannel = channelIndex;

        // Try to resolve from cache first
        let resolved: DiscoveredParam | undefined;
        if (actualChannel !== undefined) {
          resolved = paramCache.resolveParam(actualChannel, slotIndex, name);
        }

        // If not found in cache, auto-discover
        if (!resolved) {
          const discovered = await autoDiscover(connection, channelIndex, slotIndex);
          if (!discovered) {
            return {
              content: [{ type: 'text', text: 'Failed to discover plugin parameters. Make sure a plugin is loaded on the specified channel/slot.' }],
              isError: true,
            };
          }
          actualChannel = discovered.channelIndex;
          resolved = paramCache.resolveParam(actualChannel, slotIndex, name);
        }

        // Still not found after discovery
        if (!resolved || actualChannel === undefined) {
          const ch = actualChannel ?? 0;
          return {
            content: [{
              type: 'text',
              text: `Parameter "${name}" not found. Available parameters: ${formatAvailableParams(ch, slotIndex)}`,
            }],
            isError: true,
          };
        }

        // Set the parameter in FL Studio
        const result = await connection.executeCommand('plugins.set_param', {
          paramIndex: resolved.index,
          value,
          index: actualChannel,
          slotIndex,
        });

        // Update shadow state
        shadowState.set(actualChannel, slotIndex, resolved.index, value);

        const data = (result.data ?? {}) as SetParamData;
        const readBack = data.readBack;
        const displayStr = data.displayString;

        const lines: string[] = [
          `Set "${resolved.name}" = ${value.toFixed(4)}`,
          `Channel: ${actualChannel}, Slot: ${slotIndex}`,
        ];

        if (readBack !== undefined) {
          lines.push(`Read-back: ${readBack.toFixed(4)}`);
        }
        if (displayStr) {
          lines.push(`Display: ${displayStr}`);
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting plugin parameter: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
