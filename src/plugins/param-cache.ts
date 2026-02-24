/**
 * Plugin parameter cache
 *
 * Caches parameter name-to-index mappings per plugin instance to avoid
 * repeated 4240-slot scans. Provides three-tier name resolution:
 * exact match, prefix match, and contains match (all case-insensitive).
 */

import type { DiscoveredParam, CachedPlugin } from './types.js';

/**
 * Cache for plugin parameter discovery results.
 * Keyed by "channelIndex:slotIndex" for per-plugin-instance storage.
 */
export class ParamCache {
  private cache: Map<string, CachedPlugin> = new Map();

  /**
   * Generate cache key from channel and slot indices.
   */
  private key(channelIndex: number, slotIndex: number): string {
    return `${channelIndex}:${slotIndex}`;
  }

  /**
   * Store discovery results for a plugin.
   * Builds a lowercase name lookup map for fast resolution.
   */
  store(
    channelIndex: number,
    slotIndex: number,
    pluginName: string,
    params: DiscoveredParam[],
  ): void {
    const paramsByName = new Map<string, DiscoveredParam>();
    for (const param of params) {
      paramsByName.set(param.name.toLowerCase().trim(), param);
    }

    this.cache.set(this.key(channelIndex, slotIndex), {
      pluginName,
      channelIndex,
      slotIndex,
      params,
      paramsByName,
      discoveredAt: Date.now(),
    });
  }

  /**
   * Get cached plugin data if available.
   */
  get(channelIndex: number, slotIndex: number): CachedPlugin | undefined {
    return this.cache.get(this.key(channelIndex, slotIndex));
  }

  /**
   * Resolve a parameter name to its DiscoveredParam info.
   * Uses three-tier matching (all case-insensitive):
   *   1. Exact match
   *   2. Prefix match (either direction)
   *   3. Contains match (either direction)
   *
   * Returns first match found, or undefined.
   */
  resolveParam(
    channelIndex: number,
    slotIndex: number,
    name: string,
  ): DiscoveredParam | undefined {
    const cached = this.cache.get(this.key(channelIndex, slotIndex));
    if (!cached) return undefined;

    const normalized = name.toLowerCase().trim();

    // Tier 1: Exact match
    const exact = cached.paramsByName.get(normalized);
    if (exact) return exact;

    // Tier 2: Prefix match
    for (const [key, info] of cached.paramsByName) {
      if (key.startsWith(normalized) || normalized.startsWith(key)) {
        return info;
      }
    }

    // Tier 3: Contains match
    for (const [key, info] of cached.paramsByName) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return info;
      }
    }

    return undefined;
  }

  /**
   * Invalidate cached data.
   * If both channelIndex and slotIndex provided, invalidates that specific plugin.
   * If neither provided, clears all cached data.
   */
  invalidate(channelIndex?: number, slotIndex?: number): void {
    if (channelIndex !== undefined && slotIndex !== undefined) {
      this.cache.delete(this.key(channelIndex, slotIndex));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if a plugin's parameters are cached.
   */
  has(channelIndex: number, slotIndex: number): boolean {
    return this.cache.has(this.key(channelIndex, slotIndex));
  }
}

/** Singleton instance for application-wide use */
export const paramCache = new ParamCache();
