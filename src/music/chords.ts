/**
 * Chord progression generation.
 *
 * Converts roman numeral chord progressions (e.g., I-V-vi-IV)
 * into concrete NoteData arrays with proper voicing and timing.
 * All music theory resolution uses the theory module.
 */

import type { NoteData, ChordProgressionParams } from './types.js';
import { romanNumeralToChord, getChordNotes } from './theory.js';

/**
 * Generate a chord progression as NoteData.
 *
 * Takes roman numeral notation and produces correctly voiced chords
 * with timing. Each chord occupies `beatsPerChord` beats. Notes within
 * a chord have slight velocity variation for natural feel.
 *
 * @param params - Chord progression parameters
 * @returns Array of NoteData representing the full progression
 *
 * @example
 * const notes = generateChordProgression({
 *   key: "C",
 *   scale: "major",
 *   progression: ["I", "V", "vi", "IV"],
 *   octave: 4,
 *   beatsPerChord: 4,
 *   velocity: 0.78,
 * });
 * // Returns NoteData[] for C major, G major, A minor, F major chords
 * // spanning 16 beats total
 */
export function generateChordProgression(params: ChordProgressionParams): NoteData[] {
  const {
    key,
    scale = 'major',
    progression,
    octave = 4,
    beatsPerChord = 4,
    velocity = 0.78,
  } = params;

  const notes: NoteData[] = [];
  let currentBeat = 0;

  for (const numeral of progression) {
    // Resolve roman numeral to chord name (e.g., "vi" in C major -> "Am")
    const chordName = romanNumeralToChord(key, scale, numeral);

    // Get MIDI note numbers for the chord voicing
    const chordMidi = getChordNotes(chordName, octave);

    // Create a NoteData for each note in the chord
    for (const midi of chordMidi) {
      // Slight velocity variation per note for natural feel (+-0.03)
      const velocityVariation = (Math.random() - 0.5) * 0.06;
      const noteVelocity = Math.max(0, Math.min(1, velocity + velocityVariation));

      notes.push({
        midi,
        time: currentBeat,
        duration: beatsPerChord,
        velocity: Math.round(noteVelocity * 1000) / 1000, // 3 decimal places
      });
    }

    currentBeat += beatsPerChord;
  }

  return notes;
}
