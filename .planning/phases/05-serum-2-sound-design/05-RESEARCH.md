# Phase 5: Serum 2 Sound Design - Research

**Researched:** 2026-02-23
**Domain:** Serum 2 VST parameter mapping, semantic naming layers, sound design recipes, preset browsing
**Confidence:** MEDIUM (Serum 2 architecture verified from official sources; parameter names are LOW confidence until runtime discovery spike; FL Studio preset API verified from official stubs)

## Summary

Phase 5 builds a Serum 2-specific semantic layer on top of the generic plugin control infrastructure from Phase 4. The core challenge is that **Serum 2's actual parameter names as reported by FL Studio's `plugins.getParamName()` are unknown until runtime discovery**. The parameter names used in Serum's internal preset format (e.g., `a_vol`, `fil_cutoff`, `lfo1rate`) may differ from what FL Studio reports via the VST3 host interface. A **runtime discovery spike** must be the very first task: load Serum 2 in FL Studio, run `discover_plugin_params`, and capture the actual parameter name list.

Once the actual parameter names are known, Phase 5 builds three layers: (1) a **semantic alias map** that translates musical language ("oscillator 1 level", "filter cutoff", "macro 1") to actual Serum 2 parameter names, using the existing Phase 4 three-tier fuzzy matching plus an additional Serum-specific alias table; (2) **sound design recipes** that define multi-parameter presets for common sound types (warm pad, supersaw lead, pluck bass, etc.) as declarative parameter maps; and (3) **preset browsing** via the FL Studio `plugins.nextPreset()`/`plugins.prevPreset()` API combined with filesystem enumeration of Serum 2's preset directory.

Serum 2 has significantly expanded from Serum 1: 3 main oscillators (up from 2), each supporting 5 synthesis modes (wavetable, multisample, sample, granular, spectral), plus sub and noise oscillators, 10 LFOs, 4 envelopes, 4-8 macros, dual filters, and 3 FX racks. The parameter count is likely 200-400+ named parameters. The existing Phase 4 SysEx chunking handles this payload size.

**Primary recommendation:** Start with a runtime discovery spike to capture actual Serum 2 parameter names. Then build a static semantic alias map (not dynamic AI inference), sound recipe definitions as plain TypeScript data structures, and preset browsing using FL Studio's built-in preset navigation API plus filesystem scanning.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phase 4 plugin tools | Already built | Parameter discovery, get/set by name | Foundation layer -- Phase 5 wraps these |
| FL Studio `plugins` module | Built-in | `nextPreset()`, `prevPreset()`, `getPresetCount()`, `getName(FPN_Preset)` | Only API for plugin preset navigation |
| `zod` (already installed) | ^3.25.30 | MCP tool input validation | Already in project |
| `node:fs` / `node:path` | Built-in | Enumerate Serum 2 preset files on disk | Preset browsing requires filesystem access |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node-serum2-preset-packager` | Latest | Decode `.SerumPreset` files to JSON | **Only if** preset metadata reading (tags, author, description) is needed; NOT required for basic preset browsing |
| `glob` or `fast-glob` | Latest | Recursive preset folder enumeration | If `node:fs.readdir` recursive is insufficient |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static alias map | Fuse.js fuzzy search library | Overkill; Phase 4's 3-tier matching already handles fuzzy resolution. Add Serum aliases as pre-lookup, not replace the matcher. |
| Hand-coded recipes | node-serum2-preset-packager for full preset generation | Recipe approach is simpler, more maintainable, and works through existing set_plugin_param calls. Full preset file generation is a separate concern. |
| FL Studio preset API | Direct filesystem preset loading | FL Studio API is simpler and works for basic next/prev/count. Filesystem gives category browsing. Use both. |
| AI-generated parameter mappings | Static curated map | Static map is predictable, testable, version-controllable. AI inference would be unreliable for parameter names. |

**Installation:**
No new required dependencies. All Phase 5 code builds on existing Phase 4 infrastructure plus Node.js built-ins for filesystem access. `node-serum2-preset-packager` is optional and should only be added if preset metadata reading is needed.

## Architecture Patterns

### Recommended Project Structure

```
src/
  plugins/
    serum/
      aliases.ts           # NEW: Serum 2 semantic name -> actual param name mapping
      recipes.ts           # NEW: Sound design recipe definitions (pad, lead, bass, pluck)
      types.ts             # NEW: Serum-specific types (recipe, alias, preset info)
      presets.ts           # NEW: Preset browsing (filesystem + FL Studio API)
  tools/
    serum.ts               # NEW: MCP tools for Serum 2 sound design
fl-bridge/
  handlers/
    plugins.py             # MODIFY: Add preset navigation handlers (nextPreset, prevPreset, getPresetCount, getName)
```

### Pattern 1: Semantic Alias Layer

**What:** A static mapping from human-friendly names to Serum 2's actual FL Studio parameter names. The alias layer sits ABOVE the Phase 4 param cache, providing a first-pass translation before the existing 3-tier fuzzy match runs.
**When to use:** Every Serum 2 parameter access goes through this layer.

```typescript
// src/plugins/serum/aliases.ts
// NOTE: Actual Serum 2 parameter names in the 'actual' column
// MUST be populated from the runtime discovery spike.
// The names below are HYPOTHETICAL based on Serum 1 conventions.

export interface SemanticAlias {
  semantic: string[];        // Human-friendly names (multiple per param)
  actual: string;            // Actual FL Studio parameter name (from discovery)
  group: string;             // Logical group for organization
  description?: string;      // What this parameter does
  range?: { min: number; max: number; default: number };  // Semantic range hints
}

// Example alias table (to be populated after discovery spike)
export const SERUM_ALIASES: SemanticAlias[] = [
  // Oscillator A
  {
    semantic: ['osc a level', 'oscillator a volume', 'osc 1 level', 'oscillator 1 volume'],
    actual: 'Osc A Level',  // PLACEHOLDER - replace with actual discovered name
    group: 'oscillator-a',
    description: 'Oscillator A output level',
  },
  {
    semantic: ['osc a wt pos', 'wavetable position a', 'osc 1 wavetable'],
    actual: 'Osc A WT Pos',  // PLACEHOLDER
    group: 'oscillator-a',
    description: 'Oscillator A wavetable frame position',
  },
  {
    semantic: ['filter cutoff', 'cutoff', 'filter freq'],
    actual: 'Filter Cutoff',  // PLACEHOLDER
    group: 'filter',
    description: 'Filter cutoff frequency',
  },
  {
    semantic: ['macro 1', 'macro one'],
    actual: 'Macro 1',  // PLACEHOLDER
    group: 'macros',
    description: 'Macro control 1',
  },
  // ... 200+ more entries populated after discovery
];

/**
 * Resolve a semantic name to the actual Serum 2 parameter name.
 * Returns the 'actual' name if found, or the input unchanged for
 * fallthrough to Phase 4's generic fuzzy matcher.
 */
export function resolveSemanticAlias(input: string): string {
  const normalized = input.toLowerCase().trim();
  for (const alias of SERUM_ALIASES) {
    for (const sem of alias.semantic) {
      if (sem === normalized) return alias.actual;
    }
  }
  // No alias found -- return input for Phase 4 fallthrough
  return input;
}
```

### Pattern 2: Sound Design Recipes

**What:** Declarative multi-parameter configurations that produce recognizable sound types. Each recipe is a named collection of parameter name-value pairs applied as a batch.
**When to use:** When user says "create a warm pad" or "make a supersaw lead."

```typescript
// src/plugins/serum/recipes.ts

export interface SoundRecipe {
  name: string;                    // Recipe name ("warm pad", "supersaw lead")
  description: string;             // What this sound is / sounds like
  category: 'pad' | 'lead' | 'bass' | 'pluck' | 'keys' | 'fx';
  parameters: Record<string, number>;  // paramName -> value (0.0-1.0)
  tags?: string[];                 // Searchable tags
}

export const RECIPES: SoundRecipe[] = [
  {
    name: 'warm pad',
    description: 'Lush detuned pad with gentle filter and reverb. Good for ambient backgrounds.',
    category: 'pad',
    parameters: {
      // Oscillator A: saw wavetable, moderate unison
      'osc a level': 0.75,
      'osc a unison voices': 0.5,     // ~4-7 voices depending on Serum mapping
      'osc a unison detune': 0.25,    // Gentle detune for width
      // Oscillator B: similar, slightly different wavetable position
      'osc b level': 0.65,
      'osc b unison voices': 0.5,
      'osc b unison detune': 0.3,
      // Filter: low pass, moderate cutoff
      'filter cutoff': 0.45,
      'filter resonance': 0.15,
      // Envelope: slow attack, long release
      'env 1 attack': 0.4,
      'env 1 decay': 0.5,
      'env 1 sustain': 0.7,
      'env 1 release': 0.6,
      // Macro hints (if applicable)
    },
    tags: ['ambient', 'lush', 'wide', 'atmospheric'],
  },
  // More recipes: supersaw lead, sub bass, pluck, etc.
];

/**
 * Find recipes matching a query string.
 * Searches name, description, category, and tags.
 */
export function findRecipes(query: string): SoundRecipe[] {
  const q = query.toLowerCase().trim();
  return RECIPES.filter(r =>
    r.name.includes(q) ||
    r.description.toLowerCase().includes(q) ||
    r.category === q ||
    r.tags?.some(t => t.includes(q))
  );
}
```

### Pattern 3: Preset Browsing (Dual Strategy)

**What:** Combine FL Studio's built-in preset navigation API with filesystem enumeration for comprehensive preset browsing.
**When to use:** When user wants to browse or load Serum 2 presets.

```python
# fl-bridge/handlers/plugins.py - additional handlers for preset browsing

def handle_plugin_preset_count(params):
    """Get total preset count for a plugin."""
    index = params.get('index', channels.selectedChannel())
    slot_index = params.get('slotIndex', -1)
    count = plugins.getPresetCount(index, slot_index)
    return {'success': True, 'presetCount': count, 'channelIndex': index}

def handle_plugin_next_preset(params):
    """Navigate to next preset."""
    index = params.get('index', channels.selectedChannel())
    slot_index = params.get('slotIndex', -1)
    plugins.nextPreset(index, slot_index)
    # Get the new preset name
    name = plugins.getName(index, slot_index, midi.FPN_Preset, 0)
    return {'success': True, 'presetName': name, 'channelIndex': index}

def handle_plugin_prev_preset(params):
    """Navigate to previous preset."""
    index = params.get('index', channels.selectedChannel())
    slot_index = params.get('slotIndex', -1)
    plugins.prevPreset(index, slot_index)
    name = plugins.getName(index, slot_index, midi.FPN_Preset, 0)
    return {'success': True, 'presetName': name, 'channelIndex': index}
```

```typescript
// src/plugins/serum/presets.ts - filesystem-based preset browsing

import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { homedir } from 'node:os';

export interface SerumPresetInfo {
  name: string;          // Filename without extension
  path: string;          // Full path
  category: string;      // Parent folder name (e.g., "Bass", "Leads", "Pads")
  extension: string;     // .fxp or .SerumPreset
}

const SERUM2_PRESET_DIR = join(
  homedir(), 'Documents', 'Xfer', 'Serum 2 Presets', 'Presets'
);

/**
 * Enumerate all Serum 2 presets from the filesystem.
 * Returns categorized preset list based on folder structure.
 */
export async function listSerumPresets(
  filterCategory?: string,
  filterName?: string,
): Promise<SerumPresetInfo[]> {
  const presets: SerumPresetInfo[] = [];
  // Recursive scan of preset directory
  await scanDir(SERUM2_PRESET_DIR, '', presets);
  // Apply filters
  let results = presets;
  if (filterCategory) {
    const cat = filterCategory.toLowerCase();
    results = results.filter(p => p.category.toLowerCase().includes(cat));
  }
  if (filterName) {
    const name = filterName.toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(name));
  }
  return results;
}

async function scanDir(
  basePath: string, category: string, results: SerumPresetInfo[]
): Promise<void> {
  const entries = await readdir(basePath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(basePath, entry.name);
    if (entry.isDirectory()) {
      await scanDir(fullPath, entry.name, results);
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (ext === '.fxp' || ext === '.serumpreset') {
        results.push({
          name: basename(entry.name, ext),
          path: fullPath,
          category: category || 'Uncategorized',
          extension: ext,
        });
      }
    }
  }
}
```

### Pattern 4: Serum-Aware MCP Tools (Wrapping Phase 4)

**What:** Serum 2-specific MCP tools that wrap the generic Phase 4 tools with semantic resolution and recipe support.
**When to use:** All Serum 2 interactions go through these tools.

```typescript
// src/tools/serum.ts

// Tool: serum_set_param
// Resolves semantic aliases before delegating to set_plugin_param
server.tool(
  'serum_set_param',
  'Set a Serum 2 parameter using musical language. Supports names like "filter cutoff", "osc a level", "macro 1". Fuzzy matched.',
  {
    name: z.string().describe('Parameter name (e.g., "filter cutoff", "osc a detune")'),
    value: z.number().min(0).max(1).describe('Value 0.0-1.0'),
    channelIndex: z.number().int().min(0).optional(),
  },
  async ({ name, value, channelIndex }) => {
    // 1. Resolve semantic alias
    const resolvedName = resolveSemanticAlias(name);
    // 2. Delegate to Phase 4 generic set_plugin_param
    // (which handles fuzzy matching, auto-discovery, shadow state)
    return setPluginParam(connection, resolvedName, value, channelIndex, -1);
  }
);

// Tool: serum_apply_recipe
// Apply a multi-parameter sound design recipe
server.tool(
  'serum_apply_recipe',
  'Apply a sound design recipe to Serum 2. Creates a complete sound from a description like "warm pad" or "supersaw lead".',
  {
    recipe: z.string().describe('Recipe name or search term (e.g., "warm pad", "bass", "pluck")'),
    channelIndex: z.number().int().min(0).optional(),
  },
  async ({ recipe, channelIndex }) => {
    const matches = findRecipes(recipe);
    if (matches.length === 0) {
      return { content: [{ type: 'text', text: `No recipe found for "${recipe}". Available: ${RECIPES.map(r => r.name).join(', ')}` }] };
    }
    const selected = matches[0];
    // Apply all parameters in the recipe
    for (const [paramName, value] of Object.entries(selected.parameters)) {
      const resolved = resolveSemanticAlias(paramName);
      await setPluginParam(connection, resolved, value, channelIndex, -1);
    }
    return { content: [{ type: 'text', text: `Applied recipe "${selected.name}": ${selected.description}` }] };
  }
);

// Tool: serum_browse_presets
// Browse Serum 2 presets by category or name
server.tool(
  'serum_browse_presets',
  'Browse Serum 2 presets. Filter by category (Bass, Leads, Pads, etc.) or search by name.',
  {
    category: z.string().optional().describe('Category filter (e.g., "Bass", "Leads", "Pads")'),
    search: z.string().optional().describe('Name search term'),
  },
  async ({ category, search }) => {
    const presets = await listSerumPresets(category, search);
    // Format and return
    // ...
  }
);
```

### Anti-Patterns to Avoid

- **Hardcoding parameter indices:** Always use names. Serum 2 parameter indices may change between versions. The whole point of Phase 4's name-based resolution is to avoid this.
- **Assuming Serum 1 parameter names work in Serum 2:** Serum 2 added a third oscillator and restructured many parameters. Parameter names MUST come from runtime discovery.
- **Building recipes before knowing actual parameter names:** Recipes reference parameter names. The discovery spike must happen first, then recipes are authored using verified names.
- **Loading .SerumPreset files into Serum 2 via SysEx:** There is no API to load arbitrary preset files into a VST. Use FL Studio's `nextPreset()`/`prevPreset()` for internal presets, or instruct the user to load files via Serum's browser.
- **Over-engineering the alias system:** Simple static map + Phase 4's existing fuzzy matching is sufficient. Do not build a neural network or complex NLP system for parameter resolution.
- **Trying to read wavetable data:** Serum 2 wavetables are binary audio files. Phase 5 controls parameters, not wavetable content. Wavetable selection may be possible via parameter if Serum 2 exposes a "wavetable" parameter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parameter fuzzy matching | New fuzzy matcher | Phase 4's existing 3-tier resolution + alias pre-lookup | Already tested, handles prefix/contains matching |
| Preset file reading | Custom binary parser | `node-serum2-preset-packager` (if needed) or skip entirely | Reverse-engineered format is fragile; FL Studio API handles preset navigation |
| Preset navigation | Custom preset file loading | FL Studio `plugins.nextPreset()` / `plugins.prevPreset()` | Built-in API, no binary parsing needed |
| Parameter value normalization | Custom range mapping per param | FL Studio's 0.0-1.0 normalization | VST host handles normalization transparently |
| Sound categorization | ML-based sound classification | Static recipe definitions | Recipes are hand-curated for quality; ML adds complexity for no benefit |

**Key insight:** Phase 5 is primarily a **data authoring** problem, not an engineering problem. The hard infrastructure (SysEx, param cache, fuzzy matching, shadow state) is already built. Phase 5's value comes from (a) the alias map quality, (b) the recipe quality, and (c) reliable preset browsing. These are curated data, not complex algorithms.

## Common Pitfalls

### Pitfall 1: Serum 2 Parameter Names Unknown Until Runtime

**What goes wrong:** Building the entire alias map and recipe system based on assumed parameter names, only to discover that Serum 2 reports completely different names through FL Studio's API.
**Why it happens:** VST3 plugins can report parameter names differently than their internal naming convention. Serum 1's internal preset format uses names like `a_vol`, `fil_cutoff`, but FL Studio may report these as "Osc A Level", "Filter Cutoff", or something else entirely. Serum 2 adds a third oscillator and many new parameters not present in Serum 1.
**How to avoid:** **Start Phase 5 with a runtime discovery spike.** Load Serum 2 in FL Studio, run `discover_plugin_params`, and capture the complete parameter name list. Build everything else on top of this verified data.
**Warning signs:** Any Phase 5 code that references specific parameter names without citing the discovery spike output.

### Pitfall 2: Serum 2 Has More Parameters Than Serum 1

**What goes wrong:** Assuming Serum 2 has ~150 parameters (like Serum 1's ~299 preset parameters). Serum 2 added oscillator C, expanded to 10 LFOs, added granular/spectral/multisample oscillator types, 3 FX racks, 64 modulation slots, and more macros.
**Why it happens:** Serum 1 documentation is more widely available. Serum 2 has been out for a shorter time.
**How to avoid:** The discovery spike will reveal the actual count. Expect 300-500+ named parameters. The SysEx chunking from Phase 4 handles this (up to ~1800 bytes per chunk).
**Warning signs:** Alias map covers fewer than 100 parameters.

### Pitfall 3: Recipe Parameter Values Are Not Universal

**What goes wrong:** A recipe's parameter values produce the expected sound on one Serum 2 version but sound different on another, because parameter value scaling changed.
**Why it happens:** VST parameter values are normalized 0.0-1.0, but the mapping from normalized value to actual synth value (e.g., filter cutoff frequency in Hz) can change between plugin versions.
**How to avoid:** (a) Test recipes with the user's actual Serum 2 version. (b) Use moderate parameter values that sound reasonable even with scaling differences. (c) Document that recipes are starting points, not exact presets. (d) Consider providing a "recipe tuning" tool that adjusts individual recipe parameters.
**Warning signs:** Recipe sounds drastically different from description.

### Pitfall 4: Preset Folder Location Varies

**What goes wrong:** Preset filesystem browsing fails because the user's Serum 2 presets are not at the expected default path.
**Why it happens:** Users can configure custom preset folder locations in Serum 2's settings. The default is `~/Documents/Xfer/Serum 2 Presets/Presets` on Windows, but this is not guaranteed.
**How to avoid:** (a) Make the preset path configurable (environment variable or tool parameter). (b) Check if the default path exists before scanning. (c) Provide a helpful error message with instructions to set the path.
**Warning signs:** "Preset directory not found" errors on first use.

### Pitfall 5: getPresetCount / nextPreset May Not Work for VSTs

**What goes wrong:** FL Studio's `plugins.getPresetCount()` returns 0 or `plugins.nextPreset()` does nothing for Serum 2.
**Why it happens:** These API functions work reliably for FL Studio native plugins but VST3 plugin support is inconsistent. Some VSTs handle preset navigation internally.
**How to avoid:** Test these functions in the discovery spike. If they don't work for Serum 2, fall back to filesystem-only preset browsing. The user can be instructed to load presets via Serum 2's own browser.
**Warning signs:** `getPresetCount` returns 0 for a plugin with known presets.

### Pitfall 6: Oscillator Type Selection May Not Be a Simple Parameter

**What goes wrong:** Trying to change Serum 2's oscillator type (wavetable/sample/granular/spectral/multisample) via `setParamValue` doesn't work or produces unexpected results.
**Why it happens:** Oscillator type may be a discrete mode switch, not a continuous parameter. Some VST parameters are "lists" (discrete values) rather than continuous 0.0-1.0 ranges. The normalized value may need to be set to specific fractions (e.g., 0.0 = wavetable, 0.2 = sample, 0.4 = multisample, etc.).
**How to avoid:** During the discovery spike, identify which parameters are discrete selectors and document their valid values. Test each oscillator type switch to verify the correct normalized values.
**Warning signs:** Setting a parameter produces no audible change or switches to an unexpected mode.

## Code Examples

### Complete MCP Tool: serum_set_param with Alias Resolution

```typescript
// Source: Pattern combining Phase 4 tools + semantic aliases

import { resolveSemanticAlias } from '../plugins/serum/aliases.js';

server.tool(
  'serum_set_param',
  'Set a Serum 2 parameter using musical language.',
  {
    name: z.string().describe('Parameter name (e.g., "filter cutoff", "osc a level")'),
    value: z.number().min(0).max(1).describe('Normalized value 0.0-1.0'),
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel index where Serum 2 is loaded'),
  },
  async ({ name, value, channelIndex }) => {
    // Step 1: Serum-specific alias resolution
    const resolvedName = resolveSemanticAlias(name);

    // Step 2: Delegate to Phase 4 infrastructure
    // (auto-discover if needed, fuzzy match, shadow state update)
    let resolved = channelIndex !== undefined
      ? paramCache.resolveParam(channelIndex, -1, resolvedName)
      : undefined;

    if (!resolved) {
      const discovered = await autoDiscover(connection, channelIndex, -1);
      if (!discovered) {
        return { content: [{ type: 'text', text: 'Serum 2 not found. Make sure it is loaded on the specified channel.' }], isError: true };
      }
      resolved = paramCache.resolveParam(discovered.channelIndex, -1, resolvedName);
    }

    if (!resolved) {
      return { content: [{ type: 'text', text: `Parameter "${name}" not found in Serum 2.` }], isError: true };
    }

    // Step 3: Set the parameter
    await connection.executeCommand('plugins.set_param', {
      paramIndex: resolved.index,
      value,
      index: channelIndex,
      slotIndex: -1,
    });

    shadowState.set(channelIndex!, -1, resolved.index, value);

    return { content: [{ type: 'text', text: `Set Serum 2 "${resolved.name}" = ${(value * 100).toFixed(0)}%` }] };
  }
);
```

### FL Studio Preset Navigation (Python Handler)

```python
# Source: FL Studio API Stubs (IL-Group/FL-Studio-API-Stubs)

import plugins
import channels
import midi  # for FPN_Preset constant

def handle_plugin_next_preset(params):
    """Navigate to the next preset in the plugin's preset list."""
    index = params.get('index', channels.selectedChannel())
    slot_index = params.get('slotIndex', -1)

    if not plugins.isValid(index, slot_index):
        return {'success': False, 'error': f'No valid plugin at index {index}'}

    plugins.nextPreset(index, slot_index)

    # Retrieve new preset name using FPN_Preset flag (value=6)
    preset_name = plugins.getName(index, slot_index, midi.FPN_Preset, 0)

    return {
        'success': True,
        'presetName': preset_name,
        'channelIndex': index,
        'slotIndex': slot_index,
    }
```

### Recipe Application Pattern

```typescript
// Source: Project pattern based on existing tool wiring

async function applyRecipe(
  connection: ConnectionManager,
  recipe: SoundRecipe,
  channelIndex: number | undefined,
): Promise<{ applied: string[]; failed: string[] }> {
  const applied: string[] = [];
  const failed: string[] = [];

  for (const [paramName, value] of Object.entries(recipe.parameters)) {
    const resolvedName = resolveSemanticAlias(paramName);
    const actualChannel = channelIndex ?? 0;
    const resolved = paramCache.resolveParam(actualChannel, -1, resolvedName);

    if (!resolved) {
      failed.push(paramName);
      continue;
    }

    try {
      await connection.executeCommand('plugins.set_param', {
        paramIndex: resolved.index,
        value,
        index: actualChannel,
        slotIndex: -1,
      });
      shadowState.set(actualChannel, -1, resolved.index, value);
      applied.push(`${resolved.name} = ${(value * 100).toFixed(0)}%`);
    } catch {
      failed.push(paramName);
    }
  }

  return { applied, failed };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-plugin parameter dictionaries | Runtime discovery via FL Studio API | Phase 4 (built) | No static param tables needed |
| Serum 1 (.fxp) preset format | Serum 2 (.SerumPreset) format | Serum 2 release (2025) | New zstd+CBOR binary format, JSON-serializable |
| 2 oscillators (Serum 1) | 3 oscillators + 5 synthesis modes each (Serum 2) | Serum 2 release | Significantly more parameters to map |
| 4 LFOs (Serum 1) | 10 LFOs (Serum 2) | Serum 2 release | More modulation parameters |
| Simple FX chain | 3 FX racks with splitter routing (Serum 2) | Serum 2 release | More FX parameters, routing complexity |
| 4 macros (Serum 1) | 4-8 macros (Serum 2) | Serum 2 release | More macro control points |

**Deprecated/outdated:**
- Static parameter index dictionaries (like forgery810/vst-parameters): Unnecessary with runtime discovery.
- Serum 1 .fxp parsing: Serum 2 uses a new .SerumPreset format.
- Assumption of 2 oscillators: Serum 2 has 3 main oscillators.

## Open Questions

1. **Actual Serum 2 parameter names from FL Studio**
   - What we know: Serum 1's internal preset format uses abbreviated names (`a_vol`, `fil_cutoff`). FL Studio may report these differently via `plugins.getParamName()`.
   - What's unclear: The exact names Serum 2 reports through the VST3 host interface. Are they human-readable ("Osc A Level") or abbreviated ("a_vol")? How many named parameters does Serum 2 expose?
   - Recommendation: **Mandatory runtime discovery spike as first task.** Load Serum 2, run discover_plugin_params, capture full output. Everything else depends on this.
   - Confidence: LOW until spike is completed.

2. **FL Studio preset API support for Serum 2**
   - What we know: `plugins.getPresetCount()`, `plugins.nextPreset()`, `plugins.prevPreset()` exist in the API. They work for FL Studio native plugins.
   - What's unclear: Whether these functions work for Serum 2 (VST3). Some VSTs handle presets internally.
   - Recommendation: Test in the discovery spike. If they work, use them. If not, rely on filesystem-based preset browsing only.
   - Confidence: LOW until tested.

3. **Serum 2 oscillator type switching via parameter**
   - What we know: Serum 2 has 5 oscillator types per oscillator. These are likely exposed as a discrete parameter.
   - What's unclear: What parameter name controls oscillator type? What normalized values correspond to each type?
   - Recommendation: Test in discovery spike. Document the discrete values for each oscillator type.
   - Confidence: LOW until tested.

4. **Serum 2 preset folder location reliability**
   - What we know: Default is `~/Documents/Xfer/Serum 2 Presets/Presets` on Windows. Users can change this.
   - What's unclear: How to detect the actual folder if it's been moved. Serum 2 may store this in a config file or registry.
   - Recommendation: Default to the standard path. Make it configurable via environment variable. Provide clear error if not found.
   - Confidence: MEDIUM (default path is well-documented).

5. **Wavetable selection as a parameter**
   - What we know: Wavetable position (`wt_pos`) is a continuous parameter. But selecting WHICH wavetable is loaded may not be exposed as a standard VST parameter.
   - What's unclear: Can the loaded wavetable be changed via `setParamValue`? Or does it require Serum's internal browser?
   - Recommendation: Check in discovery spike. If wavetable selection is not a parameter, document as a limitation and instruct user to select wavetables manually.
   - Confidence: LOW.

6. **Recipe value accuracy across Serum 2 versions**
   - What we know: Parameter values are 0.0-1.0 normalized. The mapping to actual synthesis values (Hz, ms, etc.) is internal to Serum 2.
   - What's unclear: Whether normalized values produce consistent sonic results across Serum 2 patch versions.
   - Recommendation: Treat recipes as starting points. Include a description of what the sound should be, so users can fine-tune.
   - Confidence: MEDIUM (VST normalization is generally stable within major versions).

## Serum 2 Architecture Reference

This section documents Serum 2's known architecture for use by the planner.

### Signal Path
- **3 Main Oscillators** (A, B, C) -- each supports 5 synthesis types
- **Sub Oscillator** -- simple waveform (sine, saw, square, triangle)
- **Noise Oscillator** -- noise generator with pitch control
- **2 Filters** -- series or parallel routing, analog/digital/distortion types
- **3 FX Racks** (Main, Bus 1, Bus 2) -- parallel processing with splitter routing
- **Master output**

### Oscillator Types (each of the 3 main oscillators)
1. **Wavetable** -- Classic Serum wavetable with position, warp modes, unison
2. **Multisample (SFZ)** -- Real instrument layers with velocity mapping
3. **Sample** -- Single sample with loop, slice, tails modes
4. **Granular** -- Grain-based synthesis from audio
5. **Spectral** -- Harmonic resynthesis of audio

### Modulation System
- **4 Envelopes** (Env 1 hardwired to amplitude)
- **10 LFOs** with custom shapes, chaos modes, path mode
- **64 Modulation Slots** (source -> destination -> amount)
- **4-8 Macros** (macros can control other macros)

### Effects (per FX rack)
Known effects: Reverb (Nitrous/Vintage/Basin), Delay (HQ), Chorus, Flanger, Phaser, Distortion/Overdrive, Compressor, EQ, Filter, Echobode (frequency shifter), Convolve, Hyperspace

### Preset System
- **File format:** `.SerumPreset` (zstd-compressed CBOR with XferJson header)
- **Default location (Windows):** `C:\Users\{user}\Documents\Xfer\Serum 2 Presets\Presets\`
- **Organization:** Subfolder-based categories (Bass, Leads, Pads, Plucks, Keys, FX, etc.)
- **Legacy support:** Also reads Serum 1 `.fxp` presets
- **Factory presets:** 626+ presets, 288 wavetables

## Sources

### Primary (HIGH confidence)
- [FL Studio API Stubs - plugins module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/plugins/) - getParamName, getParamValue, setParamValue, getPresetCount, nextPreset, prevPreset, getName flags (FPN_Preset = 6)
- [FL Studio API Stubs - getName flags](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/midi/plugin%20get%20name%20flags/) - FPN_Param(0), FPN_ParamValue(1), FPN_Preset(6), etc.
- [Xfer Records Serum 2 product page](https://xferrecords.com/products/serum-2) - Official feature list, oscillator types, synthesis modes
- Phase 4 implementation (already in codebase) - param-cache.ts, shadow-state.ts, plugins.ts, handlers/plugins.py

### Secondary (MEDIUM confidence)
- [EDMProd Serum 2 Guide](https://www.edmprod.com/serum-2-guide/) - Interface organization: 5 views (Osc, Mix, FX, Matrix, Global), 3 oscillators + sub + noise, 4 envelopes, 10 LFOs, 4 macros
- [Sonic Weaponry Serum 2 Breakdown](https://sonic-weaponry.com/blogs/free-production-tutorials-and-resources/serum-2-released) - Dual filters, 3 FX racks, new effects list, modulation enhancements
- [node-serum2-preset-packager](https://github.com/CharlesBT/node-serum2-preset-packager) - TypeScript preset decoder, JSON structure: Oscillator0-4, Env0-3, LFO0-9, FXRack0-2, ModSlot0-63, Macro0-7
- [Serum preset format reverse engineering](https://gist.github.com/0xdevalias/135a18e979ac8e302ebbc700a50a8d74) - 299 parameters in Serum 1, parameter naming conventions (a_vol, fil_cutoff, env1_atk)
- [KennethWussmann serum-preset-packager](https://github.com/KennethWussmann/serum-preset-packager) - Binary format: XferJson header + zstd-compressed CBOR payload

### Tertiary (LOW confidence)
- Serum 1 parameter names (a_vol, b_vol, fil_cutoff, etc.) -- from preset format reverse engineering, may not match FL Studio's reported names
- Community sound design recipes (warm pad, supersaw lead values) -- approximate guidelines, not exact parameter values
- FL Studio preset API behavior for VST3 plugins -- documented in API stubs but untested with Serum 2 specifically

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Built on verified Phase 4 infrastructure
- Architecture (semantic aliases): MEDIUM - Pattern is sound, but actual data depends on discovery spike
- Architecture (recipes): MEDIUM - Pattern is sound, but parameter names and values need verification
- Architecture (presets): MEDIUM - FL Studio API verified, but Serum 2 compatibility untested
- Pitfalls: HIGH - Based on concrete analysis of known unknowns
- Serum 2 architecture: MEDIUM - Verified from multiple official and community sources

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (Serum 2 is stable; FL Studio API changes are infrequent)
