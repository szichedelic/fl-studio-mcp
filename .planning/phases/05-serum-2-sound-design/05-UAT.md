---
status: testing
phase: 05-serum-2-sound-design
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md
started: 2026-02-24T09:15:00Z
updated: 2026-02-24T09:15:00Z
---

## Current Test

number: 1
name: Set Serum 2 parameter by semantic name
expected: |
  Using `serum_set_param` with name "filter cutoff" and value 0.4, the tool should:
  - Resolve "filter cutoff" to "Filter 1 Freq" (semantic alias)
  - Set the parameter in Serum 2
  - Report success with the resolved parameter name
  - Serum 2's Filter 1 cutoff knob should visually move to ~40%
awaiting: user response

## Tests

### 1. Set Serum 2 parameter by semantic name
expected: Using serum_set_param with "filter cutoff" value 0.4, resolves to "Filter 1 Freq", sets successfully, Serum 2 filter knob moves to ~40%
result: [pending]

### 2. Apply a sound design recipe
expected: Using serum_apply_recipe with "warm pad", applies 20+ parameters at once, reports how many were applied vs failed, Serum 2 audibly changes character
result: [pending]

### 3. List available recipes
expected: Using serum_list_recipes, shows all 6 recipes with names, categories, descriptions, and tags
result: [pending]

### 4. Browse presets on filesystem
expected: Using serum_browse_presets, returns a list of Serum 2 presets grouped by category (Bass, Leads, Pads, etc.) from the local preset directory
result: [pending]

### 5. Navigate to next preset
expected: Using serum_next_preset, Serum 2 advances to the next preset, tool reports the new preset name
result: [pending]

### 6. Navigate to previous preset
expected: Using serum_prev_preset, Serum 2 goes back to previous preset, tool reports the new preset name
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
