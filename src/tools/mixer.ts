/**
 * Mixer Control Tools for FL Studio MCP
 *
 * Provides MCP tools for controlling mixer tracks:
 * - set_mixer_volume: Set track volume (0.0-1.0, 0.8 = 0dB)
 * - set_mixer_pan: Set track pan (-1.0 to 1.0)
 * - mute_mixer_track: Mute/unmute track
 * - solo_mixer_track: Solo/unsolo track
 * - set_mixer_track_name: Rename track
 * - set_mixer_track_color: Set track color (RGB hex input, converted to BGR)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';
import { paramCache } from '../plugins/param-cache.js';
import { shadowState } from '../plugins/shadow-state.js';

/**
 * Convert RGB hex string (#RRGGBB) to FL Studio BGR integer.
 * FL Studio uses BGR format (0x00BBGGRR).
 *
 * @param hex - RGB hex string (e.g., "#FF0000" for red)
 * @returns BGR integer value
 */
function rgbHexToBgr(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (b << 16) | (g << 8) | r;
}

/**
 * Convert level input to FL Studio normalized value (0.0-1.0).
 * FL Studio uses 0.8 = unity gain (0dB), not 1.0.
 *
 * Accepts:
 * - Normalized: 0.0-1.0 directly (when levelPercent and levelDb are undefined)
 * - Percentage: 0-100 maps to 0.0-1.0 (100% = 1.0, which is +5.6dB)
 * - Decibels: dB value where 0dB = 0.8 normalized
 *
 * @returns Normalized level 0.0-1.0
 */
function normalizeSendLevel(
  level?: number,
  levelPercent?: number,
  levelDb?: number,
): number {
  if (levelDb !== undefined) {
    // dB conversion: 0dB = 0.8, formula approximates FL Studio's curve
    // Clamp to reasonable range (-inf to +6dB)
    const clampedDb = Math.max(-60, Math.min(6, levelDb));
    if (clampedDb <= -60) return 0;
    // FL Studio: 0.8 = 0dB, scale is roughly 10^(dB/50) * 0.8
    return Math.min(1.0, 0.8 * Math.pow(10, clampedDb / 50));
  }
  if (levelPercent !== undefined) {
    // Percentage: 0-100 maps to 0.0-1.0
    return Math.max(0, Math.min(1, levelPercent / 100));
  }
  if (level !== undefined) {
    // Already normalized
    return Math.max(0, Math.min(1, level));
  }
  // Default to unity gain
  return 0.8;
}

/**
 * Register mixer control tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerMixerTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  // ── set_mixer_volume ─────────────────────────────────────────────────────

  const setVolumeSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    volume: z.number().min(0).max(1)
      .describe('Volume level (0.0-1.0, where 0.8 = 0dB unity gain)'),
  };

  server.tool(
    'set_mixer_volume',
    "Set a mixer track's volume level (0.0-1.0, where 0.8 = unity/0dB)",
    setVolumeSchema,
    async ({ track, volume }) => {
      try {
        const result = await connection.executeCommand('mixer.set_volume', {
          index: track,
          volume,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set mixer volume: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting mixer volume: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_mixer_pan ────────────────────────────────────────────────────────

  const setPanSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    pan: z.number().min(-1).max(1)
      .describe('Pan position (-1.0=hard left, 0=center, 1.0=hard right)'),
  };

  server.tool(
    'set_mixer_pan',
    "Set a mixer track's pan position (-1.0=left, 0=center, 1.0=right)",
    setPanSchema,
    async ({ track, pan }) => {
      try {
        const result = await connection.executeCommand('mixer.set_pan', {
          index: track,
          pan,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set mixer pan: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting mixer pan: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── mute_mixer_track ─────────────────────────────────────────────────────

  const muteSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    mute: z.boolean()
      .describe('True to mute, false to unmute'),
  };

  server.tool(
    'mute_mixer_track',
    'Mute or unmute a mixer track',
    muteSchema,
    async ({ track, mute }) => {
      try {
        const result = await connection.executeCommand('mixer.mute', {
          index: track,
          mute,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to mute/unmute track: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error muting/unmuting track: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── solo_mixer_track ─────────────────────────────────────────────────────

  const soloSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    solo: z.boolean()
      .describe('True to solo, false to unsolo'),
  };

  server.tool(
    'solo_mixer_track',
    'Solo or unsolo a mixer track',
    soloSchema,
    async ({ track, solo }) => {
      try {
        const result = await connection.executeCommand('mixer.solo', {
          index: track,
          solo,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to solo/unsolo track: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error solo/unsolo track: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_mixer_track_name ─────────────────────────────────────────────────

  const setNameSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    name: z.string()
      .describe('New track name (empty string resets to default)'),
  };

  server.tool(
    'set_mixer_track_name',
    "Set a mixer track's display name",
    setNameSchema,
    async ({ track, name }) => {
      try {
        const result = await connection.executeCommand('mixer.set_name', {
          index: track,
          name,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set track name: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting track name: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_mixer_track_color ────────────────────────────────────────────────

  const setColorSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    color: z.string()
      .describe('Color as RGB hex string (e.g., "#FF0000" for red, "#00FF00" for green)'),
  };

  server.tool(
    'set_mixer_track_color',
    "Set a mixer track's color (accepts RGB hex like '#FF0000' for red)",
    setColorSchema,
    async ({ track, color }) => {
      try {
        // Convert RGB hex to FL Studio BGR format
        const bgrValue = rgbHexToBgr(color);

        const result = await connection.executeCommand('mixer.set_color', {
          index: track,
          color: bgrValue,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set track color: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting track color: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_mixer_routing ─────────────────────────────────────────────────────

  server.tool(
    'get_mixer_routing',
    'Get full routing table showing all active send routes between mixer tracks',
    {},
    async () => {
      try {
        const result = await connection.executeCommand('mixer.get_routing', {});

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to get mixer routing: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error getting mixer routing: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_track_sends ───────────────────────────────────────────────────────

  const getTrackSendsSchema = {
    track: z.union([z.number().int().min(0), z.string()])
      .describe('Mixer track (index like 0=Master, 1+=inserts, OR track name for lookup)'),
  };

  server.tool(
    'get_track_sends',
    'Get all send routes for a specific mixer track (by index or name)',
    getTrackSendsSchema,
    async ({ track }) => {
      try {
        const params = typeof track === 'number' ? { index: track } : { name: track };
        const result = await connection.executeCommand('mixer.get_track_sends', params);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to get track sends: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error getting track sends: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── create_send ───────────────────────────────────────────────────────────

  const createSendSchema = {
    source: z.union([z.number().int().min(0), z.string()])
      .describe('Source mixer track (index or name)'),
    destination: z.union([z.number().int().min(0), z.string()])
      .describe('Destination mixer track (index or name)'),
    level: z.number().min(0).max(1).optional()
      .describe('Send level as normalized value (0-1, where 0.8=0dB unity)'),
    levelPercent: z.number().min(0).max(100).optional()
      .describe('Send level as percentage (0-100, where 80%=0dB)'),
    levelDb: z.number().min(-60).max(6).optional()
      .describe('Send level in decibels (-60 to +6dB, 0dB = unity)'),
  };

  server.tool(
    'create_send',
    'Create a send route between mixer tracks. Level can be specified as normalized (0-1 where 0.8=0dB), percentage (0-100), or decibels (-60 to +6dB). Defaults to unity (0dB) if not specified.',
    createSendSchema,
    async ({ source, destination, level, levelPercent, levelDb }) => {
      try {
        // Enable the route - handler's _resolve_track_ref handles both int and str
        const routeResult = await connection.executeCommand('mixer.set_route', {
          source,
          destination,
          enabled: true,
        });

        if (!routeResult.success) {
          return {
            content: [{ type: 'text', text: `Failed to create send: ${JSON.stringify(routeResult)}` }],
            isError: true,
          };
        }

        // Set level if specified (and not the default unity)
        const normalizedLevel = normalizeSendLevel(level, levelPercent, levelDb);
        if (normalizedLevel !== 0.8) {
          const levelResult = await connection.executeCommand('mixer.set_route_level', {
            source,
            destination,
            level: normalizedLevel,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify({ ...routeResult, level: normalizedLevel, levelSet: levelResult.success }, null, 2) }],
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({ ...routeResult, level: normalizedLevel }, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error creating send: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── remove_send ───────────────────────────────────────────────────────────

  const removeSendSchema = {
    source: z.union([z.number().int().min(0), z.string()])
      .describe('Source mixer track (index or name)'),
    destination: z.union([z.number().int().min(0), z.string()])
      .describe('Destination mixer track (index or name)'),
  };

  server.tool(
    'remove_send',
    'Remove a send route between mixer tracks (by index or name)',
    removeSendSchema,
    async ({ source, destination }) => {
      try {
        // Handler's _resolve_track_ref handles both int and str
        const result = await connection.executeCommand('mixer.set_route', {
          source,
          destination,
          enabled: false,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to remove send: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error removing send: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_send_level ────────────────────────────────────────────────────────

  const setSendLevelSchema = {
    source: z.union([z.number().int().min(0), z.string()])
      .describe('Source mixer track (index or name)'),
    destination: z.union([z.number().int().min(0), z.string()])
      .describe('Destination mixer track (index or name)'),
    level: z.number().min(0).max(1).optional()
      .describe('Send level as normalized value (0-1, where 0.8=0dB unity)'),
    levelPercent: z.number().min(0).max(100).optional()
      .describe('Send level as percentage (0-100, where 80%=0dB)'),
    levelDb: z.number().min(-60).max(6).optional()
      .describe('Send level in decibels (-60 to +6dB, 0dB = unity)'),
  };

  server.tool(
    'set_send_level',
    'Set send level for an existing route. Accepts: normalized (0-1 where 0.8=0dB), percentage (0-100), or decibels (-60 to +6dB). At least one level format required.',
    setSendLevelSchema,
    async ({ source, destination, level, levelPercent, levelDb }) => {
      try {
        // Validate at least one level format is provided
        if (level === undefined && levelPercent === undefined && levelDb === undefined) {
          return {
            content: [{ type: 'text', text: 'Error: At least one level format (level, levelPercent, or levelDb) is required' }],
            isError: true,
          };
        }

        // Handler's _resolve_track_ref handles both int and str
        const normalizedLevel = normalizeSendLevel(level, levelPercent, levelDb);

        const result = await connection.executeCommand('mixer.set_route_level', {
          source,
          destination,
          level: normalizedLevel,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set send level: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({ ...result, normalizedLevel }, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting send level: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_mixer_eq ──────────────────────────────────────────────────────────

  const getMixerEqSchema = {
    track: z.union([z.number().int().min(0), z.string()])
      .describe('Mixer track (index like 0=Master, 1+=inserts, OR track name for lookup)'),
  };

  server.tool(
    'get_mixer_eq',
    'Get EQ settings for a mixer track (by index or name). Returns all 3 bands with gain (normalized + dB), frequency (normalized + Hz), and bandwidth.',
    getMixerEqSchema,
    async ({ track }) => {
      try {
        const params = typeof track === 'number' ? { index: track } : { name: track };
        const result = await connection.executeCommand('mixer.get_eq', params);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to get mixer EQ: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error getting mixer EQ: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_mixer_eq_band ─────────────────────────────────────────────────────

  const setMixerEqBandSchema = {
    track: z.union([z.number().int().min(0), z.string()])
      .describe('Mixer track (index like 0=Master, 1+=inserts, OR track name for lookup)'),
    band: z.number().int().min(0).max(2)
      .describe('EQ band index (0=Low, 1=Mid, 2=High)'),
    gain: z.number().min(0).max(1).optional()
      .describe('Normalized gain (0-1, where 0.5=0dB)'),
    frequency: z.number().min(0).max(1).optional()
      .describe('Normalized frequency (0-1)'),
    bandwidth: z.number().min(0).max(1).optional()
      .describe('Normalized bandwidth (0-1)'),
  };

  server.tool(
    'set_mixer_eq_band',
    'Set EQ band parameters for a mixer track. Band: 0=Low, 1=Mid, 2=High. Values are normalized 0-1. At least one of gain/frequency/bandwidth should be provided.',
    setMixerEqBandSchema,
    async ({ track, band, gain, frequency, bandwidth }) => {
      try {
        const trackParam = typeof track === 'number' ? { index: track } : { name: track };

        // Build params with only defined values
        const eqParams: Record<string, unknown> = { ...trackParam, band };
        if (gain !== undefined) eqParams.gain = gain;
        if (frequency !== undefined) eqParams.frequency = frequency;
        if (bandwidth !== undefined) eqParams.bandwidth = bandwidth;

        const result = await connection.executeCommand('mixer.set_eq_band', eqParams);

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set mixer EQ band: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting mixer EQ band: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── discover_mixer_effect ─────────────────────────────────────────────────

  const discoverMixerEffectSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    slot: z.number().int().min(0).max(9)
      .describe('Effect slot index (0-9)'),
  };

  server.tool(
    'discover_mixer_effect',
    "Discover a plugin in a mixer track's effect slot. Returns plugin name and parameter list. Must be called before get/set_mixer_effect_param.",
    discoverMixerEffectSchema,
    async ({ track, slot }) => {
      try {
        const result = await connection.executeCommand('plugins.discover', {
          index: track,
          slotIndex: slot,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to discover mixer effect: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        // Store in paramCache - track IS channelIndex for mixer slots
        const response = result as { success: boolean; pluginName?: string; params?: Array<{ index: number; name: string; value: number }> };
        if (response.pluginName && response.params) {
          paramCache.store(track, slot, response.pluginName, response.params);
        }

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            pluginName: response.pluginName,
            paramCount: response.params?.length ?? 0,
            track,
            slot,
          }, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error discovering mixer effect: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_mixer_effect_param ────────────────────────────────────────────────

  const getMixerEffectParamSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    slot: z.number().int().min(0).max(9)
      .describe('Effect slot index (0-9)'),
    name: z.string()
      .describe('Parameter name (fuzzy matched - partial names work)'),
  };

  server.tool(
    'get_mixer_effect_param',
    'Get a parameter value from a mixer effect slot plugin by name. Requires prior discover_mixer_effect call.',
    getMixerEffectParamSchema,
    async ({ track, slot, name }) => {
      try {
        // Check cache first - track IS channelIndex for mixer slots
        const cached = paramCache.get(track, slot);
        if (!cached) {
          return {
            content: [{ type: 'text', text: `Plugin not discovered. Call discover_mixer_effect first for track ${track}, slot ${slot}.` }],
            isError: true,
          };
        }

        // Resolve parameter name
        const resolved = paramCache.resolveParam(track, slot, name);
        if (!resolved) {
          const availableParams = cached.params.slice(0, 20).map(p => p.name).join(', ');
          return {
            content: [{ type: 'text', text: `Parameter "${name}" not found. Available params include: ${availableParams}${cached.params.length > 20 ? '...' : ''}` }],
            isError: true,
          };
        }

        // Get value from FL Studio
        const result = await connection.executeCommand('plugins.get_param', {
          index: track,
          slotIndex: slot,
          paramIndex: resolved.index,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to get effect param: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        const response = result as { success: boolean; value?: number };
        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            paramName: resolved.name,
            paramIndex: resolved.index,
            value: response.value,
            track,
            slot,
          }, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error getting mixer effect param: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_mixer_effect_param ────────────────────────────────────────────────

  const setMixerEffectParamSchema = {
    track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
    slot: z.number().int().min(0).max(9)
      .describe('Effect slot index (0-9)'),
    name: z.string()
      .describe('Parameter name (fuzzy matched - partial names work)'),
    value: z.number().min(0).max(1)
      .describe('Normalized value (0-1)'),
  };

  server.tool(
    'set_mixer_effect_param',
    'Set a parameter value on a mixer effect slot plugin by name. Requires prior discover_mixer_effect call.',
    setMixerEffectParamSchema,
    async ({ track, slot, name, value }) => {
      try {
        // Check cache first - track IS channelIndex for mixer slots
        const cached = paramCache.get(track, slot);
        if (!cached) {
          return {
            content: [{ type: 'text', text: `Plugin not discovered. Call discover_mixer_effect first for track ${track}, slot ${slot}.` }],
            isError: true,
          };
        }

        // Resolve parameter name
        const resolved = paramCache.resolveParam(track, slot, name);
        if (!resolved) {
          const availableParams = cached.params.slice(0, 20).map(p => p.name).join(', ');
          return {
            content: [{ type: 'text', text: `Parameter "${name}" not found. Available params include: ${availableParams}${cached.params.length > 20 ? '...' : ''}` }],
            isError: true,
          };
        }

        // Set value in FL Studio
        const result = await connection.executeCommand('plugins.set_param', {
          index: track,
          slotIndex: slot,
          paramIndex: resolved.index,
          value,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to set effect param: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        // Update shadow state
        shadowState.set(track, slot, resolved.index, value);

        return {
          content: [{ type: 'text', text: JSON.stringify({
            success: true,
            paramName: resolved.name,
            paramIndex: resolved.index,
            value,
            track,
            slot,
          }, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error setting mixer effect param: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── set_channel_target ────────────────────────────────────────────────────

  const setChannelTargetSchema = {
    channel: z.number().int().min(0)
      .describe('Channel index (0-based)'),
    mixer_track: z.number().int().min(0)
      .describe('Mixer track index (0=Master, 1+=insert tracks)'),
  };

  server.tool(
    'set_channel_target',
    'Route a channel to a mixer track. Use this to assign channels to mixer inserts for mixing.',
    setChannelTargetSchema,
    async ({ channel, mixer_track }) => {
      try {
        const result = await connection.executeCommand('mixer.set_channel_target', {
          channel,
          mixer_track,
        });

        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to route channel: ${JSON.stringify(result)}` }],
            isError: true,
          };
        }

        const r = result as unknown as { channel_name: string; channel: number; mixer_track: number };
        return {
          content: [{ type: 'text', text: `Routed "${r.channel_name}" (ch ${r.channel}) → Insert ${r.mixer_track}` }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error routing channel: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
