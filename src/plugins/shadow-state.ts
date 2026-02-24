/**
 * Shadow state for plugin parameter values
 *
 * Tracks parameter values set through MCP tools. This provides a reliable
 * record of what values we have set, working around potential unreliability
 * of FL Studio's getParamValue for some VST plugins.
 *
 * Shadow state distinguishes between 'user' (set via MCP) and 'discovered'
 * (read during plugin discovery) sources. User-set values are preserved
 * when discovery re-populates state.
 */

import type { ShadowValue } from './types.js';

/**
 * Shadow state tracker for plugin parameters.
 * Keyed by "channelIndex:slotIndex:paramIndex" for per-parameter tracking.
 */
export class ShadowState {
  private state: Map<string, ShadowValue> = new Map();

  /**
   * Generate state key from channel, slot, and parameter indices.
   */
  private key(ch: number, slot: number, param: number): string {
    return `${ch}:${slot}:${param}`;
  }

  /**
   * Record a user-set parameter value.
   * Always stored with source='user' and current timestamp.
   */
  set(ch: number, slot: number, param: number, value: number): void {
    this.state.set(this.key(ch, slot, param), {
      value,
      setAt: Date.now(),
      source: 'user',
    });
  }

  /**
   * Get the shadow value for a parameter, if any.
   */
  get(ch: number, slot: number, param: number): ShadowValue | undefined {
    return this.state.get(this.key(ch, slot, param));
  }

  /**
   * Populate shadow state from discovery results.
   * Only sets values for parameters that have no existing entry, or whose
   * existing entry has source='discovered'. User-set values are preserved.
   */
  populateFromDiscovery(
    ch: number,
    slot: number,
    params: Array<{ index: number; value: number }>,
  ): void {
    for (const p of params) {
      const existing = this.state.get(this.key(ch, slot, p.index));
      if (!existing || existing.source === 'discovered') {
        this.state.set(this.key(ch, slot, p.index), {
          value: p.value,
          setAt: Date.now(),
          source: 'discovered',
        });
      }
    }
  }

  /**
   * Clear all shadow state.
   */
  clear(): void {
    this.state.clear();
  }
}

/** Singleton instance for application-wide use */
export const shadowState = new ShadowState();
