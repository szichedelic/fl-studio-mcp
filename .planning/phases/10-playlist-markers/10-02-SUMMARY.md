# Phase 10 Plan 02: Marker Management Summary

---
phase: 10-playlist-markers
plan: 02
subsystem: playlist-markers
tags: [markers, arrangement, navigation, time-markers]

dependency-graph:
  requires: [10-01]
  provides: [marker-handlers, marker-tools, marker-navigation]
  affects: [10-03]

tech-stack:
  added: []
  patterns: [marker-iteration, bar-to-ticks-conversion, relative-marker-navigation]

key-files:
  created: []
  modified:
    - fl-bridge/handlers/playlist.py
    - src/tools/playlist.ts

decisions:
  - id: marker-iteration
    choice: "Iterate until empty string with index > 999 safety limit"
    reason: "No markerCount() API exists - must iterate until getMarkerName returns empty"
  - id: bar-conversion
    choice: "Use (bar - 1) * 4 * PPQ formula for bar-to-ticks"
    reason: "Markers use absolute ticks; bar is 1-indexed; assumes 4/4 time"
  - id: relative-navigation
    choice: "Use jumpToMarker(1, True) after finding marker"
    reason: "API only supports relative delta navigation, not absolute index"

metrics:
  duration: "~5 minutes"
  completed: 2026-02-25
---

**One-liner:** Marker management handlers and MCP tools using iteration-based enumeration and bar-to-ticks conversion

## What Was Built

Extended the playlist module with time marker management capabilities:

### Python Handlers (fl-bridge/handlers/playlist.py)

| Handler | Purpose | Key Detail |
|---------|---------|------------|
| `playlist.list_markers` | List all project markers | Iterates until empty string (no markerCount API) |
| `playlist.add_marker` | Add marker at bar/position | Converts bar to ticks: `(bar-1) * 4 * PPQ` |
| `playlist.jump_to_marker` | Navigate to marker | Finds by name/index, uses relative jump |

### MCP Tools (src/tools/playlist.ts)

| Tool | Parameters | Description |
|------|------------|-------------|
| `list_markers` | none | Returns all markers with indices and names |
| `add_marker` | `name`, `bar?` | Creates marker at bar (1-indexed) or current position |
| `jump_to_marker` | `name?`, `index?` | Navigates by name (partial match) or index (0-indexed) |

## Key Implementation Details

### Marker Iteration Pattern
```python
markers = []
index = 0
while True:
    name = arrangement.getMarkerName(index)
    if not name:  # Empty string = no more markers
        break
    markers.append({'index': index, 'name': name})
    index += 1
    if index > 999:  # Safety limit
        break
```

### Bar-to-Ticks Conversion
```python
ppq = general.getRecPPQ()
ticks = (bar - 1) * 4 * ppq  # Bar 1 = tick 0, assumes 4/4 time
```

### API Limitations Documented
- No `markerCount()` function exists - must iterate
- `jumpToMarker(delta, select)` uses RELATIVE delta, not absolute index
- No API to get marker time position after creation
- No marker deletion API

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 3f8264e | feat | Add marker handlers to playlist.py |
| dfef2d6 | feat | Add marker MCP tools to playlist.ts |

## Files Modified

### fl-bridge/handlers/playlist.py
- Added imports: `arrangement`, `transport`, `general`
- Added `handle_playlist_list_markers()` with iteration pattern
- Added `handle_playlist_add_marker()` with bar-to-ticks conversion
- Added `handle_playlist_jump_to_marker()` with name/index lookup
- Registered 3 new handlers

### src/tools/playlist.ts
- Updated module docstring with marker tools
- Added `list_markers` tool (no params)
- Added `add_marker` tool (name required, bar optional)
- Added `jump_to_marker` tool (name or index required)

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript build | Pass |
| Python syntax | Pass |
| Handler registration (3 markers) | Pass |
| MCP tools (3 markers) | Pass |
| Safety limit present | Pass (2 occurrences) |

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Status

- [x] `playlist.py` has 3 new marker handlers (list, add, jump)
- [x] `playlist.ts` has 3 new marker tools (list_markers, add_marker, jump_to_marker)
- [x] Marker enumeration uses iteration (not hardcoded count)
- [x] Bar-to-ticks conversion uses `general.getRecPPQ()`
- [x] Safety limit prevents infinite loops in marker iteration
- [x] TypeScript builds successfully

## Next Phase Readiness

Ready for Plan 10-03 (Performance Mode / Live Clips):
- Playlist module fully initialized with all imports
- Handler registration pattern established
- MCP tool pattern established
- No blockers identified
