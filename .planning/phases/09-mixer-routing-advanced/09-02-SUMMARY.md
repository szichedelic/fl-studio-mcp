---
phase: 09-mixer-routing-advanced
plan: 02
subsystem: mixer-tools
tags: [routing, eq, effects, mcp-tools]

requires:
  - 08-mixer-core (mixer.ts foundation)
  - 06-plugin-control (paramCache, shadowState)

provides:
  - 10 new MCP tools for mixer routing, EQ, and effect slots
  - Multi-format level input (normalized, percent, dB)
  - Track reference by index OR name

affects:
  - Phase 10-11: May want similar name/index flexibility for playlist tracks
  - Future: Could extend EQ tools with preset loading

tech-stack:
  added: []
  patterns:
    - z.union for multi-type parameters (index | name)
    - Level format conversion helper for audio-centric inputs

key-files:
  created: []
  modified:
    - src/tools/mixer.ts

decisions:
  - "Level normalization: 0dB = 0.8 normalized, using 10^(dB/50) * 0.8 formula"
  - "Track params accept BOTH index and name via z.union"
  - "Effect slot tools reuse existing paramCache with track=channelIndex"
  - "shadowState updated on set_mixer_effect_param for reliable value tracking"

metrics:
  duration: "~3 minutes"
  completed: "2026-02-25"
---

# Phase 09 Plan 02: Mixer Tools Summary

**One-liner:** Added 10 MCP tools for mixer routing, EQ, and effect slot access with multi-format level support and name/index track references.

## What was Built

### Routing Tools (5 tools)

| Tool | Purpose | Key Features |
|------|---------|--------------|
| `get_mixer_routing` | Full routing table | Returns all active send routes |
| `get_track_sends` | Sends for one track | Accepts index OR name |
| `create_send` | Create send route | Multi-format level (normalized/percent/dB) |
| `remove_send` | Remove send route | Accepts index OR name for source/dest |
| `set_send_level` | Set send level | Requires at least one level format |

### EQ Tools (2 tools)

| Tool | Purpose | Key Features |
|------|---------|--------------|
| `get_mixer_eq` | Get track EQ | Returns 3 bands with gain/freq/bandwidth |
| `set_mixer_eq_band` | Set EQ band params | Band 0=Low, 1=Mid, 2=High |

### Effect Slot Tools (3 tools)

| Tool | Purpose | Key Features |
|------|---------|--------------|
| `discover_mixer_effect` | Discover plugin in slot | Caches params in paramCache |
| `get_mixer_effect_param` | Get param by name | Fuzzy name resolution |
| `set_mixer_effect_param` | Set param by name | Updates shadowState |

### Level Format Conversion

Added `normalizeSendLevel()` helper supporting:
- **Normalized:** 0-1 directly (0.8 = 0dB unity)
- **Percentage:** 0-100 maps to 0-1
- **Decibels:** -60 to +6 dB using `0.8 * 10^(dB/50)` formula

## Design Decisions

### Track Reference Flexibility

Per user decision, all tools that reference mixer tracks accept BOTH formats:
- `track: 5` - Direct index (0=Master, 1+=inserts)
- `track: "Reverb Bus"` - Name lookup (handler resolves)

Implemented via `z.union([z.number().int().min(0), z.string()])`.

### Effect Slot Integration

For mixer effect slots, the `track` parameter maps directly to `channelIndex` in the plugin infrastructure:
- `paramCache.store(track, slot, ...)` - track IS channelIndex
- `paramCache.resolveParam(track, slot, name)` - same mapping
- `shadowState.set(track, slot, paramIndex, value)` - consistent

This works because FL Studio uses mixer track index as the channel index when accessing plugins in mixer effect slots.

## Manual Testing Guide

### Effect Slot Tools Test Flow

To verify effect slot tools work correctly:

1. **Discover plugin:**
   ```
   discover_mixer_effect(track: 1, slot: 0)
   ```
   Expected: Returns plugin name, param count; stores in paramCache

2. **Get param by name:**
   ```
   get_mixer_effect_param(track: 1, slot: 0, name: "mix")
   ```
   Expected: Fuzzy matches (e.g., "Dry/Wet Mix"), returns value

3. **Set param:**
   ```
   set_mixer_effect_param(track: 1, slot: 0, name: "mix", value: 0.75)
   ```
   Expected: Sets in FL Studio, updates shadowState

4. **Error handling:**
   - Call get/set without discover: Returns clear error message
   - Invalid param name: Returns list of available params

### Routing Tools Test Flow

1. **Create send with dB level:**
   ```
   create_send(source: 1, destination: 2, levelDb: -6)
   ```
   Expected: Creates route at approximately 0.63 normalized

2. **Verify routing:**
   ```
   get_mixer_routing()
   ```
   Expected: Shows new route in table

3. **Adjust level:**
   ```
   set_send_level(source: 1, destination: 2, levelPercent: 50)
   ```
   Expected: Sets to 0.5 normalized

## Commits

| Commit | Description |
|--------|-------------|
| `de811d2` | feat(09-02): add mixer routing tools with level format conversion |
| `e0eee4e` | feat(09-02): add mixer EQ tools |
| `a70e4da` | feat(09-02): add mixer effect slot convenience tools |

## Deviations from Plan

None - plan executed exactly as written.

## Known Limitations

1. **Pre/post fader sends:** Not supported - FL Studio API limitation (documented in CONTEXT.md)
2. **EQ preset loading:** Not implemented - would require additional handler work
3. **Effect slot name lookup:** Uses index only (no name resolution for mixer tracks in effect slot tools)

## Verification Results

- Tool count: 16 (6 original + 5 routing + 2 EQ + 3 effect slot)
- TypeScript build: Success, no errors
- All tools use proper Zod schemas with z.union where applicable
- normalizeSendLevel handles all three input formats
- paramCache integration uses correct track=channelIndex mapping

## Next Phase Readiness

Phase 9 Plan 02 complete. Ready for Phase 10 (Playlist & Markers).

No blockers or concerns for next phase.
