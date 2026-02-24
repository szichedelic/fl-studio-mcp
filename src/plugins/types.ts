/**
 * Plugin parameter types for FL Studio MCP bridge
 *
 * Defines interfaces for plugin parameter discovery, caching, and shadow state.
 * Used by param-cache.ts and shadow-state.ts modules.
 */

/**
 * Basic plugin parameter info (index + name).
 * FL Studio parameter indices range from 0-4239 for VST plugins.
 */
export interface PluginParamInfo {
  index: number;      // FL Studio parameter index (0-4239)
  name: string;       // Parameter display name
}

/**
 * Parameter info with its current value, returned from discovery.
 */
export interface DiscoveredParam extends PluginParamInfo {
  value: number;      // Current value 0.0-1.0 from discovery
}

/**
 * Cached plugin with all discovered parameters and name lookup map.
 * Stored per channel+slot combination to avoid re-scanning 4240 slots.
 */
export interface CachedPlugin {
  pluginName: string;
  channelIndex: number;
  slotIndex: number;
  params: DiscoveredParam[];
  paramsByName: Map<string, DiscoveredParam>;  // lowercase name -> info
  discoveredAt: number;  // Date.now()
}

/**
 * Shadow value tracking for parameters set through MCP tools.
 * Preserves user-set values over discovered values since getParamValue
 * can be unreliable for some VST plugins.
 */
export interface ShadowValue {
  value: number;       // 0.0 - 1.0
  setAt: number;       // Date.now()
  source: 'user' | 'discovered';
}
