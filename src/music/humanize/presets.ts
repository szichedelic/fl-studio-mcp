/**
 * Named humanization preset configurations.
 *
 * Each preset bundles timing, velocity, swing, and note-length parameters
 * into a cohesive configuration that produces a distinct musical character:
 *
 * - **tight**: Electronic/pop precision -- fast reversion, tiny drift, no swing.
 *   Notes feel human but firmly anchored to the grid.
 *
 * - **loose**: Relaxed performance -- slow reversion, moderate drift, slight swing.
 *   Notes breathe naturally with context-aware timing.
 *
 * - **jazz**: Jazz/soul/neo-soul feel -- very slow reversion, wide drift,
 *   triplet swing (66%), high velocity variation. Context-aware timing
 *   lets fast runs stay tight while sustained notes drift.
 *
 * - **lo-fi**: Deliberately imperfect -- minimal reversion (notes wander),
 *   large sigma, moderate swing, no beat emphasis, no downbeat legato.
 *   Intentionally unanchored, tape-degraded character.
 */

import type { HumanizationParams, HumanizationPreset } from '../types.js';

/**
 * All available humanization presets keyed by name.
 *
 * Each preset produces distinctly different musical character through
 * different combinations of theta, sigma, swing amount, velocity variation,
 * and note-length settings.
 */
export const HUMANIZATION_PRESETS: Record<HumanizationPreset, HumanizationParams> = {
  tight: {
    timing: { enabled: true, theta: 0.7, sigma: 0.003, contextAware: false },
    velocity: { enabled: true, instrument: 'default', amount: 0.3, beatEmphasis: true },
    swing: { enabled: false, amount: 50 },
    noteLength: { enabled: true, amount: 0.15, downbeatLegato: true },
  },
  loose: {
    timing: { enabled: true, theta: 0.3, sigma: 0.015, contextAware: true },
    velocity: { enabled: true, instrument: 'default', amount: 0.6, beatEmphasis: true },
    swing: { enabled: true, amount: 55, gridSize: 0.25 },
    noteLength: { enabled: true, amount: 0.4, downbeatLegato: true },
  },
  jazz: {
    timing: { enabled: true, theta: 0.2, sigma: 0.020, contextAware: true },
    velocity: { enabled: true, instrument: 'default', amount: 0.7, beatEmphasis: true },
    swing: { enabled: true, amount: 66, gridSize: 0.25 },
    noteLength: { enabled: true, amount: 0.5, downbeatLegato: true },
  },
  'lo-fi': {
    timing: { enabled: true, theta: 0.15, sigma: 0.025, contextAware: false },
    velocity: { enabled: true, instrument: 'default', amount: 0.8, beatEmphasis: false },
    swing: { enabled: true, amount: 60, gridSize: 0.25 },
    noteLength: { enabled: true, amount: 0.6, downbeatLegato: false },
  },
};

/** List of all available preset names. */
const AVAILABLE_PRESETS = Object.keys(HUMANIZATION_PRESETS) as HumanizationPreset[];

/**
 * Get a deep copy of the humanization parameters for a named preset.
 *
 * Returns a new object each time so callers can safely mutate the result
 * (e.g., to override the instrument profile) without affecting the preset.
 *
 * @param preset - Named preset identifier
 * @returns Deep copy of the preset's HumanizationParams
 * @throws Error if the preset name is not recognized
 *
 * @example
 * const params = getPresetParams('jazz');
 * params.velocity!.instrument = 'piano'; // Override instrument
 */
export function getPresetParams(preset: HumanizationPreset): HumanizationParams {
  const config = HUMANIZATION_PRESETS[preset];

  if (!config) {
    throw new Error(
      `Unknown humanization preset: "${preset}". ` +
      `Available presets: ${AVAILABLE_PRESETS.join(', ')}`,
    );
  }

  // Deep copy to prevent mutation of the preset object
  return JSON.parse(JSON.stringify(config));
}
