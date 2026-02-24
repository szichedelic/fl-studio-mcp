/**
 * Serum 2 Sound Design Tools for FL Studio MCP
 *
 * Provides MCP tools for Serum 2 parameter control, sound recipes,
 * and preset browsing:
 * - serum_set_param: Set a Serum 2 parameter using musical language
 * - serum_apply_recipe: Apply a multi-parameter sound design recipe
 * - serum_browse_presets: Browse Serum 2 presets by category/name
 * - serum_next_preset: Navigate to the next preset
 * - serum_prev_preset: Navigate to the previous preset
 * - serum_list_recipes: List available sound design recipes
 *
 * Semantic aliases (from aliases.ts) are resolved BEFORE Phase 4's
 * three-tier fuzzy matching, giving users natural language control
 * over Serum 2's 685 parameters.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';
import { paramCache } from '../plugins/param-cache.js';
import { shadowState } from '../plugins/shadow-state.js';
import { resolveSemanticAlias } from '../plugins/serum/aliases.js';
import { RECIPES, findRecipes, listRecipeNames } from '../plugins/serum/recipes.js';
import { listSerumPresets, getSerumPresetDir } from '../plugins/serum/presets.js';
import type { DiscoveredParam } from '../plugins/types.js';

/** Shape of plugins.discover response (top-level keys from Python handler) */
interface DiscoverData {
  channelIndex?: number;
  pluginName?: string;
  parameters?: DiscoveredParam[];
}

/** Shape of plugins.set_param response (top-level keys from Python handler) */
interface SetParamData {
  readBack?: number;
  valueString?: string;
}

/** Shape of preset navigation response */
interface PresetNavData {
  presetName?: string;
  presetIndex?: number;
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
    60000,
  );

  if (!result.success) {
    return undefined;
  }

  const data = result as unknown as DiscoverData;
  const actualChannel = data.channelIndex ?? channelIndex ?? 0;
  const pluginName = data.pluginName ?? 'Unknown';
  const params = data.parameters ?? [];

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
 * Register Serum 2 sound design tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerSerumTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  // ── serum_set_param ───────────────────────────────────────────────────

  const setParamSchema = {
    name: z.string()
      .describe('Parameter name using musical language. Supports names like "filter cutoff", "osc a level", "macro 1". Fuzzy matched through semantic aliases.'),
    value: z.number().min(0).max(1)
      .describe('Parameter value from 0.0 to 1.0 (normalized).'),
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel rack index of Serum 2 instance. Omit to use the currently selected channel.'),
  };

  server.tool(
    'serum_set_param',
    'Set a Serum 2 parameter using musical language. Supports names like "filter cutoff", "osc a level", "macro 1". Fuzzy matched through semantic aliases.',
    setParamSchema,
    async ({ name, value, channelIndex }) => {
      try {
        const slotIndex = -1; // Serum 2 is a channel rack plugin

        // Step 1: Resolve semantic alias to actual FL Studio param name
        const resolvedName = resolveSemanticAlias(name);
        let actualChannel = channelIndex;

        // Step 2: Try param cache first
        let resolved: DiscoveredParam | undefined;
        if (actualChannel !== undefined) {
          resolved = paramCache.resolveParam(actualChannel, slotIndex, resolvedName);
        }

        // Step 3: Auto-discover if not found
        if (!resolved) {
          const discovered = await autoDiscover(connection, channelIndex, slotIndex);
          if (!discovered) {
            return {
              content: [{ type: 'text' as const, text: 'Failed to discover Serum 2 parameters. Make sure Serum 2 is loaded on the specified channel.' }],
              isError: true,
            };
          }
          actualChannel = discovered.channelIndex;
          resolved = paramCache.resolveParam(actualChannel, slotIndex, resolvedName);
        }

        // Step 4: Still not found after discovery
        if (!resolved || actualChannel === undefined) {
          const ch = actualChannel ?? 0;
          return {
            content: [{
              type: 'text' as const,
              text: `Parameter "${name}" (resolved: "${resolvedName}") not found. Available parameters: ${formatAvailableParams(ch, slotIndex)}`,
            }],
            isError: true,
          };
        }

        // Step 5: Set the parameter in FL Studio
        const result = await connection.executeCommand('plugins.set_param', {
          paramIndex: resolved.index,
          value,
          index: actualChannel,
          slotIndex,
        });

        // Step 6: Update shadow state
        shadowState.set(actualChannel, slotIndex, resolved.index, value);

        const data = result as unknown as SetParamData;
        const pct = (value * 100).toFixed(1);

        const lines: string[] = [
          `Set "${resolved.name}" = ${pct}%`,
        ];

        if (name.toLowerCase() !== resolvedName.toLowerCase()) {
          lines.push(`Alias: "${name}" -> "${resolvedName}"`);
        }

        lines.push(`Channel: ${actualChannel}`);

        if (data.readBack !== undefined) {
          lines.push(`Read-back: ${data.readBack.toFixed(4)}`);
        }
        if (data.valueString) {
          lines.push(`Display: ${data.valueString}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error setting Serum 2 parameter: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── serum_apply_recipe ────────────────────────────────────────────────

  const applyRecipeSchema = {
    recipe: z.string()
      .describe('Recipe name or search term. E.g., "warm pad", "supersaw lead", "sub bass", "bass", "ambient".'),
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel rack index of Serum 2 instance. Omit to use the currently selected channel.'),
  };

  server.tool(
    'serum_apply_recipe',
    'Apply a sound design recipe to Serum 2. Creates a complete sound from a description like "warm pad" or "supersaw lead".',
    applyRecipeSchema,
    async ({ recipe, channelIndex }) => {
      try {
        const slotIndex = -1;

        // Step 1: Find matching recipe
        const matches = findRecipes(recipe);
        if (matches.length === 0) {
          const available = listRecipeNames().join(', ');
          return {
            content: [{
              type: 'text' as const,
              text: `No recipe found matching "${recipe}". Available recipes: ${available}`,
            }],
            isError: true,
          };
        }

        const selectedRecipe = matches[0];

        // Step 2: Auto-discover if needed
        let actualChannel = channelIndex;
        if (actualChannel === undefined || !paramCache.has(actualChannel, slotIndex)) {
          const discovered = await autoDiscover(connection, channelIndex, slotIndex);
          if (!discovered) {
            return {
              content: [{ type: 'text' as const, text: 'Failed to discover Serum 2 parameters. Make sure Serum 2 is loaded on the specified channel.' }],
              isError: true,
            };
          }
          actualChannel = discovered.channelIndex;
        }

        // Step 3: Apply each parameter
        const applied: string[] = [];
        const failed: string[] = [];

        for (const [paramName, paramValue] of Object.entries(selectedRecipe.parameters)) {
          const resolvedName = resolveSemanticAlias(paramName);
          const resolved = paramCache.resolveParam(actualChannel, slotIndex, resolvedName);

          if (!resolved) {
            failed.push(`${paramName} (resolved: ${resolvedName})`);
            continue;
          }

          try {
            await connection.executeCommand('plugins.set_param', {
              paramIndex: resolved.index,
              value: paramValue,
              index: actualChannel,
              slotIndex,
            });
            shadowState.set(actualChannel, slotIndex, resolved.index, paramValue);
            applied.push(`${resolved.name} = ${(paramValue * 100).toFixed(0)}%`);
          } catch {
            failed.push(`${paramName} (set failed)`);
          }
        }

        // Step 4: Build summary
        const lines: string[] = [
          `Recipe: ${selectedRecipe.name}`,
          `Category: ${selectedRecipe.category}`,
          `Description: ${selectedRecipe.description}`,
          `Channel: ${actualChannel}`,
          '',
          `Applied ${applied.length}/${applied.length + failed.length} parameters:`,
        ];

        for (const a of applied) {
          lines.push(`  ${a}`);
        }

        if (failed.length > 0) {
          lines.push('');
          lines.push(`Failed (${failed.length}):`);
          for (const f of failed) {
            lines.push(`  ${f}`);
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error applying Serum 2 recipe: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── serum_browse_presets ──────────────────────────────────────────────

  const browsePresetsSchema = {
    category: z.string().optional()
      .describe('Filter by category folder name (e.g., "Bass", "Leads", "Pads"). Case-insensitive substring match.'),
    search: z.string().optional()
      .describe('Search by preset name. Case-insensitive substring match.'),
    limit: z.number().int().min(1).max(100).default(20).optional()
      .describe('Maximum number of presets to return (default: 20, max: 100).'),
  };

  server.tool(
    'serum_browse_presets',
    'Browse Serum 2 presets on the filesystem. Filter by category (Bass, Leads, Pads, etc.) or search by name.',
    browsePresetsSchema,
    async ({ category, search, limit }) => {
      try {
        const maxResults = limit ?? 20;
        const presets = await listSerumPresets(category, search);

        if (presets.length === 0) {
          const presetDir = getSerumPresetDir();
          return {
            content: [{
              type: 'text' as const,
              text: `No presets found${category ? ` in category "${category}"` : ''}${search ? ` matching "${search}"` : ''}.\n\nPreset directory: ${presetDir}\n\nIf Serum 2 presets are installed elsewhere, set the SERUM2_PRESET_DIR environment variable.`,
            }],
          };
        }

        const truncated = presets.slice(0, maxResults);

        // Group by category for display
        const byCategory = new Map<string, string[]>();
        for (const preset of truncated) {
          const existing = byCategory.get(preset.category) ?? [];
          existing.push(preset.name);
          byCategory.set(preset.category, existing);
        }

        const lines: string[] = [
          `Found ${presets.length} preset(s)${presets.length > maxResults ? ` (showing first ${maxResults})` : ''}:`,
          '',
        ];

        for (const [cat, names] of byCategory) {
          lines.push(`[${cat}]`);
          for (const name of names) {
            lines.push(`  ${name}`);
          }
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n').trimEnd() }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error browsing presets: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── serum_next_preset ────────────────────────────────────────────────

  const nextPresetSchema = {
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel rack index of Serum 2 instance. Omit to use the currently selected channel.'),
  };

  server.tool(
    'serum_next_preset',
    'Navigate to the next preset in Serum 2.',
    nextPresetSchema,
    async ({ channelIndex }) => {
      try {
        const result = await connection.executeCommand('plugins.next_preset', {
          index: channelIndex,
          slotIndex: -1,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: 'Failed to navigate to next preset. Make sure Serum 2 is loaded on the specified channel.' }],
            isError: true,
          };
        }

        const data = result as unknown as PresetNavData;
        const presetName = data.presetName ?? 'Unknown';
        const lines = [`Navigated to next preset: ${presetName}`];
        if (data.presetIndex !== undefined) {
          lines.push(`Preset index: ${data.presetIndex}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error navigating to next preset: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── serum_prev_preset ────────────────────────────────────────────────

  const prevPresetSchema = {
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel rack index of Serum 2 instance. Omit to use the currently selected channel.'),
  };

  server.tool(
    'serum_prev_preset',
    'Navigate to the previous preset in Serum 2.',
    prevPresetSchema,
    async ({ channelIndex }) => {
      try {
        const result = await connection.executeCommand('plugins.prev_preset', {
          index: channelIndex,
          slotIndex: -1,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: 'Failed to navigate to previous preset. Make sure Serum 2 is loaded on the specified channel.' }],
            isError: true,
          };
        }

        const data = result as unknown as PresetNavData;
        const presetName = data.presetName ?? 'Unknown';
        const lines = [`Navigated to previous preset: ${presetName}`];
        if (data.presetIndex !== undefined) {
          lines.push(`Preset index: ${data.presetIndex}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error navigating to previous preset: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── serum_list_recipes ───────────────────────────────────────────────

  const listRecipesSchema = {
    category: z.string().optional()
      .describe('Filter recipes by category (e.g., "pad", "lead", "bass", "pluck", "keys", "fx").'),
  };

  server.tool(
    'serum_list_recipes',
    'List all available Serum 2 sound design recipes.',
    listRecipesSchema,
    async ({ category }) => {
      try {
        let recipes = RECIPES;

        if (category) {
          const cat = category.toLowerCase().trim();
          recipes = recipes.filter((r) => r.category.toLowerCase() === cat);
        }

        if (recipes.length === 0) {
          const categories = [...new Set(RECIPES.map((r) => r.category))].sort();
          return {
            content: [{
              type: 'text' as const,
              text: `No recipes found${category ? ` in category "${category}"` : ''}. Available categories: ${categories.join(', ')}`,
            }],
          };
        }

        const lines: string[] = [
          `Available Serum 2 recipes (${recipes.length}):`,
          '',
        ];

        for (const recipe of recipes) {
          const tags = recipe.tags?.length ? ` [${recipe.tags.join(', ')}]` : '';
          lines.push(`${recipe.name} (${recipe.category})`);
          lines.push(`  ${recipe.description}`);
          lines.push(`  Parameters: ${Object.keys(recipe.parameters).length}${tags}`);
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n').trimEnd() }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error listing recipes: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
