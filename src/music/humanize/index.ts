/**
 * Humanization pipeline orchestrator.
 *
 * Composes all four transforms in the correct order:
 *   swing -> timing -> velocity -> note-length
 *
 * Supports named presets with per-field overrides and seeded PRNG
 * for reproducible results. Never mutates the input notes array.
 */

import type {
  NoteData,
  HumanizationParams,
  HumanizationResult,
  HumanizationPreset,
} from '../types.js';

import { createSeededRng } from './util.js';
import { applySwing } from './swing.js';
import { applyTimingDrift } from './timing.js';
import { applyVelocityVariation } from './velocity.js';
import { applyNoteLengthVariation } from './note-length.js';
import { getPresetParams, HUMANIZATION_PRESETS } from './presets.js';

/**
 * Apply the full humanization pipeline to an array of notes.
 *
 * Pipeline order (critical -- do not reorder):
 *   1. Swing -- defines new rhythmic grid
 *   2. Timing drift -- O-U walk around swung positions
 *   3. Velocity variation -- instrument-aware dynamics
 *   4. Note-length variation -- articulation (legato/staccato)
 *
 * @param notes - Input notes (not mutated)
 * @param params - Humanization parameters (preset, per-transform overrides, seed)
 * @returns HumanizationResult with processed notes, seed used, and list of applied transforms
 *
 * @example
 * // Use a preset
 * const result = humanize(notes, { preset: 'jazz' });
 *
 * // Override instrument within a preset
 * const result = humanize(notes, { preset: 'tight', velocity: { instrument: 'drums' } });
 *
 * // Reproducible results
 * const result = humanize(notes, { preset: 'loose', seed: 'my-seed' });
 * // result.seed === 'my-seed'
 */
export function humanize(
  notes: NoteData[],
  params?: HumanizationParams,
): HumanizationResult {
  const p = params ?? {};

  // 1. Resolve preset: deep-merge preset defaults with explicit overrides
  let resolved: HumanizationParams;
  if (p.preset) {
    const presetParams = getPresetParams(p.preset);
    resolved = {
      ...presetParams,
      ...p,
      timing: { ...presetParams.timing, ...p.timing },
      velocity: { ...presetParams.velocity, ...p.velocity },
      swing: { ...presetParams.swing, ...p.swing },
      noteLength: { ...presetParams.noteLength, ...p.noteLength },
    };
  } else {
    resolved = { ...p };
  }

  // 2. Create seeded RNG
  const seed = resolved.seed
    ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const rng = createSeededRng(seed);

  // 3. Apply pipeline in order (never mutate input)
  let result = notes.map(n => ({ ...n }));
  const applied: string[] = [];

  // 3a. Swing -- defines new rhythmic grid
  if (resolved.swing?.enabled !== false) {
    result = applySwing(result, resolved.swing, rng);
    applied.push('swing');
  }

  // 3b. Timing drift -- O-U walk around swung positions
  if (resolved.timing?.enabled !== false) {
    result = applyTimingDrift(result, resolved.timing, rng);
    applied.push('timing');
  }

  // 3c. Velocity variation -- instrument-aware dynamics
  if (resolved.velocity?.enabled !== false) {
    result = applyVelocityVariation(result, resolved.velocity, rng);
    applied.push('velocity');
  }

  // 3d. Note-length variation -- articulation
  if (resolved.noteLength?.enabled !== false) {
    result = applyNoteLengthVariation(result, resolved.noteLength, rng);
    applied.push('noteLength');
  }

  return { notes: result, seed, applied };
}

// Re-export key items for convenience
export { getPresetParams, HUMANIZATION_PRESETS } from './presets.js';
export type { HumanizationParams, HumanizationResult, HumanizationPreset } from '../types.js';
