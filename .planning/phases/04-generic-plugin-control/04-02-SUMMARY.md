---
phase: 04-generic-plugin-control
plan: 02
subsystem: plugins
tags: [fl-studio, plugins, parameters, cache, shadow-state, vst]

# Dependency graph
requires:
  - phase: 01-foundation-communication
    provides: SysEx protocol layer, handler registration pattern
  - phase: 04-generic-plugin-control
    plan: 01
    provides: SysEx response chunking for large plugin parameter payloads
provides:
  - FL Bridge commands: plugins.discover, plugins.get_param, plugins.set_param
  - TypeScript ParamCache with 3-tier fuzzy name resolution
  - TypeScript ShadowState tracking user-set vs discovered parameter values
  - Plugin type definitions (PluginParamInfo, DiscoveredParam, CachedPlugin, ShadowValue)
affects:
  - 04-03 (MCP tool wiring uses these handlers and TypeScript modules)
  - 05-serum-integration (Serum-specific tools build on generic plugin infrastructure)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plugin handler pattern: try/except with module-None guard, register_handler at bottom"
    - "ParamCache 3-tier name resolution: exact -> prefix -> contains (case-insensitive)"
    - "ShadowState source tracking: 'user' values preserved over 'discovered' on re-scan"
    - "Cache key format: channelIndex:slotIndex for plugins, channelIndex:slotIndex:paramIndex for shadow"

key-files:
  created:
    - fl-bridge/handlers/plugins.py
    - src/plugins/types.ts
    - src/plugins/param-cache.ts
    - src/plugins/shadow-state.ts
  modified: []

key-decisions:
  - "setParamValue arg order enforced: value FIRST, then paramIndex (FL Studio API convention)"
  - "Three-tier name resolution: exact, prefix (bidirectional), contains (bidirectional)"
  - "Shadow state preserves user-set values during discovery re-population"
  - "Singleton exports (paramCache, shadowState) for application-wide use"

patterns-established:
  - "Plugin handler: validate module availability, params, plugin validity, param range, then operate"
  - "Cache store() builds lowercase paramsByName Map from DiscoveredParam array"
  - "ShadowState.populateFromDiscovery only overwrites source='discovered', never source='user'"

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 4 Plan 02: Plugin Parameter Backend Summary

**Python plugin handlers (discover/get/set) with TypeScript parameter cache (3-tier name resolution) and shadow state (user vs discovered tracking)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T06:40:55Z
- **Completed:** 2026-02-24T06:43:21Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Created three FL Bridge command handlers for plugin parameter control: discover (iterates all 4240 slots, filters to named params), get_param (reads single param with display string), set_param (writes with correct value-first argument order)
- Built TypeScript ParamCache with three-tier case-insensitive name resolution (exact match, prefix match, contains match) to avoid repeated 4240-slot scans
- Built TypeScript ShadowState that tracks user-set values separately from discovered values, preserving user values when discovery re-populates
- All modules follow existing project patterns: Python handlers match transport.py structure, TypeScript modules use NodeNext resolution with .js imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Python plugin handlers for FL Bridge** - `a6269ab` (feat)
2. **Task 2: Create TypeScript plugin types, parameter cache, and shadow state** - `584bff0` (feat)

## Files Created/Modified
- `fl-bridge/handlers/plugins.py` - Plugin discover, get_param, set_param command handlers with register_handler registration
- `src/plugins/types.ts` - PluginParamInfo, DiscoveredParam, CachedPlugin, ShadowValue interfaces
- `src/plugins/param-cache.ts` - ParamCache class with store/get/resolveParam/invalidate/has + paramCache singleton
- `src/plugins/shadow-state.ts` - ShadowState class with set/get/populateFromDiscovery/clear + shadowState singleton

## Decisions Made
- **setParamValue argument order:** Explicitly enforced value as first argument per FL Studio API convention, with multiple code comments as guardrails
- **Three-tier name resolution:** Exact -> prefix -> contains, each bidirectional (e.g., "cutoff" matches "filter cutoff" via contains, and "filter cutoff freq" matches "filter cutoff" via prefix). Sufficient for Phase 4; Phase 5 can add Fuse.js if needed
- **Singleton exports:** Both paramCache and shadowState exported as singletons for simple application-wide access without dependency injection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three FL Bridge commands ready for MCP tool wiring in Plan 03
- ParamCache and ShadowState singletons ready for import in MCP tool handlers
- device_FLBridge.py already has plugin handler import (added in Plan 01) that will auto-detect handlers/plugins.py

---
*Phase: 04-generic-plugin-control*
*Completed: 2026-02-24*
