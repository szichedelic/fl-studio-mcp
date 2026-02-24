/**
 * Ornstein-Uhlenbeck timing drift transform.
 *
 * Applies correlated timing offsets using a mean-reverting Brownian walk
 * (Euler-Maruyama discretization of the Ornstein-Uhlenbeck process).
 *
 * Unlike uniform random jitter, O-U drift produces organic-sounding timing
 * where each note's offset correlates with the previous note's offset,
 * gradually reverting toward the grid. This mimics how real musicians drift
 * and self-correct.
 *
 * Optionally supports context-aware sigma scaling: dense passages get tighter
 * timing, sparse passages breathe more loosely.
 */

import type { NoteData, TimingDriftParams } from '../types.js';
import { gaussianRandom, clampTime } from './util.js';

/**
 * Calculate per-note sigma values based on local note density.
 *
 * Examines a 4-beat window (+-2 beats) around each note to determine
 * how many neighbors it has. Dense passages get tighter sigma (less drift),
 * sparse passages get looser sigma (more drift).
 *
 * @param notes - Input notes (must be sorted by time)
 * @param baseSigma - Base sigma value to scale
 * @returns Array of per-note sigma values
 */
export function calculateContextSigmas(notes: NoteData[], baseSigma: number): number[] {
  const sigmas: number[] = [];

  for (let i = 0; i < notes.length; i++) {
    const windowStart = notes[i].time - 2;
    const windowEnd = notes[i].time + 2;

    // Count neighbors within 2-beat window
    let density = 0;
    for (let j = 0; j < notes.length; j++) {
      if (notes[j].time >= windowStart && notes[j].time <= windowEnd) {
        density++;
      }
    }

    // Scale factor: sparse = loose, normal = 1.0x, dense = tight
    let scaleFactor: number;
    if (density <= 3) {
      scaleFactor = 1.5; // Sparse: breathe more
    } else if (density <= 8) {
      scaleFactor = 1.0; // Normal: base sigma
    } else {
      scaleFactor = 0.5; // Dense: tighten up
    }

    sigmas.push(baseSigma * scaleFactor);
  }

  return sigmas;
}

/**
 * Apply Ornstein-Uhlenbeck timing drift to an array of notes.
 *
 * Generates correlated timing offsets using Euler-Maruyama discretization:
 *   x_{n+1} = x_n + theta * (0 - x_n) * dt + sigma_n * sqrt(dt) * N(0,1)
 *
 * The process starts at x=0 (first note on grid) and mean-reverts toward
 * zero, producing natural-sounding timing drift that self-corrects.
 *
 * @param notes - Input notes (not mutated)
 * @param params - Timing drift parameters
 * @param rng - Optional PRNG for deterministic behavior
 * @returns New array of notes with timing drift applied
 *
 * @example
 * // Apply default timing drift
 * const drifted = applyTimingDrift(notes);
 *
 * // Apply context-aware drift with seeded RNG
 * const drifted = applyTimingDrift(notes, {
 *   theta: 0.5, sigma: 0.008, contextAware: true
 * }, seededRng);
 */
export function applyTimingDrift(
  notes: NoteData[],
  params?: TimingDriftParams,
  rng?: () => number,
): NoteData[] {
  const {
    enabled = true,
    theta = 0.5,
    sigma = 0.008,
    contextAware = false,
  } = params ?? {};

  if (!enabled || notes.length === 0) {
    return notes.map(n => ({ ...n }));
  }

  // Work on copies tagged with original indices so we can restore order
  const indexed = notes.map((n, i) => ({ note: { ...n }, originalIndex: i }));

  // Sort by time for the O-U walk (process notes in temporal order)
  indexed.sort((a, b) => a.note.time - b.note.time);

  const sortedNotes = indexed.map(item => item.note);

  // Calculate per-note sigmas (context-aware or uniform)
  const sigmas = contextAware
    ? calculateContextSigmas(sortedNotes, sigma)
    : sortedNotes.map(() => sigma);

  // Generate O-U timing offsets
  const dt = 1.0;
  let x = 0; // Start on grid

  for (let i = 0; i < sortedNotes.length; i++) {
    // Ornstein-Uhlenbeck step (Euler-Maruyama discretization)
    x = x + theta * (0 - x) * dt + sigmas[i] * Math.sqrt(dt) * gaussianRandom(0, 1, rng);

    // Apply offset and clamp time to >= 0
    sortedNotes[i].time = clampTime(sortedNotes[i].time + x);
  }

  // Restore original order
  const result: NoteData[] = new Array(notes.length);
  for (let i = 0; i < indexed.length; i++) {
    result[indexed[i].originalIndex] = sortedNotes[i];
  }

  return result;
}
