/**
 * Core music theory helpers using the tonal library.
 *
 * Provides note-to-MIDI conversion, scale note generation,
 * roman numeral chord resolution, and chord note extraction.
 * All music theory logic lives here on the MCP server side --
 * the FL Bridge only receives pre-computed MIDI note data.
 */

import { Note, Scale, Chord, Key } from 'tonal';

/**
 * Convert a note name to its MIDI number.
 * Wraps tonal's Note.midi() with null safety.
 *
 * @param noteName - Note name with octave (e.g., "C4", "F#3", "Bb5")
 * @returns MIDI note number (0-127) or null if invalid
 *
 * @example
 * noteToMidi("C4")  // 60
 * noteToMidi("A4")  // 69
 * noteToMidi("xyz") // null
 */
export function noteToMidi(noteName: string): number | null {
  return Note.midi(noteName);
}

/**
 * Convert a MIDI note number to its note name.
 * Wraps tonal's Note.fromMidi().
 *
 * @param midi - MIDI note number (0-127)
 * @returns Note name with octave (e.g., "C4")
 *
 * @example
 * midiToNoteName(60) // "C4"
 * midiToNoteName(69) // "A4"
 */
export function midiToNoteName(midi: number): string {
  return Note.fromMidi(midi);
}

/**
 * Get all MIDI note numbers in a scale across an octave range.
 *
 * @param root - Scale root note (e.g., "C", "F#", "Bb")
 * @param scaleName - Scale type (e.g., "major", "minor", "dorian")
 * @param octaveRange - [startOctave, endOctave] inclusive
 * @returns Sorted array of MIDI note numbers
 *
 * @example
 * getScaleMidiNotes("C", "major", [4, 5])
 * // Returns [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83]
 * // (C4, D4, E4, F4, G4, A4, B4, C5, D5, E5, F5, G5, A5, B5)
 */
export function getScaleMidiNotes(
  root: string,
  scaleName: string,
  octaveRange: [number, number]
): number[] {
  const scale = Scale.get(`${root} ${scaleName}`);
  if (scale.empty) {
    return [];
  }

  const midiNotes: number[] = [];

  for (let octave = octaveRange[0]; octave <= octaveRange[1]; octave++) {
    for (const noteName of scale.notes) {
      const midi = Note.midi(`${noteName}${octave}`);
      if (midi !== null) {
        midiNotes.push(midi);
      }
    }
  }

  return midiNotes.sort((a, b) => a - b);
}

/**
 * Map a roman numeral to a chord name in a given key.
 *
 * Supports standard roman numeral notation:
 * - Uppercase (I, IV, V) = major chords
 * - Lowercase (ii, iii, vi) = minor chords
 * - "dim" suffix (viidim) = diminished chords
 * - "7" suffix (V7) = seventh chords
 *
 * Uses tonal's Key module for accurate chord mapping.
 *
 * @param key - Key root (e.g., "C", "G", "F#")
 * @param scaleName - Scale type ("major" or "minor")
 * @param numeral - Roman numeral (e.g., "I", "V", "vi", "IV", "viidim")
 * @returns Chord name (e.g., "C", "G", "Am", "F", "Bdim")
 *
 * @example
 * romanNumeralToChord("C", "major", "I")   // "C"
 * romanNumeralToChord("C", "major", "V")   // "G"
 * romanNumeralToChord("C", "major", "vi")  // "Am"
 * romanNumeralToChord("C", "major", "IV")  // "F"
 * romanNumeralToChord("A", "minor", "III") // "C"
 */
export function romanNumeralToChord(
  key: string,
  scaleName: string,
  numeral: string
): string {
  // Parse the numeral: separate the degree from any suffix (7, dim, etc.)
  const match = numeral.match(/^(b?#?)(i{1,3}v?|iv|v?i{0,3})(dim|aug|7|maj7|m7b5)?$/i);
  if (!match) {
    // Fallback: return key + numeral as-is (best effort)
    return `${key}${numeral}`;
  }

  const accidental = match[1] || '';
  const degree = match[2];
  const suffix = match[3] || '';
  const isUpperCase = degree === degree.toUpperCase();

  // Map roman numeral to degree index (0-based)
  const numeralMap: Record<string, number> = {
    'i': 0, 'ii': 1, 'iii': 2, 'iv': 3, 'v': 4, 'vi': 5, 'vii': 6,
  };
  const degreeIndex = numeralMap[degree.toLowerCase()];
  if (degreeIndex === undefined) {
    return `${key}${numeral}`;
  }

  // Get triads from tonal's Key module
  let triads: readonly string[];
  if (scaleName === 'minor' || scaleName === 'natural minor' || scaleName === 'aeolian') {
    const minorKey = Key.minorKey(key);
    triads = minorKey.natural.triads;
  } else {
    const majorKey = Key.majorKey(key);
    triads = majorKey.triads;
  }

  if (degreeIndex >= triads.length) {
    return `${key}${numeral}`;
  }

  let chordName = triads[degreeIndex];

  // Handle accidentals (e.g., bVII, #IV)
  if (accidental) {
    // For borrowed chords with accidentals, transpose the root
    const chordData = Chord.get(chordName);
    if (!chordData.empty && chordData.tonic) {
      const semitones = accidental === 'b' ? -1 : accidental === '#' ? 1 : 0;
      const transposedRoot = Note.transpose(chordData.tonic, semitones > 0 ? '2m' : '-2m');
      // Rebuild chord name with transposed root
      const quality = chordName.replace(chordData.tonic, '');
      chordName = `${transposedRoot}${quality}`;
    }
  }

  // Handle suffix overrides
  if (suffix === '7') {
    // Get seventh chords from Key module
    let seventhChords: readonly string[];
    if (scaleName === 'minor' || scaleName === 'natural minor' || scaleName === 'aeolian') {
      seventhChords = Key.minorKey(key).natural.chords;
    } else {
      seventhChords = Key.majorKey(key).chords;
    }
    if (degreeIndex < seventhChords.length) {
      chordName = seventhChords[degreeIndex];
    }
  } else if (suffix === 'dim') {
    // Force diminished quality
    const chordData = Chord.get(chordName);
    if (!chordData.empty && chordData.tonic) {
      chordName = `${chordData.tonic}dim`;
    }
  } else if (suffix === 'aug') {
    const chordData = Chord.get(chordName);
    if (!chordData.empty && chordData.tonic) {
      chordName = `${chordData.tonic}aug`;
    }
  }

  // If the case doesn't match the triad quality, override
  // (e.g., user writes "i" in major key to force minor)
  if (!suffix) {
    const chordData = Chord.get(chordName);
    if (!chordData.empty && chordData.tonic) {
      if (isUpperCase && chordData.quality === 'Minor') {
        // Uppercase = force major
        chordName = chordData.tonic;
      } else if (!isUpperCase && chordData.quality === 'Major') {
        // Lowercase = force minor
        chordName = `${chordData.tonic}m`;
      }
    }
  }

  return chordName;
}

/**
 * Get MIDI note numbers for a chord at a given octave.
 *
 * Returns notes in ascending order. If any note would be lower than the root
 * (due to voicing), it is bumped up an octave to maintain proper voicing.
 *
 * @param chordName - Chord name (e.g., "C", "Am", "G7", "Bdim")
 * @param octave - Base octave for the chord root
 * @returns Array of MIDI note numbers, sorted ascending
 *
 * @example
 * getChordNotes("C", 4)    // [60, 64, 67] (C4, E4, G4)
 * getChordNotes("Am", 4)   // [69, 72, 76] (A4, C5, E5)
 * getChordNotes("G7", 3)   // [43, 47, 50, 53] (G3, B3, D4, F4)
 */
export function getChordNotes(chordName: string, octave: number): number[] {
  const chord = Chord.get(chordName);
  if (chord.empty || !chord.tonic) {
    return [];
  }

  const midiNotes: number[] = [];
  const rootMidi = Note.midi(`${chord.tonic}${octave}`);
  if (rootMidi === null) {
    return [];
  }

  for (const noteName of chord.notes) {
    let midi = Note.midi(`${noteName}${octave}`);
    if (midi === null) continue;

    // If this note is below the root, bump it up an octave
    // This ensures proper chord voicing (all notes above root)
    if (midi < rootMidi) {
      midi += 12;
    }

    midiNotes.push(midi);
  }

  return midiNotes.sort((a, b) => a - b);
}
