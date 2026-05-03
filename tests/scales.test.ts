import { describe, it, expect } from 'vitest';
import { snapToScale, isInScale, getAvailableScales } from '../src/music/scales.ts';

describe('isInScale', () => {
  it('accepts in-key notes for C major', () => {
    expect(isInScale(60, 'C', 'major')).toBe(true); // C
    expect(isInScale(62, 'C', 'major')).toBe(true); // D
    expect(isInScale(64, 'C', 'major')).toBe(true); // E
    expect(isInScale(65, 'C', 'major')).toBe(true); // F
    expect(isInScale(67, 'C', 'major')).toBe(true); // G
    expect(isInScale(69, 'C', 'major')).toBe(true); // A
    expect(isInScale(71, 'C', 'major')).toBe(true); // B
  });

  it('rejects out-of-key notes for C major', () => {
    expect(isInScale(61, 'C', 'major')).toBe(false); // C#
    expect(isInScale(63, 'C', 'major')).toBe(false); // D#
    expect(isInScale(66, 'C', 'major')).toBe(false); // F#
    expect(isInScale(68, 'C', 'major')).toBe(false); // G#
    expect(isInScale(70, 'C', 'major')).toBe(false); // A#
  });

  it('handles non-C roots correctly (A minor)', () => {
    expect(isInScale(69, 'A', 'minor')).toBe(true); // A
    expect(isInScale(71, 'A', 'minor')).toBe(true); // B
    expect(isInScale(72, 'A', 'minor')).toBe(true); // C
    expect(isInScale(70, 'A', 'minor')).toBe(false); // A#
  });

  it('returns false for unknown scale names', () => {
    expect(isInScale(60, 'C', 'flarble')).toBe(false);
  });
});

describe('snapToScale', () => {
  it('returns the note unchanged if already in scale', () => {
    expect(snapToScale(60, 'C', 'major')).toBe(60);
    expect(snapToScale(67, 'C', 'major')).toBe(67);
  });

  it('snaps an out-of-scale note to the nearest scale tone', () => {
    // C# (61) is one semitone from both C (60) and D (62) — picks one of them.
    const snapped = snapToScale(61, 'C', 'major');
    expect([60, 62]).toContain(snapped);
  });

  it('snaps F# in C major to a neighboring scale tone', () => {
    const snapped = snapToScale(66, 'C', 'major');
    expect([65, 67]).toContain(snapped); // F or G
  });

  it('returns the note unchanged for unknown scales', () => {
    expect(snapToScale(60, 'C', 'flarble')).toBe(60);
  });
});

describe('getAvailableScales', () => {
  it('includes the standard western scales', () => {
    const scales = getAvailableScales();
    expect(scales).toContain('major');
    expect(scales).toContain('minor');
    expect(scales).toContain('dorian');
  });
});
