/**
 * Serum 2 sound design recipes
 *
 * Each recipe is a named collection of semantic parameter values that
 * produce a specific sound character. Parameter names are semantic aliases
 * (from aliases.ts) that get resolved to actual FL Studio parameter names
 * via resolveSemanticAlias before being sent to the plugin.
 *
 * Values are 0.0-1.0 normalized. These are musical starting points --
 * moderate values users will tweak, not extreme settings.
 */

import type { SoundRecipe } from './types.js';

/**
 * Built-in sound design recipes covering common Serum 2 sound types.
 *
 * All parameter names are semantic aliases from SERUM_ALIASES.
 * The recipe application code calls resolveSemanticAlias() on each
 * name before setting it via the FL Bridge plugin parameter API.
 */
export const RECIPES: SoundRecipe[] = [
  // ─────────────────────────────────────────────────────────────────
  // PAD
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'warm pad',
    description:
      'Detuned dual oscillators with low-pass filtering, slow attack, long release, and wide stereo spread. A lush starting point for ambient textures.',
    category: 'pad',
    parameters: {
      'osc a enable': 1.0,
      'osc a level': 0.7,
      'osc a wavetable': 0.15,
      'osc a unison': 0.3, // ~4 voices
      'osc a unison detune': 0.35,
      'osc a unison width': 0.8,
      'osc b enable': 1.0,
      'osc b level': 0.6,
      'osc b wavetable': 0.25,
      'osc b fine': 0.52, // slight detune from A
      'osc b unison': 0.25, // ~3 voices
      'osc b unison detune': 0.3,
      'osc b unison width': 0.75,
      'filter on': 1.0,
      'filter cutoff': 0.45,
      'filter resonance': 0.2,
      'attack': 0.4,
      'hold': 0.0,
      'decay': 0.5,
      'sustain': 0.75,
      'release': 0.6,
    },
    tags: ['ambient', 'lush', 'wide', 'atmospheric'],
  },

  // ─────────────────────────────────────────────────────────────────
  // LEAD
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'supersaw lead',
    description:
      'Bright saw-stack lead with heavy unison, high detune, and open filter. Classic EDM/trance supersaw with fast attack for immediate impact.',
    category: 'lead',
    parameters: {
      'osc a enable': 1.0,
      'osc a level': 0.8,
      'osc a wavetable': 0.0, // saw-like wavetable position
      'osc a unison': 0.55, // ~7 voices
      'osc a unison detune': 0.5,
      'osc a unison blend': 0.6,
      'osc a unison width': 0.7,
      'osc b enable': 1.0,
      'osc b level': 0.65,
      'osc b wavetable': 0.0,
      'osc b octave': 0.6, // +1 octave layer
      'osc b unison': 0.35, // ~4 voices
      'osc b unison detune': 0.4,
      'filter on': 1.0,
      'filter cutoff': 0.75,
      'filter resonance': 0.15,
      'attack': 0.05,
      'hold': 0.0,
      'decay': 0.35,
      'sustain': 0.8,
      'release': 0.3,
    },
    tags: ['bright', 'aggressive', 'edm', 'trance'],
  },

  // ─────────────────────────────────────────────────────────────────
  // BASS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'sub bass',
    description:
      'Clean sub bass from a single oscillator at low wavetable position. Minimal processing, tight envelope, deep low end for 808-style bass.',
    category: 'bass',
    parameters: {
      'osc a enable': 1.0,
      'osc a level': 0.85,
      'osc a wavetable': 0.0, // sine/fundamental position
      'osc a unison': 0.0, // single voice
      'osc a unison detune': 0.0,
      'osc b enable': 0.0,
      'filter on': 1.0,
      'filter cutoff': 0.3,
      'filter resonance': 0.1,
      'attack': 0.02,
      'hold': 0.0,
      'decay': 0.45,
      'sustain': 0.6,
      'release': 0.2,
    },
    tags: ['deep', 'sub', '808', 'minimal'],
  },

  // ─────────────────────────────────────────────────────────────────
  // PLUCK
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'pluck',
    description:
      'Short percussive pluck with fast attack, quick decay, low sustain. Filter envelope modulation adds brightness on note onset that fades quickly.',
    category: 'pluck',
    parameters: {
      'osc a enable': 1.0,
      'osc a level': 0.75,
      'osc a wavetable': 0.2,
      'osc a unison': 0.2, // ~3 voices for thickness
      'osc a unison detune': 0.25,
      'filter on': 1.0,
      'filter cutoff': 0.55,
      'filter resonance': 0.25,
      'attack': 0.01,
      'hold': 0.0,
      'decay': 0.25,
      'sustain': 0.1,
      'release': 0.3,
      'env 2 attack': 0.01,
      'env 2 decay': 0.2,
      'env 2 sustain': 0.05,
      'env 2 release': 0.25,
    },
    tags: ['short', 'staccato', 'percussive'],
  },

  // ─────────────────────────────────────────────────────────────────
  // KEYS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'analog keys',
    description:
      'Two oscillators slightly detuned for warmth, medium filter, moderate envelope. Vintage electric piano character with gentle attack and natural decay.',
    category: 'keys',
    parameters: {
      'osc a enable': 1.0,
      'osc a level': 0.7,
      'osc a wavetable': 0.1,
      'osc a fine': 0.48, // slightly flat
      'osc b enable': 1.0,
      'osc b level': 0.65,
      'osc b wavetable': 0.15,
      'osc b fine': 0.53, // slightly sharp (detune from A)
      'filter on': 1.0,
      'filter cutoff': 0.5,
      'filter resonance': 0.15,
      'attack': 0.05,
      'hold': 0.0,
      'decay': 0.4,
      'sustain': 0.55,
      'release': 0.35,
      'env 2 attack': 0.02,
      'env 2 decay': 0.35,
      'env 2 sustain': 0.3,
      'env 2 release': 0.3,
    },
    tags: ['vintage', 'retro', 'electric piano'],
  },

  // ─────────────────────────────────────────────────────────────────
  // FX
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'atmospheric fx',
    description:
      'Evolving atmospheric texture with long attack, noise layer, modulated filter. Slow-building cinematic soundscape for transitions and ambience.',
    category: 'fx',
    parameters: {
      'osc a enable': 1.0,
      'osc a level': 0.55,
      'osc a wavetable': 0.4,
      'osc a unison': 0.2,
      'osc a unison detune': 0.45,
      'osc a unison width': 0.9,
      'osc a scan rate': 0.3, // slow wavetable morphing
      'noise enable': 1.0,
      'noise level': 0.35,
      'filter on': 1.0,
      'filter cutoff': 0.4,
      'filter resonance': 0.3,
      'attack': 0.65,
      'hold': 0.1,
      'decay': 0.5,
      'sustain': 0.7,
      'release': 0.7,
      'lfo rate': 0.3,
      'lfo smooth': 0.6,
    },
    tags: ['ambient', 'texture', 'cinematic', 'evolving'],
  },
];

/**
 * Search recipes by name, description, category, or tags.
 *
 * Uses case-insensitive substring matching against all searchable fields.
 * Multiple words in the query are matched individually (all must match
 * at least one field for a recipe to be included).
 *
 * @param query - Search string (e.g., "warm pad", "bass", "ambient")
 * @returns Matching recipes (empty array if no matches)
 */
export function findRecipes(query: string): SoundRecipe[] {
  const q = query.toLowerCase().trim();
  if (!q) return [...RECIPES];

  return RECIPES.filter((recipe) => {
    const searchable = [
      recipe.name,
      recipe.description,
      recipe.category,
      ...(recipe.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return q.split(/\s+/).every((word) => searchable.includes(word));
  });
}

/**
 * List all available recipe names for browsing.
 *
 * @returns Array of recipe names (e.g., ["warm pad", "supersaw lead", ...])
 */
export function listRecipeNames(): string[] {
  return RECIPES.map((r) => r.name);
}
