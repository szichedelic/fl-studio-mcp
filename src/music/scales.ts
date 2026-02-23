/**
 * Scale locking and scale utility functions.
 *
 * Provides tools to constrain notes to a scale (snap-to-scale),
 * check scale membership, and list available scales from tonal.
 * Used by melody and bass line generators to ensure all output
 * stays in-key.
 */

import { Note, Scale } from 'tonal';

/**
 * Snap a MIDI note to the nearest note in the given scale.
 *
 * Finds the closest scale tone by comparing pitch classes (chroma),
 * then returns the MIDI note at the same octave region. This is used
 * as a safety net in melody/bass generators to prevent out-of-key notes.
 *
 * @param midiNote - MIDI note number to snap (0-127)
 * @param root - Scale root note (e.g., "C", "A", "F#")
 * @param scaleName - Scale type (e.g., "major", "minor", "dorian")
 * @returns Nearest MIDI note number that is in the scale
 *
 * @example
 * snapToScale(61, "C", "major") // 60 (C#4 snaps down to C4)
 * snapToScale(66, "C", "major") // 67 (F#4 snaps up to G4)
 */
export function snapToScale(
  midiNote: number,
  root: string,
  scaleName: string
): number {
  const scale = Scale.get(`${root} ${scaleName}`);
  if (scale.empty) {
    return midiNote; // Return as-is if scale not found
  }

  // Build set of scale pitch classes (chroma values 0-11)
  const scaleChromaSet = new Set<number>();
  for (const noteName of scale.notes) {
    const chroma = Note.chroma(noteName);
    if (chroma !== undefined) {
      scaleChromaSet.add(chroma);
    }
  }

  const noteChroma = midiNote % 12;

  // If already in scale, return as-is
  if (scaleChromaSet.has(noteChroma)) {
    return midiNote;
  }

  // Search outward from the note for the nearest scale tone
  for (let offset = 1; offset <= 6; offset++) {
    const below = midiNote - offset;
    const above = midiNote + offset;

    if (below >= 0 && scaleChromaSet.has(below % 12)) {
      return below;
    }
    if (above <= 127 && scaleChromaSet.has(above % 12)) {
      return above;
    }
  }

  // Fallback (should not happen with valid scale)
  return midiNote;
}

/**
 * Check if a MIDI note belongs to the given scale.
 *
 * Compares the note's pitch class (chroma) against the scale's chroma bitfield.
 * Tonal's chroma string is 12 characters where index 0 = C, 1 = C#, etc.
 *
 * @param midiNote - MIDI note number to check (0-127)
 * @param root - Scale root note (e.g., "C", "A", "F#")
 * @param scaleName - Scale type (e.g., "major", "minor", "dorian")
 * @returns true if the note is in the scale
 *
 * @example
 * isInScale(60, "C", "major") // true  (C is in C major)
 * isInScale(61, "C", "major") // false (C# is not in C major)
 * isInScale(62, "C", "major") // true  (D is in C major)
 */
export function isInScale(
  midiNote: number,
  root: string,
  scaleName: string
): boolean {
  const scale = Scale.get(`${root} ${scaleName}`);
  if (scale.empty) {
    return false;
  }

  const noteChroma = midiNote % 12;
  // Tonal chroma string: index 0 = C, 1 = C#, 2 = D, ... 11 = B
  return scale.chroma[noteChroma] === '1';
}

/**
 * Get the list of all scale names supported by tonal.
 *
 * @returns Array of scale name strings (e.g., ["major", "minor", "dorian", ...])
 *
 * @example
 * getAvailableScales() // ["major pentatonic", "major", "minor", ...]
 */
export function getAvailableScales(): string[] {
  return Scale.names();
}

/**
 * Get human-readable information about a scale.
 *
 * @param root - Scale root note (e.g., "C", "A", "F#")
 * @param scaleName - Scale type (e.g., "major", "minor", "dorian")
 * @returns Object with notes, intervals, and chroma bitfield
 *
 * @example
 * getScaleInfo("C", "major")
 * // { notes: ["C","D","E","F","G","A","B"], intervals: ["1P","2M",...], chroma: "101011010101" }
 */
export function getScaleInfo(
  root: string,
  scaleName: string
): { notes: string[]; intervals: string[]; chroma: string } {
  const scale = Scale.get(`${root} ${scaleName}`);
  if (scale.empty) {
    return { notes: [], intervals: [], chroma: '' };
  }

  return {
    notes: scale.notes,
    intervals: scale.intervals,
    chroma: scale.chroma,
  };
}
