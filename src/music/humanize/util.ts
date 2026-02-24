/**
 * Humanization utility functions.
 *
 * Provides Gaussian RNG (Box-Muller), seeded PRNG, clamping helpers,
 * and beat-position classification for use across all humanization transforms.
 */

import alea from 'alea';

/**
 * Generate a normally distributed random number using the Box-Muller transform.
 *
 * @param mean - Center of the distribution (default 0)
 * @param stddev - Standard deviation (default 1)
 * @param rng - Optional PRNG function (default Math.random)
 * @returns A normally distributed random number
 */
export function gaussianRandom(mean = 0, stddev = 1, rng: () => number = Math.random): number {
  const u1 = rng();
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stddev + mean;
}

/**
 * Clamp a velocity value to [0, 1] and round to 3 decimal places.
 */
export function clampVelocity(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000;
}

/**
 * Clamp a time value to >= 0 and round to 3 decimal places.
 */
export function clampTime(t: number): number {
  return Math.round(Math.max(0, t) * 1000) / 1000;
}

/**
 * Create a seeded PRNG function using alea.
 *
 * @param seed - Seed string for reproducible sequences
 * @returns A function that returns pseudo-random numbers in [0, 1)
 */
export function createSeededRng(seed: string): () => number {
  return alea(seed);
}

/**
 * Beat position classification result.
 */
export interface BeatPosition {
  /** Beat 0 or 2 within a 4-beat bar (strong beats) */
  isDownbeat: boolean;
  /** Beat 1 or 3 within a 4-beat bar (weak beats / backbeats) */
  isBackbeat: boolean;
  /** Subdivision between beats (16th note positions that are not on a beat) */
  isOffbeat: boolean;
  /** Index of the 16th-note subdivision within the beat (0-3) */
  subdivIndex: number;
}

/**
 * Classify a time value's position within the beat.
 *
 * Uses epsilon-based comparison to handle floating-point imprecision.
 * Assumes 4/4 time with 16th-note subdivisions.
 *
 * @param time - Time in beats (quarter notes)
 * @param tolerance - Epsilon for grid detection (default 0.01 beats)
 * @returns Beat position classification
 */
export function getBeatPosition(time: number, tolerance = 0.01): BeatPosition {
  // Normalize to position within a 4-beat bar
  const barLength = 4;
  const posInBar = ((time % barLength) + barLength) % barLength;

  // Find nearest 16th-note subdivision (0.25 beats)
  const subdivSize = 0.25;
  const subdivInBar = Math.round(posInBar / subdivSize);
  const nearestSubdiv = subdivInBar * subdivSize;

  // Check if we're close to a grid point
  const onGrid = Math.abs(posInBar - nearestSubdiv) < tolerance;

  // Subdivision index within the beat (0-3)
  const subdivIndex = onGrid ? (subdivInBar % 4) : -1;

  // Beat number within the bar (0-3)
  const beatInBar = Math.floor(nearestSubdiv);

  // Classify
  const isOnBeat = onGrid && subdivIndex === 0;
  const isDownbeat = isOnBeat && (beatInBar === 0 || beatInBar === 2);
  const isBackbeat = isOnBeat && (beatInBar === 1 || beatInBar === 3);
  const isOffbeat = onGrid && subdivIndex !== 0;

  return {
    isDownbeat,
    isBackbeat,
    isOffbeat,
    subdivIndex: onGrid ? subdivIndex : -1,
  };
}
