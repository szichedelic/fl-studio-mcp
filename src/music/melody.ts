/**
 * Melody and bass line generation algorithms.
 *
 * Generates musically sensible note sequences locked to a given scale.
 * Melody uses weighted random walk with density and direction controls.
 * Bass line follows chord roots with configurable rhythmic patterns.
 *
 * These are v1 algorithms -- simple but musically valid. More sophisticated
 * generation (motifs, phrasing, voice leading) planned for Phase 9.
 */

import type { NoteData, MelodyParams, BassLineParams } from './types.js';
import { getScaleMidiNotes, romanNumeralToChord, getChordNotes } from './theory.js';
import { snapToScale } from './scales.js';

/**
 * Density configuration: notes per bar for each density level.
 */
const DENSITY_RANGES: Record<string, [number, number]> = {
  sparse: [2, 3],
  medium: [4, 6],
  dense: [6, 8],
};

/**
 * Duration options in beats, weighted by density.
 * Sparse favors longer notes, dense favors shorter.
 */
const DURATION_WEIGHTS: Record<string, Array<{ duration: number; weight: number }>> = {
  sparse: [
    { duration: 2, weight: 0.4 },    // half note
    { duration: 1, weight: 0.4 },    // quarter note
    { duration: 0.5, weight: 0.2 },  // eighth note
  ],
  medium: [
    { duration: 2, weight: 0.15 },
    { duration: 1, weight: 0.5 },
    { duration: 0.5, weight: 0.35 },
  ],
  dense: [
    { duration: 1, weight: 0.15 },
    { duration: 0.5, weight: 0.5 },
    { duration: 0.25, weight: 0.35 }, // sixteenth note
  ],
};

/**
 * Pick a random integer between min and max (inclusive).
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a duration based on weighted probabilities for the given density.
 */
function pickDuration(density: string): number {
  const weights = DURATION_WEIGHTS[density] || DURATION_WEIGHTS['medium'];
  const rand = Math.random();
  let cumulative = 0;

  for (const entry of weights) {
    cumulative += entry.weight;
    if (rand < cumulative) {
      return entry.duration;
    }
  }

  return weights[weights.length - 1].duration;
}

/**
 * Generate a melody as NoteData.
 *
 * Creates a scale-locked melody using a weighted random walk algorithm:
 * - 70% of moves are step-wise (adjacent scale notes)
 * - 30% are leaps (2-4 scale degrees)
 * - Direction bias controls ascending/descending tendency
 * - Density controls notes per bar and duration distribution
 *
 * @param params - Melody generation parameters
 * @returns Array of NoteData representing the melody
 *
 * @example
 * const melody = generateMelody({
 *   key: "A",
 *   scale: "minor",
 *   octave: 4,
 *   bars: 4,
 *   noteDensity: "medium",
 *   direction: "mixed",
 *   velocity: 0.75,
 * });
 */
export function generateMelody(params: MelodyParams): NoteData[] {
  const {
    key,
    scale = 'major',
    octave = 4,
    bars = 4,
    noteDensity = 'medium',
    direction = 'mixed',
    velocity = 0.75,
  } = params;

  // Get all scale notes across the melody range (octave and octave+1)
  const scaleNotes = getScaleMidiNotes(key, scale, [octave, octave + 1]);
  if (scaleNotes.length === 0) {
    return [];
  }

  const notes: NoteData[] = [];
  const beatsPerBar = 4;
  const densityRange = DENSITY_RANGES[noteDensity] || DENSITY_RANGES['medium'];

  // Start in the middle of the scale range
  let currentIndex = Math.floor(scaleNotes.length / 2);
  let globalBeat = 0;

  for (let bar = 0; bar < bars; bar++) {
    const notesInBar = randomInt(densityRange[0], densityRange[1]);
    let barBeat = 0;

    for (let n = 0; n < notesInBar; n++) {
      // Determine if remaining time in bar allows another note
      const remainingBeats = beatsPerBar - barBeat;
      if (remainingBeats <= 0) break;

      // Pick duration (capped to remaining bar time)
      let duration = pickDuration(noteDensity);
      duration = Math.min(duration, remainingBeats);

      // Move to next note using weighted random walk
      const isStep = Math.random() < 0.7;
      let stepSize: number;

      if (isStep) {
        stepSize = 1; // Adjacent scale note
      } else {
        stepSize = randomInt(2, 4); // Leap: 2-4 scale degrees
      }

      // Apply direction bias
      let moveUp: boolean;
      if (direction === 'ascending') {
        moveUp = Math.random() < 0.75; // 75% up
      } else if (direction === 'descending') {
        moveUp = Math.random() < 0.25; // 25% up = 75% down
      } else {
        moveUp = Math.random() < 0.5; // 50/50
      }

      // Calculate new index with bounds checking
      let newIndex = moveUp
        ? currentIndex + stepSize
        : currentIndex - stepSize;

      // Clamp to scale range, with bounce-back at extremes
      if (newIndex >= scaleNotes.length) {
        newIndex = scaleNotes.length - 1 - (newIndex - scaleNotes.length + 1);
        newIndex = Math.max(0, newIndex);
      } else if (newIndex < 0) {
        newIndex = Math.abs(newIndex);
        newIndex = Math.min(scaleNotes.length - 1, newIndex);
      }

      currentIndex = newIndex;
      const midi = scaleNotes[currentIndex];

      // Safety net: snap to scale (should already be in scale, but just in case)
      const snappedMidi = snapToScale(midi, key, scale);

      // Velocity with slight random variation (+-0.05)
      const velocityVariation = (Math.random() - 0.5) * 0.1;
      const noteVelocity = Math.max(0, Math.min(1, velocity + velocityVariation));

      notes.push({
        midi: snappedMidi,
        time: Math.round((globalBeat + barBeat) * 1000) / 1000,
        duration: Math.round(duration * 1000) / 1000,
        velocity: Math.round(noteVelocity * 1000) / 1000,
      });

      barBeat += duration;
    }

    globalBeat += beatsPerBar;
  }

  return notes;
}

/**
 * Generate a bass line as NoteData.
 *
 * Creates a bass line that follows chord roots with configurable rhythm:
 * - "whole": one note per chord (sustained root)
 * - "half": two notes per chord (root + fifth)
 * - "walking": one note per beat (root, third, fifth, approach note)
 * - "eighth": eighth notes alternating root and fifth
 *
 * All notes are at the bass octave (default 2) and snapped to scale.
 *
 * @param params - Bass line generation parameters
 * @returns Array of NoteData representing the bass line
 *
 * @example
 * const bass = generateBassLine({
 *   key: "C",
 *   scale: "major",
 *   chordProgression: ["I", "V", "vi", "IV"],
 *   octave: 2,
 *   beatsPerChord: 4,
 *   style: "walking",
 *   velocity: 0.82,
 * });
 */
export function generateBassLine(params: BassLineParams): NoteData[] {
  const {
    key,
    scale = 'major',
    chordProgression,
    octave = 2,
    beatsPerChord = 4,
    style = 'whole',
    velocity = 0.82,
  } = params;

  const notes: NoteData[] = [];
  let currentBeat = 0;

  for (let chordIdx = 0; chordIdx < chordProgression.length; chordIdx++) {
    const numeral = chordProgression[chordIdx];

    // Resolve chord and get its notes at the bass octave
    const chordName = romanNumeralToChord(key, scale, numeral);
    const chordMidi = getChordNotes(chordName, octave);

    if (chordMidi.length === 0) {
      currentBeat += beatsPerChord;
      continue;
    }

    // Extract chord tones
    const root = chordMidi[0];
    const third = chordMidi.length > 1 ? chordMidi[1] : root;
    const fifth = chordMidi.length > 2 ? chordMidi[2] : third;

    // Find approach note to next chord's root (for walking bass)
    let approachNote = root; // default: return to root
    if (style === 'walking' && chordIdx < chordProgression.length - 1) {
      const nextChordName = romanNumeralToChord(key, scale, chordProgression[chordIdx + 1]);
      const nextChordMidi = getChordNotes(nextChordName, octave);
      if (nextChordMidi.length > 0) {
        const nextRoot = nextChordMidi[0];
        // Approach from one scale step below or above the next root
        approachNote = nextRoot > root
          ? snapToScale(nextRoot - 1, key, scale)
          : snapToScale(nextRoot + 1, key, scale);
      }
    }

    // Slight velocity variation helper
    const varyVelocity = (): number => {
      const variation = (Math.random() - 0.5) * 0.06;
      return Math.round(Math.max(0, Math.min(1, velocity + variation)) * 1000) / 1000;
    };

    switch (style) {
      case 'whole':
        // One sustained root note per chord
        notes.push({
          midi: root,
          time: currentBeat,
          duration: beatsPerChord,
          velocity: varyVelocity(),
        });
        break;

      case 'half': {
        // Two notes: root then fifth
        const halfDuration = beatsPerChord / 2;
        notes.push({
          midi: root,
          time: currentBeat,
          duration: halfDuration,
          velocity: varyVelocity(),
        });
        notes.push({
          midi: fifth,
          time: currentBeat + halfDuration,
          duration: halfDuration,
          velocity: varyVelocity(),
        });
        break;
      }

      case 'walking': {
        // One note per beat: root, third, fifth, approach
        const walkNotes = [root, third, fifth, approachNote];
        const notesPerChord = Math.min(beatsPerChord, walkNotes.length);
        const beatDuration = beatsPerChord / notesPerChord;

        for (let i = 0; i < notesPerChord; i++) {
          const noteIdx = i % walkNotes.length;
          notes.push({
            midi: snapToScale(walkNotes[noteIdx], key, scale),
            time: Math.round((currentBeat + i * beatDuration) * 1000) / 1000,
            duration: Math.round(beatDuration * 1000) / 1000,
            velocity: varyVelocity(),
          });
        }
        break;
      }

      case 'eighth': {
        // Eighth notes alternating root and fifth (or root and octave)
        const eighthDuration = 0.5;
        const eighthCount = Math.floor(beatsPerChord / eighthDuration);
        const octaveUp = root + 12 <= 127 ? root + 12 : root;

        for (let i = 0; i < eighthCount; i++) {
          const midi = i % 2 === 0 ? root : fifth;
          notes.push({
            midi,
            time: Math.round((currentBeat + i * eighthDuration) * 1000) / 1000,
            duration: eighthDuration,
            velocity: varyVelocity(),
          });
        }
        break;
      }
    }

    currentBeat += beatsPerChord;
  }

  return notes;
}
