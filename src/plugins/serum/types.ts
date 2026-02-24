/**
 * Serum 2 plugin types for FL Studio MCP bridge
 *
 * Defines Serum-specific interfaces for semantic parameter aliasing,
 * sound recipes, and preset discovery. These types complement the
 * generic plugin types in ../types.ts with Serum 2 domain knowledge.
 */

/**
 * Maps human-friendly parameter names to actual FL Studio parameter names.
 * Multiple semantic names can point to the same actual parameter.
 *
 * Example:
 *   { semantic: ['filter cutoff', 'cutoff', 'filter freq'], actual: 'Filter 1 Freq', group: 'filter-1' }
 */
export interface SemanticAlias {
  /** Human-friendly names that users might type (multiple per param) */
  semantic: string[];
  /** Actual FL Studio parameter name from runtime discovery */
  actual: string;
  /** Logical group for browsing/categorization */
  group:
    | 'oscillator-a'
    | 'oscillator-b'
    | 'oscillator-c'
    | 'sub'
    | 'noise'
    | 'filter-1'
    | 'filter-2'
    | 'envelope-1'
    | 'envelope-2'
    | 'envelope-3'
    | 'envelope-4'
    | 'lfo'
    | 'fx'
    | 'macros'
    | 'global'
    | 'routing';
  /** What this parameter does */
  description?: string;
}

/**
 * A preset recipe: named collection of parameter values that produce
 * a specific sound character. Parameters use semantic names which are
 * resolved through the alias map before being sent to FL Studio.
 */
export interface SoundRecipe {
  /** Display name for the recipe */
  name: string;
  /** What this sound is / when to use it */
  description: string;
  /** Sound category for filtering */
  category: 'pad' | 'lead' | 'bass' | 'pluck' | 'keys' | 'fx';
  /** Semantic param name -> value 0.0-1.0 */
  parameters: Record<string, number>;
  /** Searchable tags */
  tags?: string[];
}

/**
 * Info about a Serum 2 preset file on disk.
 * Used for preset browsing and loading tools.
 */
export interface SerumPresetInfo {
  /** Filename without extension */
  name: string;
  /** Full filesystem path */
  path: string;
  /** Parent folder name (category) */
  category: string;
  /** File extension (.fxp or .SerumPreset) */
  extension: string;
}
