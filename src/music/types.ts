/**
 * Music generation types for FL Studio MCP
 *
 * Defines the core data structures for note generation, chord progressions,
 * melody generation, and bass line generation. NoteData is the universal
 * format sent to FL Bridge for piano roll note creation.
 */

/**
 * A single note to be placed in the piano roll.
 * Uses beats (quarter notes) for time/duration, 0-1 floats for velocity.
 * Matches the JSON format consumed by the FL Bridge pianoroll handler.
 */
export interface NoteData {
  /** MIDI note number (0-127, where 60 = C4 / middle C) */
  midi: number;
  /** Start time in beats (quarter notes), 0-based */
  time: number;
  /** Duration in beats (quarter notes) */
  duration: number;
  /** Velocity as 0-1 float (0 = silent, 1 = max) */
  velocity: number;
  /** Panning as 0-1 float (0 = left, 0.5 = center, 1 = right) */
  pan?: number;
  /** FL Studio note color (0-15) */
  color?: number;
}

/**
 * Parameters for generating a chord progression.
 */
export interface ChordProgressionParams {
  /** Musical key root (e.g., "C", "F#", "Bb") */
  key: string;
  /** Scale type (default: "major") */
  scale?: string;
  /** Roman numeral progression (e.g., ["I", "V", "vi", "IV"]) */
  progression: string[];
  /** Base octave for chord voicing (default: 4) */
  octave?: number;
  /** Duration of each chord in beats (default: 4) */
  beatsPerChord?: number;
  /** Base velocity for chord notes (default: 0.78) */
  velocity?: number;
}

/**
 * Parameters for generating a melody.
 */
export interface MelodyParams {
  /** Musical key root (e.g., "C", "A", "Eb") */
  key: string;
  /** Scale type (default: "major") */
  scale?: string;
  /** Base octave for melody (default: 4) */
  octave?: number;
  /** Number of bars to generate (default: 4) */
  bars?: number;
  /** Note density: sparse=2-3/bar, medium=4-6/bar, dense=6-8/bar (default: "medium") */
  noteDensity?: 'sparse' | 'medium' | 'dense';
  /** Directional bias for melody contour (default: "mixed") */
  direction?: 'ascending' | 'descending' | 'mixed';
  /** Base velocity for melody notes (default: 0.75) */
  velocity?: number;
}

/**
 * Parameters for generating a bass line.
 */
export interface BassLineParams {
  /** Musical key root (e.g., "C", "A", "Eb") */
  key: string;
  /** Scale type (default: "major") */
  scale?: string;
  /** Roman numeral chord progression to follow */
  chordProgression: string[];
  /** Bass octave (default: 2) */
  octave?: number;
  /** Duration of each chord in beats (default: 4) */
  beatsPerChord?: number;
  /** Bass line rhythmic style (default: "whole") */
  style?: 'whole' | 'half' | 'walking' | 'eighth';
  /** Base velocity for bass notes (default: 0.82) */
  velocity?: number;
}

/**
 * Request payload sent to FL Bridge for adding notes to the piano roll.
 * This is the JSON structure the FL Bridge pianoroll handler expects.
 */
export interface AddNotesRequest {
  /** Array of notes to add */
  notes: NoteData[];
  /** Target channel index (optional) */
  channel?: number;
  /** Whether to clear existing notes before adding (optional) */
  clearFirst?: boolean;
}
