/**
 * Instrument-aware velocity variation transform.
 *
 * Uses simplex noise for correlated velocity variation and instrument-specific
 * profiles to shape dynamics. Each instrument type has its own natural velocity
 * character: drums have wide dynamics with ghost notes and accents, piano
 * breathes with phrase-arc shaping, bass stays narrow and consistent.
 *
 * Beat-position awareness ensures downbeats are naturally emphasised and
 * off-beats are slightly softer, matching how real musicians play.
 */

import { createNoise2D } from 'simplex-noise';
import type { NoteData, VelocityParams } from '../types.js';
import { getBeatPosition, clampVelocity } from './util.js';

/**
 * Instrument-specific velocity profiles.
 *
 * Values are derived from production literature analysis (see 03-RESEARCH.md):
 * - drums: MIDI 30-50 ghost notes, 100-120 accents, wide dynamic range
 * - piano: MIDI 60-110, breathing phrasing arcs
 * - bass: MIDI 80-105, narrow consistent range
 * - synth: moderate defaults
 * - default: general-purpose middle ground
 */
export const VELOCITY_PROFILES = {
  drums: {
    baseVelocityRange: [0.3, 1.0] as [number, number],
    downbeatBoost: 0.08,
    ghostNoteThreshold: 0.4,
    ghostNoteRange: [0.24, 0.39] as [number, number],
    accentRange: [0.78, 0.94] as [number, number],
    variationAmount: 0.08,
  },
  piano: {
    baseVelocityRange: [0.47, 0.86] as [number, number],
    downbeatBoost: 0.04,
    variationAmount: 0.06,
    phraseShaping: true,
  },
  bass: {
    baseVelocityRange: [0.63, 0.82] as [number, number],
    downbeatBoost: 0.06,
    variationAmount: 0.03,
  },
  synth: {
    baseVelocityRange: [0.55, 0.86] as [number, number],
    downbeatBoost: 0.04,
    variationAmount: 0.05,
  },
  default: {
    baseVelocityRange: [0.5, 0.9] as [number, number],
    downbeatBoost: 0.04,
    variationAmount: 0.05,
  },
};

/**
 * Apply instrument-aware velocity variation to an array of notes.
 *
 * Uses 2D simplex noise for smooth, correlated velocity changes that avoid
 * the jittery feel of uniform random variation. Each instrument type applies
 * its own dynamic profile with beat-position emphasis.
 *
 * Special behaviors by instrument:
 * - **drums**: Ghost notes (below threshold clamped to ghost range),
 *   accents (above midpoint can reach accent range)
 * - **piano**: Phrase-arc breathing via slow sine wave modulation
 * - **bass**: Narrow, consistent velocity band
 *
 * @param notes - Input notes (not mutated)
 * @param params - Velocity variation parameters
 * @param rng - Optional PRNG for deterministic behavior (seeds simplex noise)
 * @returns New array of notes with velocity variation applied
 *
 * @example
 * // Apply drum velocity profile
 * const varied = applyVelocityVariation(notes, { instrument: 'drums' });
 *
 * // Seeded for reproducibility
 * const varied = applyVelocityVariation(notes, { amount: 0.7 }, seededRng);
 */
export function applyVelocityVariation(
  notes: NoteData[],
  params?: VelocityParams,
  rng?: () => number,
): NoteData[] {
  const {
    enabled = true,
    instrument = 'default',
    amount = 0.5,
    beatEmphasis = true,
  } = params ?? {};

  // Disabled: return shallow copies
  if (!enabled || notes.length === 0) {
    return notes.map(n => ({ ...n }));
  }

  // Look up the instrument profile
  const profile = VELOCITY_PROFILES[instrument] ?? VELOCITY_PROFILES.default;

  // Create simplex noise function (seeded if rng provided)
  const noise2D = createNoise2D(rng ?? Math.random);

  // Midpoint of the instrument's base velocity range
  const midpoint = (profile.baseVelocityRange[0] + profile.baseVelocityRange[1]) / 2;

  // Phrase length for piano phrase-arc shaping (in notes)
  const phraseLengthInNotes = 12;

  return notes.map((note, i) => {
    let velocity = note.velocity;

    // (a) Generate noise-based variation: smooth correlated changes
    const noiseVariation = noise2D(i * 0.15, 0) * profile.variationAmount * amount;
    velocity += noiseVariation;

    // (b) Beat-position emphasis (asymmetric: downbeats louder, off-beats softer)
    if (beatEmphasis) {
      const beat = getBeatPosition(note.time);
      if (beat.isDownbeat) {
        velocity += profile.downbeatBoost;
      } else if (beat.isOffbeat) {
        velocity -= profile.downbeatBoost * 0.5;
      }
      // Backbeat: no boost (neutral)
    }

    // (c) Drum-specific: ghost note and accent treatment
    if (instrument === 'drums') {
      const drumProfile = VELOCITY_PROFILES.drums;
      if (velocity < drumProfile.ghostNoteThreshold) {
        // Clamp into ghost note range
        velocity = drumProfile.ghostNoteRange[0] +
          (drumProfile.ghostNoteRange[1] - drumProfile.ghostNoteRange[0]) *
          Math.abs(noise2D(i * 0.3, 1));
      } else if (velocity > midpoint) {
        // Allow accents to reach accent range
        const accentBlend = (velocity - midpoint) / (1.0 - midpoint);
        const accentTarget = drumProfile.accentRange[0] +
          (drumProfile.accentRange[1] - drumProfile.accentRange[0]) * accentBlend;
        velocity = velocity + (accentTarget - velocity) * 0.5;
      }
    }

    // (d) Piano phrase-arc breathing: slow sine wave modulation
    if (instrument === 'piano' && 'phraseShaping' in profile && profile.phraseShaping) {
      velocity += Math.sin(i * Math.PI / phraseLengthInNotes) * 0.06;
    }

    // (e) Clamp final velocity
    velocity = clampVelocity(velocity);

    return { ...note, velocity };
  });
}
