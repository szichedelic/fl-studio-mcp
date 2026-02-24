/**
 * MPC-style swing transform.
 *
 * Implements the Roger Linn swing formula: delays off-beat subdivisions
 * by a ratio-based amount. On-beat notes remain at their grid position.
 *
 * Swing amount 50 = no swing, 66 = triplet feel, 75 = maximum swing.
 * Only affects notes that fall on off-beat subdivisions (within tolerance).
 */

import type { NoteData, SwingParams } from '../types.js';
import { clampTime } from './util.js';

/**
 * Apply MPC-style swing to an array of notes.
 *
 * Shifts off-beat subdivision notes later in time by a ratio derived from
 * the swing amount. On-beat notes are copied unchanged. Never mutates input.
 *
 * @param notes - Input notes (not mutated)
 * @param params - Swing parameters (amount, gridSize)
 * @param rng - Optional PRNG (unused, accepted for pipeline consistency)
 * @returns New array of notes with swing applied
 *
 * @example
 * // Apply triplet swing to 16th note grid
 * const swung = applySwing(notes, { amount: 66, gridSize: 0.25 });
 */
export function applySwing(
  notes: NoteData[],
  params?: SwingParams,
  rng?: () => number,
): NoteData[] {
  const {
    enabled = true,
    amount = 50,
    gridSize = 0.25,
  } = params ?? {};

  // No swing if disabled or amount is 50 (straight)
  if (!enabled || amount <= 50) {
    return notes.map(n => ({ ...n }));
  }

  // swingRatio: 0.0 (no swing) to 1.0 (max swing at 75%)
  const swingRatio = (amount - 50) / 25;
  // Maximum delay applied to off-beat notes
  const maxDelay = gridSize * swingRatio;
  // Tolerance for grid point detection (handles floating-point imprecision)
  const tolerance = gridSize * 0.1;
  // A pair of subdivisions (on-beat + off-beat)
  const pairSize = gridSize * 2;

  return notes.map(note => {
    // Find position within a pair of subdivisions
    // Use double-modulo to handle negative values correctly
    const posInPair = ((note.time % pairSize) + pairSize) % pairSize;

    // A note is "off-beat" if it falls on the second subdivision of the pair
    const isOffBeat = Math.abs(posInPair - gridSize) < tolerance;

    if (isOffBeat) {
      return { ...note, time: clampTime(note.time + maxDelay) };
    }

    return { ...note };
  });
}
