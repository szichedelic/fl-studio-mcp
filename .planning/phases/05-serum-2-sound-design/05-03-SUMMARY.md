---
phase: 05-serum-2-sound-design
plan: 03
subsystem: serum-tools
completed: 2026-02-24
duration: ~3 min
tags: [serum, mcp-tools, sound-design, presets, recipes]

requires:
  - "05-01 (semantic aliases, alias resolution)"
  - "05-02 (recipes, presets, preset navigation)"
  - "04-03 (plugin param tools, auto-discover pattern)"

provides:
  - "6 Serum 2 MCP tools: serum_set_param, serum_apply_recipe, serum_browse_presets, serum_next_preset, serum_prev_preset, serum_list_recipes"
  - "registerSerumTools function exported for tool registration"

affects:
  - "Phase 6 (audio rendering) may use Serum tools for sound setup"
  - "Phase 7 (sample management) may reference Serum preset browsing"

tech-stack:
  added: []
  patterns:
    - "Semantic alias pre-resolution before fuzzy param matching"
    - "Recipe batch-apply with per-parameter error tracking"

key-files:
  created:
    - src/tools/serum.ts
  modified:
    - src/tools/index.ts

decisions:
  - id: "05-03-01"
    description: "Serum tools use slotIndex=-1 (channel rack plugin, not mixer effect)"
  - id: "05-03-02"
    description: "Recipe apply reports partial success (tracks applied vs failed params individually)"
  - id: "05-03-03"
    description: "Preset browse groups results by category with truncation to limit"

metrics:
  tasks: 2
  commits: 2
  lines-added: ~505
  duration: ~3 min
---

# Phase 5 Plan 3: Serum 2 MCP Tools Summary

Serum 2 MCP tools wiring semantic aliases, recipes, and preset browsing into 6 user-facing tools registered with the MCP server.

## What Was Done

### Task 1: Create Serum 2 MCP tools (src/tools/serum.ts)

Created 502-line file with 6 MCP tools following the exact pattern from `registerPluginTools` in `src/tools/plugins.ts`:

1. **serum_set_param** - Sets Serum 2 parameters using musical language. Resolves semantic aliases (e.g., "filter cutoff" -> "Filter 1 Freq") before param cache lookup. Auto-discovers on cache miss. Reports alias resolution in response.

2. **serum_apply_recipe** - Applies a multi-parameter sound recipe. Searches recipes via `findRecipes()`, auto-discovers params, then iterates all recipe parameters with individual error tracking. Reports applied/failed counts.

3. **serum_browse_presets** - Scans filesystem for .fxp/.SerumPreset files. Groups results by category. Handles empty results with helpful message about SERUM2_PRESET_DIR env var.

4. **serum_next_preset** / **serum_prev_preset** - Navigate presets via FL Bridge commands (plugins.next_preset / plugins.prev_preset).

5. **serum_list_recipes** - Lists available recipes with optional category filter. Shows name, category, description, parameter count, and tags.

Includes local copy of `autoDiscover` helper (same logic as plugins.ts, not exported) and `formatAvailableParams` for error messages.

### Task 2: Register Serum tools in tools index (src/tools/index.ts)

Added import and call for `registerSerumTools` in the central `registerTools` function. Updated console log to include "serum" in the registered tools list.

## Key Links Verified

| From | To | Via | Count |
|------|----|-----|-------|
| src/tools/serum.ts | src/plugins/serum/aliases.ts | resolveSemanticAlias | 3 |
| src/tools/serum.ts | src/plugins/serum/recipes.ts | findRecipes, RECIPES, listRecipeNames | 3 |
| src/tools/serum.ts | src/plugins/serum/presets.ts | listSerumPresets, getSerumPresetDir | 2 |
| src/tools/serum.ts | src/bridge/connection.ts | connection.executeCommand | 5 |
| src/tools/index.ts | src/tools/serum.ts | registerSerumTools | 2 |

## Decisions Made

1. **slotIndex=-1 for all Serum tools** - Serum 2 is always a channel rack instrument plugin, never a mixer effect slot. Hardcoded to -1 rather than exposing as parameter.

2. **Partial success tracking for recipe apply** - Each parameter in a recipe is set individually with try/catch. The response reports both applied and failed parameter counts so users know exactly what worked.

3. **Preset browse groups by category** - Rather than a flat list, presets are grouped by their parent folder (category) for readable output. Truncated to limit (default 20).

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript build passes cleanly (`npm run build`)
- All 6 tools registered and callable
- All key_links patterns verified via grep
- File exceeds min_lines requirement (502 > 100)
- index.ts contains registerSerumTools import and call

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 1ddbd77 | feat(05-03): create Serum 2 MCP tools for sound design control |
| 2 | 5823ad3 | feat(05-03): register Serum tools in tools index |

## Phase 5 Completion

This is the final plan (3/3) in Phase 5 (Serum 2 Sound Design). The phase is now complete:
- 05-01: Semantic aliases (144 entries, O(1) Map resolution)
- 05-02: Recipes (6 sound presets), presets (filesystem scanner), preset navigation
- 05-03: MCP tools (6 tools wiring it all together)

Users can now control Serum 2 via natural language through the MCP interface.
