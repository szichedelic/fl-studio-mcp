/**
 * Beat-position-aware note-length variation transform.
 *
 * Varies note durations to add articulation: downbeats become slightly
 * more legato (longer), off-beats become slightly more staccato (shorter).
 * Variation is random but bounded to prevent extreme duration changes.
 *
 * The variation amount is capped at +-30% of original duration regardless
 * of parameter values, and durations are clamped to a minimum of 0.01 beats
 * to prevent zero-length or negative notes.
 */

import type { NoteData, NoteLengthParams } from '../types.js';
import { getBeatPosition } from './util.js';

/**
 * Apply beat-position-aware note-length variation to an array of notes.
 *
 * For each note, generates a random variation factor scaled by `amount`,
 * then biases toward legato (longer) on downbeats and staccato (shorter)
 * on off-beats when `downbeatLegato` is enabled.
 *
 * @param notes - Input notes (not mutated)
 * @param params - Note-length variation parameters
 * @param rng - Optional PRNG for deterministic behavior
 * @returns New array of notes with duration variation applied
 *
 * @example
 * // Apply default note-length variation
 * const varied = applyNoteLengthVariation(notes);
 *
 * // Higher variation, no legato bias
 * const varied = applyNoteLengthVariation(notes, {
 *   amount: 0.6, downbeatLegato: false
 * });
 */
export function applyNoteLengthVariation(
  notes: NoteData[],
  params?: NoteLengthParams,
  rng?: () => number,
): NoteData[] {
  const {
    enabled = true,
    amount = 0.3,
    downbeatLegato = true,
  } = params ?? {};

  // Disabled: return shallow copies
  if (!enabled || notes.length === 0) {
    return notes.map(n => ({ ...n }));
  }

  return notes.map(note => {
    // (a) Classify beat position
    const beat = getBeatPosition(note.time);

    // (b) Generate random variation factor in [-1, +1]
    const raw = (rng?.() ?? Math.random()) * 2 - 1;

    // (c) Scale by amount * 0.15 (at amount=1.0, max variation is +-15%)
    let variationFactor = raw * amount * 0.15;

    // (d) Beat-position bias (downbeat legato / off-beat staccato)
    if (downbeatLegato) {
      if (beat.isDownbeat) {
        // Bias toward positive (longer / legato)
        variationFactor += amount * 0.05;
      } else if (beat.isOffbeat) {
        // Bias toward negative (shorter / staccato)
        variationFactor -= amount * 0.03;
      }
      // Backbeat: neutral, no bias applied
    }

    // (e) Cap variation at +-30% of original duration
    variationFactor = Math.max(-0.3, Math.min(0.3, variationFactor));

    // (f) Apply variation
    let newDuration = note.duration * (1 + variationFactor);

    // (g) Clamp to minimum 0.01 beats and round to 3 decimal places
    newDuration = Math.round(Math.max(0.01, newDuration) * 1000) / 1000;

    return { ...note, duration: newDuration };
  });
}
