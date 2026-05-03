import { describe, it, expect } from 'vitest';
import { applyTimingDrift, calculateContextSigmas } from '../src/music/humanize/timing.ts';
import { applySwing } from '../src/music/humanize/swing.ts';
import { createSeededRng, getBeatPosition, clampVelocity, clampTime } from '../src/music/humanize/util.ts';
import type { NoteData } from '../src/music/types.ts';

const note = (time: number, midi = 60, vel = 0.7, dur = 0.25): NoteData => ({
  time,
  midi,
  velocity: vel,
  duration: dur,
});

describe('clampVelocity / clampTime', () => {
  it('clamps and rounds velocity to [0,1] with 3 decimals', () => {
    expect(clampVelocity(-0.4)).toBe(0);
    expect(clampVelocity(1.5)).toBe(1);
    expect(clampVelocity(0.123456)).toBe(0.123);
  });

  it('clamps and rounds time to >= 0 with 3 decimals', () => {
    expect(clampTime(-1)).toBe(0);
    expect(clampTime(2.000499)).toBe(2);
    expect(clampTime(2.0005)).toBe(2.001);
  });
});

describe('createSeededRng', () => {
  it('produces a deterministic sequence for the same seed', () => {
    const a = createSeededRng('hello');
    const b = createSeededRng('hello');
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRng('hello');
    const b = createSeededRng('world');
    expect(a()).not.toBe(b());
  });
});

describe('getBeatPosition', () => {
  it('classifies beat 0 as a downbeat', () => {
    const p = getBeatPosition(0);
    expect(p.isDownbeat).toBe(true);
    expect(p.isBackbeat).toBe(false);
    expect(p.isOffbeat).toBe(false);
  });

  it('classifies beat 1 as a backbeat', () => {
    const p = getBeatPosition(1);
    expect(p.isBackbeat).toBe(true);
    expect(p.isDownbeat).toBe(false);
  });

  it('classifies beat 2 as a downbeat in 4/4', () => {
    expect(getBeatPosition(2).isDownbeat).toBe(true);
  });

  it('classifies the "and" of 1 (0.5) as offbeat', () => {
    const p = getBeatPosition(0.5);
    expect(p.isOffbeat).toBe(true);
    expect(p.isDownbeat).toBe(false);
  });

  it('handles bar wrap-around', () => {
    expect(getBeatPosition(4).isDownbeat).toBe(true);
    expect(getBeatPosition(5).isBackbeat).toBe(true);
  });
});

describe('applyTimingDrift', () => {
  it('returns input unchanged when disabled', () => {
    const notes = [note(0), note(1), note(2)];
    const out = applyTimingDrift(notes, { enabled: false });
    expect(out.map((n) => n.time)).toEqual([0, 1, 2]);
  });

  it('does not mutate the input array or its notes', () => {
    const notes = [note(0), note(1)];
    const beforeTimes = notes.map((n) => n.time);
    applyTimingDrift(notes, undefined, createSeededRng('t1'));
    expect(notes.map((n) => n.time)).toEqual(beforeTimes);
  });

  it('produces deterministic output for the same seed', () => {
    const notes = [note(0), note(0.5), note(1), note(1.5)];
    const a = applyTimingDrift(notes, undefined, createSeededRng('seed'));
    const b = applyTimingDrift(notes, undefined, createSeededRng('seed'));
    expect(a.map((n) => n.time)).toEqual(b.map((n) => n.time));
  });

  it('preserves the original index order even when notes are out-of-order in time', () => {
    const notes = [note(2), note(0), note(1)];
    const out = applyTimingDrift(notes, undefined, createSeededRng('order'));
    // note 0 had time=2 originally, note 1 had time=0, note 2 had time=1.
    // Drift is small (sigma=0.008), so the relative ordering of originals should hold.
    expect(out[0].time).toBeGreaterThan(out[1].time);
    expect(out[2].time).toBeGreaterThan(out[1].time);
    expect(out[0].time).toBeGreaterThan(out[2].time);
  });

  it('keeps drift small enough that notes stay near the grid', () => {
    const notes = Array.from({ length: 32 }, (_, i) => note(i * 0.5));
    const out = applyTimingDrift(notes, { sigma: 0.008 }, createSeededRng('check'));
    for (let i = 0; i < notes.length; i++) {
      expect(Math.abs(out[i].time - notes[i].time)).toBeLessThan(0.1);
    }
  });
});

describe('calculateContextSigmas', () => {
  it('loosens sigma for sparse passages', () => {
    const sparse = [note(0), note(8)];
    const sigmas = calculateContextSigmas(sparse, 0.01);
    expect(sigmas[0]).toBeGreaterThan(0.01);
  });

  it('tightens sigma for dense passages', () => {
    const dense = Array.from({ length: 16 }, (_, i) => note(i * 0.25));
    const sigmas = calculateContextSigmas(dense, 0.01);
    // Center notes should be in the densest window — tightened.
    expect(sigmas[8]).toBeLessThan(0.01);
  });
});

describe('applySwing', () => {
  it('returns input unchanged when amount <= 50 (straight)', () => {
    const notes = [note(0), note(0.25), note(0.5), note(0.75)];
    const out = applySwing(notes, { amount: 50 });
    expect(out.map((n) => n.time)).toEqual([0, 0.25, 0.5, 0.75]);
  });

  it('does not delay on-beat notes', () => {
    const notes = [note(0), note(0.5), note(1)];
    const out = applySwing(notes, { amount: 66, gridSize: 0.25 });
    // Notes at 0, 0.5, 1.0 are all on the front of a swung pair (pairSize=0.5).
    expect(out.map((n) => n.time)).toEqual([0, 0.5, 1]);
  });

  it('delays off-beat (16th-note "and") subdivisions', () => {
    const notes = [note(0.25), note(0.75)];
    const out = applySwing(notes, { amount: 66, gridSize: 0.25 });
    // Both notes fall on the off-beat half of their pair, so both shift later.
    expect(out[0].time).toBeGreaterThan(0.25);
    expect(out[1].time).toBeGreaterThan(0.75);
    // Equal delay for both.
    expect(out[0].time - 0.25).toBeCloseTo(out[1].time - 0.75, 6);
  });

  it('amount=75 produces maximum swing (delay = gridSize)', () => {
    const notes = [note(0.25)];
    const out = applySwing(notes, { amount: 75, gridSize: 0.25 });
    expect(out[0].time).toBeCloseTo(0.5, 6);
  });

  it('does not mutate the input notes', () => {
    const notes = [note(0.25), note(0.75)];
    const before = notes.map((n) => n.time);
    applySwing(notes, { amount: 66, gridSize: 0.25 });
    expect(notes.map((n) => n.time)).toEqual(before);
  });
});
