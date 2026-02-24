# Phase 3: Humanization Engine - Research

**Researched:** 2026-02-23
**Domain:** MIDI humanization algorithms, noise-based timing drift, velocity dynamics, swing/groove
**Confidence:** HIGH

## Summary

The humanization engine transforms mechanically perfect NoteData[] into organic-sounding performances through four interconnected systems: timing drift (Brownian walk), velocity variation (instrument-aware profiles), swing/groove (MPC-style off-beat shifting), and note-length variation (beat-position-aware legato/staccato). The critical insight from both music production literature and algorithmic research is that **uniform random humanization sounds worse than quantized** -- the drift must be correlated (each note's deviation relates to the previous note's deviation) using a mean-reverting random walk, not independent random samples.

The standard approach uses the Ornstein-Uhlenbeck process (a spring-constant mean-reverting Brownian walk) for timing drift, simplex noise or correlated noise for velocity variation, and a ratio-based formula (Roger Linn's MPC swing) for groove. All humanization is pure TypeScript transformation on NoteData[] with zero FL Studio API dependency, matching the existing architecture where the MCP server does all computation and the FL Bridge only receives pre-computed note data.

**Primary recommendation:** Implement humanization as a pipeline of composable transforms (swing -> timing drift -> velocity -> note length), each operating on NoteData[] and returning NoteData[], with named presets that bundle parameter configurations. Use `simplex-noise` v4.0.3 for correlated noise and a hand-rolled Box-Muller Gaussian for the Ornstein-Uhlenbeck process (no extra dependency needed).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| simplex-noise | 4.0.3 | Correlated noise generation for organic timing/velocity variation | TypeScript-native, zero deps, ~2KB gzipped, 72.9M ops/sec, tree-shakeable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| alea | 1.0.1 | Seeded PRNG for reproducible humanization | When user wants same humanization result from same seed (deterministic mode) |

### What NOT to Install
| Library | Why Not |
|---------|---------|
| gaussian-rng | Box-Muller is ~6 lines of code, no dependency needed |
| seedrandom | alea is smaller and directly compatible with simplex-noise |
| Any ML/AI humanization library | Overkill for this scope; algorithmic approach is sufficient |

**Installation:**
```bash
npm install simplex-noise alea
```

**Note:** `alea` is optional. If deterministic/seeded humanization is not required in v1, it can be deferred. simplex-noise works with Math.random() by default. However, seeded noise is strongly recommended so users can get reproducible results.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── music/
│   ├── types.ts              # Add HumanizationParams, InstrumentProfile types
│   ├── humanize/
│   │   ├── index.ts           # Main humanize() function, pipeline orchestration
│   │   ├── timing.ts          # Brownian walk timing drift (Ornstein-Uhlenbeck)
│   │   ├── velocity.ts        # Instrument-aware velocity variation
│   │   ├── swing.ts           # MPC-style swing/groove
│   │   ├── note-length.ts     # Beat-position legato/staccato variation
│   │   ├── presets.ts         # Named preset configurations
│   │   └── util.ts            # Gaussian RNG (Box-Muller), noise helpers
│   └── ...existing files...
├── tools/
│   ├── notes.ts               # Modify to accept optional humanize param
│   └── humanize.ts            # New MCP tool: humanize_notes
└── ...
```

### Pattern 1: Transform Pipeline
**What:** Each humanization aspect is an independent function `(notes: NoteData[], params) => NoteData[]`. The main `humanize()` function composes them in a fixed order.
**When to use:** Always. This is the core architecture.
**Why this order:** Swing must be applied first because it defines the new "grid" positions. Then Brownian drift adds organic variation around those swung positions. Velocity and note-length are independent of timing and can be applied in any order after.

```typescript
// Pipeline order is critical: swing -> timing -> velocity -> note-length
export function humanize(notes: NoteData[], params: HumanizationParams): NoteData[] {
  // 1. Store original grid positions (for idempotency / preventing double-humanization)
  const gridNotes = notes.map(n => ({ ...n }));

  // 2. Apply swing first (moves off-beat notes to swung grid positions)
  let result = applySwing(gridNotes, params.swing);

  // 3. Apply Brownian timing drift around the (possibly swung) grid positions
  result = applyTimingDrift(result, params.timing);

  // 4. Apply velocity variation with instrument-aware profile
  result = applyVelocityVariation(result, params.velocity);

  // 5. Apply note-length variation per beat position
  result = applyNoteLengthVariation(result, params.noteLength);

  return result;
}
```

### Pattern 2: Ornstein-Uhlenbeck Timing Drift
**What:** Mean-reverting Brownian walk for timing offsets. Each note's timing offset depends on the previous note's offset, pulled back toward zero by a "spring constant."
**When to use:** For all timing humanization (HUM-01, HUM-05).

```typescript
// Euler-Maruyama discretization of Ornstein-Uhlenbeck process:
// x_{n+1} = x_n + theta * (mu - x_n) * dt + sigma * sqrt(dt) * gaussian()
//
// Parameters:
//   theta = mean reversion speed (spring constant), e.g. 0.3-0.8
//   mu    = long-term mean (0 = centered on grid)
//   sigma = volatility (controls drift magnitude)
//   dt    = time step (1.0 for note-by-note, or actual beat interval)

function generateTimingDrift(noteCount: number, params: TimingDriftParams): number[] {
  const { theta, sigma } = params;
  const mu = 0; // Always revert toward grid position
  const dt = 1.0;
  const offsets: number[] = [];
  let x = 0; // Start on grid

  for (let i = 0; i < noteCount; i++) {
    x = x + theta * (mu - x) * dt + sigma * Math.sqrt(dt) * gaussianRandom();
    offsets.push(x);
  }

  return offsets;
}
```

### Pattern 3: MPC-Style Swing
**What:** Delay every other subdivision note by a percentage-based amount.
**When to use:** For HUM-03 swing/groove.

```typescript
// Swing formula (Roger Linn / MPC):
// - 50% = no swing (both 16th notes equal duration within each 8th)
// - 66% = triplet swing (2/3 + 1/3 split)
// - 75% = maximum swing (dotted 16th + 32nd split)
//
// Only affects OFF-BEAT subdivisions (the "and" or "e"/"a" of each beat)
// On-beat notes remain at their grid position.

function applySwing(notes: NoteData[], swingPercent: number): NoteData[] {
  // swingPercent is 50-75 range
  // For each note, determine if it falls on an off-beat 16th position
  // If so, delay it by: maxDelay * (swingPercent - 50) / 25
  // where maxDelay = 0.25 beats (one 16th note) at 75%
  const swingAmount = (swingPercent - 50) / 25; // 0.0 to 1.0
  const subdivisionSize = 0.25; // 16th note in beats

  return notes.map(n => {
    const posInBeat = n.time % 1.0; // Position within the beat
    const subdivIndex = Math.round(posInBeat / subdivisionSize);
    const isOffBeat = subdivIndex % 2 === 1; // 2nd and 4th 16th notes

    if (isOffBeat) {
      const delay = subdivisionSize * swingAmount;
      return { ...n, time: n.time + delay };
    }
    return { ...n };
  });
}
```

### Pattern 4: Instrument-Aware Velocity Profiles
**What:** Different instruments have different natural velocity patterns. Drums emphasize ghost notes vs accents; piano breathes dynamically; bass is more consistent.
**When to use:** For HUM-02 velocity variation.

```typescript
// Instrument velocity profiles (researched values from production literature):
const VELOCITY_PROFILES = {
  drums: {
    // Drums: wide dynamic range, ghost notes are key
    baseVelocityRange: [0.3, 1.0],  // Very wide (ghost notes at 0.3, accents at 1.0)
    downbeatBoost: 0.08,             // Downbeats slightly louder
    ghostNoteVelocity: [0.24, 0.39], // Ghost notes at MIDI 30-50 equivalent
    accentVelocity: [0.78, 0.94],    // Main hits at MIDI 100-120
    variationAmount: 0.08,           // +-8% random variation
  },
  piano: {
    // Piano: moderate dynamics, breathing phrasing
    baseVelocityRange: [0.47, 0.86], // MIDI 60-110 equivalent
    downbeatBoost: 0.04,
    phraseShaping: true,             // Velocity contour follows phrase arc
    variationAmount: 0.06,
  },
  bass: {
    // Bass: consistent, slight downbeat emphasis
    baseVelocityRange: [0.63, 0.82], // MIDI 80-105 equivalent, narrow range
    downbeatBoost: 0.06,
    variationAmount: 0.03,           // Very subtle variation
  },
  synth: {
    // Synths: depends on type, moderate default
    baseVelocityRange: [0.55, 0.86],
    downbeatBoost: 0.04,
    variationAmount: 0.05,
  },
};
```

### Anti-Patterns to Avoid
- **Uniform random timing:** Using `Math.random() * range` for timing offsets produces white noise which sounds jittery and worse than quantized. MUST use correlated noise (Brownian walk).
- **Double humanization:** Applying humanization to already-humanized notes compounds drift. Always store and reference original grid positions.
- **Ignoring tempo context:** A 5ms timing offset means very different things at 80 BPM vs 180 BPM. Scale offsets relative to beat duration.
- **Symmetric velocity variation:** Real players don't vary equally up and down. Downbeats tend to be louder, upbeats softer -- apply asymmetric profiles.
- **Fixed timing offset magnitude:** Fast passages (16th notes at high tempo) need tighter timing (3-8ms) while slow passages (whole notes) can breathe more (10-20ms).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Correlated noise generation | Custom Perlin noise | `simplex-noise` createNoise2D | Battle-tested, 72.9M ops/sec, TypeScript-native, handles interpolation correctly |
| Seeded PRNG | Custom LCG/xorshift | `alea` package | Proven quality, compatible with simplex-noise seeding, maintains state correctly |
| Gaussian random numbers | External library | Box-Muller transform (6 lines) | Too simple to need a dependency, well-understood algorithm |
| Swing algorithm | Custom grid analysis | MPC-formula (ratio-based) | Industry standard since 1979, proven by decades of music production |

**Key insight:** The humanization algorithms themselves (O-U process, swing formula, velocity profiles) are straightforward math that should be hand-written in TypeScript. The noise generation infrastructure (simplex noise, seeded PRNG) should use established libraries because getting interpolation and distribution quality right is subtle.

## Common Pitfalls

### Pitfall 1: White Noise Timing Sounds Worse Than Quantized
**What goes wrong:** Adding `Math.random() * 0.02` to each note's timing independently produces uncorrelated (white noise) jitter. This sounds obviously mechanical and worse than perfectly quantized notes.
**Why it happens:** Uniform random is the default instinct. Real humans drift gradually -- if they're slightly behind on one note, they're likely slightly behind on the next.
**How to avoid:** Use Ornstein-Uhlenbeck (mean-reverting Brownian walk) for timing. Each note's offset depends on the previous note's offset.
**Warning signs:** Timing sounds "jittery" or "nervous" rather than "loose" or "relaxed."

### Pitfall 2: Double Humanization
**What goes wrong:** User humanizes a pattern, then re-humanizes it. Drift compounds, notes become increasingly out of time.
**Why it happens:** No record of whether notes have already been humanized.
**How to avoid:** Store original grid-quantized positions. Always humanize from the grid positions, not from previously humanized positions. Consider adding a metadata flag or storing originals.
**Warning signs:** Notes increasingly drift away from where they should be after multiple humanize calls.

### Pitfall 3: Tempo-Unaware Timing Offsets
**What goes wrong:** A fixed timing offset (e.g., 0.02 beats) works well at 120 BPM (~10ms) but is imperceptible at 60 BPM (~5ms) and too aggressive at 200 BPM (~6ms but proportionally larger).
**Why it happens:** Thinking in beats rather than musical perception (milliseconds).
**How to avoid:** Define timing offsets in beats but scale the sigma/volatility parameter based on note density and context. The context-aware system (HUM-05) should analyze note density and adjust.
**Warning signs:** Humanization sounds right at one tempo but wrong at others.

### Pitfall 4: Swing Applied to Wrong Subdivisions
**What goes wrong:** Swing shifts notes that aren't on subdivision grid positions, or shifts notes that should remain stable (downbeats).
**Why it happens:** Imprecise detection of which notes fall on off-beat subdivisions due to floating-point time values.
**How to avoid:** Use a tolerance window (e.g., within 0.01 beats of a subdivision) to classify notes as "on a 16th-note grid point." Only shift notes identified as off-beat subdivisions.
**Warning signs:** Downbeat notes are shifted, or notes that are already slightly off-grid get double-shifted.

### Pitfall 5: Velocity Variation Without Beat Awareness
**What goes wrong:** All notes get equal random velocity variation regardless of beat position. This removes the natural emphasis patterns that make music groove.
**Why it happens:** Applying velocity variation uniformly without considering musical context.
**How to avoid:** Weight velocity variation by beat position: downbeats (beats 1, 3) get higher velocity, backbeats (beats 2, 4) get instrument-appropriate treatment (snare louder, hi-hat softer), off-beat subdivisions get softer velocity.
**Warning signs:** Groove feels flat despite velocity variation.

### Pitfall 6: Floating Point Time Comparison
**What goes wrong:** Checking `note.time % 0.25 === 0` fails due to floating-point imprecision.
**Why it happens:** JavaScript floating-point arithmetic (0.1 + 0.2 !== 0.3).
**How to avoid:** Use epsilon-based comparison: `Math.abs(note.time % 0.25) < 0.01` or convert to integer ticks internally.
**Warning signs:** Some notes are unexpectedly included/excluded from swing or beat-position logic.

## Code Examples

### Box-Muller Gaussian Random Number Generator
```typescript
// Source: Standard Box-Muller transform
// No dependency needed -- this is the complete implementation.
function gaussianRandom(mean = 0, stddev = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stddev + mean;
}
```

### Simplex Noise for Velocity Variation
```typescript
// Source: simplex-noise v4.0.3 official docs (https://github.com/jwagner/simplex-noise.js)
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

// Seeded noise for reproducible humanization
const prng = alea('humanize-seed-123');
const noise2D = createNoise2D(prng);

// Use note index as x-axis, instrument type as y-axis offset
// noise2D returns -1 to 1, scale to desired velocity variation range
function getVelocityVariation(noteIndex: number, scale: number = 0.1): number {
  // Lower frequency = smoother variation (0.1-0.3 is good for velocity)
  const frequency = 0.15;
  const noiseValue = noise2D(noteIndex * frequency, 0);
  return noiseValue * scale; // Returns -scale to +scale
}
```

### Ornstein-Uhlenbeck Timing Drift
```typescript
// Source: Euler-Maruyama discretization (standard numerical method)
interface TimingDriftParams {
  theta: number;    // Mean reversion speed (0.3 = slow drift, 0.8 = tight)
  sigma: number;    // Volatility in beats (0.005 = subtle, 0.02 = loose)
}

function generateTimingOffsets(
  noteCount: number,
  params: TimingDriftParams
): number[] {
  const { theta, sigma } = params;
  const mu = 0;     // Revert toward grid
  const dt = 1.0;   // Step per note
  const offsets: number[] = [];
  let x = 0;

  for (let i = 0; i < noteCount; i++) {
    // Ornstein-Uhlenbeck step
    x = x + theta * (mu - x) * dt + sigma * Math.sqrt(dt) * gaussianRandom();
    offsets.push(x);
  }

  return offsets; // Values in beats, add to note.time
}

// Preset examples:
// "tight": { theta: 0.7, sigma: 0.003 }  -- fast reversion, small drift
// "loose": { theta: 0.3, sigma: 0.015 }  -- slow reversion, larger drift
// "jazz":  { theta: 0.2, sigma: 0.020 }  -- very slow reversion, wide drift
// "lo-fi": { theta: 0.15, sigma: 0.025 } -- minimal reversion, large wandering
```

### Swing Application
```typescript
// Source: Roger Linn's MPC swing formula (documented in Attack Magazine interview)
interface SwingParams {
  amount: number;  // 50 (none) to 75 (max), 66 = triplet feel
  gridSize: number; // Subdivision to swing: 0.25 = 16th notes, 0.5 = 8th notes
}

function applySwing(notes: NoteData[], params: SwingParams): NoteData[] {
  const { amount, gridSize } = params;
  if (amount <= 50) return notes.map(n => ({ ...n }));

  // swingRatio: 0.0 (no swing) to 1.0 (max swing)
  const swingRatio = (amount - 50) / 25;
  // Maximum delay: shift off-beat note by up to one full grid division
  // At 75%, the off-beat 16th becomes a dotted-16th position
  const maxDelay = gridSize * swingRatio;
  const tolerance = gridSize * 0.1; // 10% tolerance for grid detection

  return notes.map(note => {
    // Find position within the beat pair (two grid divisions)
    const pairSize = gridSize * 2;
    const posInPair = ((note.time % pairSize) + pairSize) % pairSize;
    // Is this note on the second subdivision of the pair? (off-beat)
    const isOffBeat = Math.abs(posInPair - gridSize) < tolerance;

    if (isOffBeat) {
      return { ...note, time: note.time + maxDelay };
    }
    return { ...note };
  });
}
```

### Context-Aware Humanization
```typescript
// Source: Derived from production best practices (multiple sources)
// Fast passages = tight timing, slow passages = loose timing
function calculateContextSigma(
  notes: NoteData[],
  baseSigma: number
): number[] {
  const sigmas: number[] = [];

  for (let i = 0; i < notes.length; i++) {
    // Look at local note density (surrounding notes within 2 beats)
    const windowStart = notes[i].time - 2;
    const windowEnd = notes[i].time + 2;
    const neighbors = notes.filter(n =>
      n.time >= windowStart && n.time <= windowEnd
    );
    const density = neighbors.length;

    // High density = tighter timing, low density = looser
    // density of 1-3 = loose (1.5x sigma), 4-8 = normal, 8+ = tight (0.5x sigma)
    let scaleFactor: number;
    if (density <= 3) {
      scaleFactor = 1.5;
    } else if (density <= 8) {
      scaleFactor = 1.0;
    } else {
      scaleFactor = 0.5;
    }

    sigmas.push(baseSigma * scaleFactor);
  }

  return sigmas;
}
```

### HumanizationParams Type
```typescript
// Full params type for the humanize() function
interface HumanizationParams {
  // Optional seed for reproducible results
  seed?: string;

  // Timing drift (HUM-01, HUM-05)
  timing?: {
    enabled?: boolean;
    theta?: number;   // Mean reversion speed (0.1-0.9, default 0.5)
    sigma?: number;   // Drift magnitude in beats (0.001-0.03, default 0.008)
    contextAware?: boolean; // Scale sigma by note density (HUM-05)
  };

  // Velocity variation (HUM-02)
  velocity?: {
    enabled?: boolean;
    instrument?: 'drums' | 'piano' | 'bass' | 'synth' | 'default';
    amount?: number;  // 0-1 scale factor (default 0.5)
    beatEmphasis?: boolean; // Emphasize downbeats (default true)
  };

  // Swing/groove (HUM-03)
  swing?: {
    enabled?: boolean;
    amount?: number;  // 50-75 (default 50 = no swing)
    gridSize?: number; // 0.25 = 16ths, 0.5 = 8ths (default 0.25)
  };

  // Note length variation (HUM-04)
  noteLength?: {
    enabled?: boolean;
    amount?: number;  // 0-1 scale factor (default 0.3)
    downbeatLegato?: boolean; // Downbeats slightly longer (default true)
  };
}

// Named preset type (HUM-06)
type HumanizationPreset = 'tight' | 'loose' | 'jazz' | 'lo-fi';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Uniform random timing offset | Brownian walk / Ornstein-Uhlenbeck timing drift | Early 2010s (academic research) | Night-and-day difference in organic feel |
| Fixed velocity +/- random | Instrument-aware velocity profiles with beat-position weighting | Mid 2010s (professional tools) | Grooves feel alive instead of randomly noisy |
| Simple percentage swing | MPC-style ratio swing with subdivision awareness | 1979 (Roger Linn, LM-1) | Still the gold standard for groove |
| Global humanization amount | Context-aware (density-sensitive) humanization | 2020s (AI-driven tools like HumBeat, SmarterHUMANIZE) | Fast passages tight, slow passages breathe |
| simplex-noise v3 (class-based) | simplex-noise v4 (functional, tree-shakeable) | 2022 (v4.0.0) | Breaking API change: createNoise2D() instead of new SimplexNoise() |

**Deprecated/outdated:**
- simplex-noise v3 class-based API: v4 uses functional `createNoise2D()` etc.
- White noise / uniform random for timing: Sounds worse than no humanization

## Open Questions

1. **Beat-position awareness precision**
   - What we know: Notes stored as float beats (quarter notes). Need to classify notes as downbeat/upbeat/off-beat.
   - What's unclear: How to handle notes that don't fall precisely on subdivisions (e.g., already slightly humanized notes from melody generator's existing velocity variation).
   - Recommendation: Use tolerance-based grid snapping for classification. Round to nearest subdivision within a configurable epsilon (default 0.01 beats). Notes outside any grid point get "neutral" treatment.

2. **Interaction with existing velocity variation in generators**
   - What we know: `generateMelody()` and `generateBassLine()` already apply slight velocity variation (+-0.05 and +-0.03 respectively).
   - What's unclear: Should humanization replace this or stack on top?
   - Recommendation: Humanization should be a separate, optional step that replaces the simple variation in generators. When humanize is requested, generators should output flat velocity values and let the humanizer handle all dynamics. For backwards compatibility, keep existing behavior when humanize is not requested.

3. **Reproducibility and seed management**
   - What we know: `alea` package provides seeded PRNG compatible with simplex-noise.
   - What's unclear: Should each humanize call get a fresh seed, or should the user control it?
   - Recommendation: Auto-generate seed from timestamp by default (each call is different). Accept optional user-provided seed for reproducibility. Store the used seed in return metadata so it can be replayed.

4. **Integration point: separate tool vs parameter on existing tools**
   - What we know: Current tools (create_chord_progression, create_melody, etc.) produce NoteData[].
   - What's unclear: Should humanize be a separate MCP tool or a parameter on existing tools?
   - Recommendation: Both. Create a standalone `humanize_notes` tool that accepts NoteData[] and params, AND add an optional `humanize` parameter to existing tools. The standalone tool allows humanizing any notes (including raw `add_notes`), while the parameter provides convenience for common workflows.

## Sources

### Primary (HIGH confidence)
- [simplex-noise v4.0.3 GitHub](https://github.com/jwagner/simplex-noise.js) - API reference, version, TypeScript support, performance benchmarks, seeding with alea
- [simplex-noise docs](https://29a.ch/simplex-noise/docs/index.html) - Function signatures, type definitions (createNoise2D, createNoise3D, createNoise4D, RandomFn)
- [Roger Linn / Attack Magazine interview](https://www.attackmagazine.com/features/interview/roger-linn-swing-groove-magic-mpc-timing) - MPC swing formula, 50-75% range, off-beat 16th note delay
- [Ornstein-Uhlenbeck / QuantStart](https://www.quantstart.com/articles/ornstein-uhlenbeck-simulation-with-python/) - Euler-Maruyama discretization formula for O-U process
- Existing codebase: `src/music/types.ts` (NoteData interface), `src/tools/notes.ts` (tool architecture), `src/music/melody.ts` (existing generation patterns)

### Secondary (MEDIUM confidence)
- [Slam Tracks - 5 Secrets to Humanizing MIDI Drums](https://www.slamtracks.com/2025/12/20/5-secrets-to-humanizing-midi-drums/) - Velocity ranges: kicks 90-115, snares 100-110, ghost notes 30-50, hi-hats 60-95; timing offsets 5-15ms early/5-20ms late
- [Splice Blog - Humanize Drums](https://splice.com/blog/humanize-your-drums/) - +-10 ticks randomization, downbeat/offbeat emphasis patterns, stereo tremolo for hi-hats
- [MPC Swing Technical Details](https://www.tumblr.com/palsen/182157488304/about-mpc-swing) - Swing ratio formula, 66% = triplet, relationship between percentage and timing delay
- [Steinberg Forums](https://forums.steinberg.net/t/question-for-cubase-developers-experts-how-is-the-swing-calculated/1007380) - Swing calculation confirmation: shifts 2nd and 4th 16th notes within each beat

### Tertiary (LOW confidence)
- [SmarterHUMANIZE](https://gearspace.com/board/new-product-alert-2-older-threads/1453981-smarterhumanize-2-0-musical-midi-humanization-logic-pro-now-free-lite-version.html) - Context-aware per-beat timing concept (commercial product, algorithm not documented)
- [HumBeat](https://developdevice.com/products/humbeat-advanced-midi-drum-humanizer) - "Gaussian algorithm" for drum humanization, fatigue modeling concept
- General production consensus from multiple WebSearch results: 3-8ms for tight passages, 10-20ms for loose passages, +-20ms is the natural human drummer window

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - simplex-noise v4.0.3 verified via GitHub/npm, API confirmed via official docs
- Architecture (pipeline, O-U process): HIGH - Euler-Maruyama is standard numerical method, pipeline order derived from signal processing principles
- Swing formula: HIGH - documented by Roger Linn himself in multiple interviews, confirmed by multiple DAW implementations
- Velocity profiles (numeric values): MEDIUM - aggregated from multiple production sources, but specific numbers are approximate guidelines not scientific measurements
- Context-aware scaling: MEDIUM - concept confirmed by commercial tools, specific implementation details are original design based on production principles
- Pitfalls: HIGH - uniform-random-is-worse and double-humanization are widely documented; floating-point issues are fundamental JavaScript knowledge

**Research date:** 2026-02-23
**Valid until:** 2026-04-23 (60 days - algorithms are stable, simplex-noise unlikely to change)
