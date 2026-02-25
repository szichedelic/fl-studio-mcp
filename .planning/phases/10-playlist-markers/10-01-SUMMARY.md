---
phase: 10-playlist-markers
plan: 01
subsystem: playlist
tags: [playlist, tracks, mute, solo, color, naming]
requires:
  - 08-mixer-core (established handler pattern)
  - 09-mixer-routing (established routing/color patterns)
provides:
  - Playlist track query (get_tracks)
  - Playlist track mute/solo control
  - Playlist track naming
  - Playlist track coloring
affects:
  - 10-02 (markers will use similar patterns)
tech-stack:
  added: []
  patterns:
    - 1-indexed playlist tracks (vs 0-indexed mixer)
    - Explicit mute/solo values (1/0, not toggle)
    - RGB hex to BGR conversion for colors
key-files:
  created:
    - fl-bridge/handlers/playlist.py
    - src/tools/playlist.ts
  modified:
    - fl-bridge/handlers/__init__.py
    - src/tools/index.ts
decisions:
  - key: playlist-indexing
    choice: 1-indexed (matching FL Studio API)
    reason: Playlist tracks start at 1 in FL Studio, unlike mixer (0=Master)
metrics:
  duration: ~5 minutes
  completed: 2026-02-25
---

# Phase 10 Plan 01: Playlist Track Management Summary

Playlist track handlers and MCP tools for querying, muting, soloing, renaming, and coloring playlist tracks.

## One-liner

Playlist track management with 1-indexed validation, explicit mute/solo (not toggle), and RGB-to-BGR color conversion.

## Objective Achieved

Created complete playlist track management functionality enabling users to:
- Query all playlist tracks with name, color, mute, and solo states
- Mute/unmute playlist tracks by index
- Solo/unsolo playlist tracks by index
- Rename playlist tracks
- Set playlist track colors

## Implementation Summary

### Python Handlers (fl-bridge/handlers/playlist.py)

Created 5 handlers following the mixer.py pattern:

1. **playlist.get_tracks**: Returns all tracks with index, name, color, muted, solo state
2. **playlist.mute**: Explicit mute control (1/0, not toggle)
3. **playlist.solo**: Explicit solo control with grouped tracks param
4. **playlist.set_name**: Set track name (empty string resets)
5. **playlist.set_color**: Set track color in BGR format

Key implementation details:
- `_validate_playlist_track()` helper validates 1-indexed bounds
- All handlers use try/except with proper error responses
- Readback after every mutation for confirmation

### TypeScript Tools (src/tools/playlist.ts)

Created 5 MCP tools mirroring the Python handlers:

1. **get_playlist_tracks**: No parameters, returns all track data
2. **mute_playlist_track**: track (min 1), mute boolean
3. **solo_playlist_track**: track (min 1), solo boolean
4. **set_playlist_track_name**: track (min 1), name string
5. **set_playlist_track_color**: track (min 1), color as RGB hex

Key implementation details:
- All tools use `z.number().int().min(1)` for 1-indexed validation
- `rgbHexToBgr()` function converts user-friendly RGB hex to FL Studio BGR
- Standard error handling pattern (try/catch, isError flag)

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Track indexing | 1-indexed (min: 1) | Matches FL Studio playlist API (unlike mixer which is 0-indexed) |
| Mute/solo mode | Explicit 1/0 | Toggle mode (-1) is stateless/unpredictable |
| Color input | RGB hex string | User-friendly, consistent with mixer tools |
| Solo grouped | False | Don't affect grouped tracks by default |

## Files Changed

### Created
- `fl-bridge/handlers/playlist.py` (311 lines) - 5 handlers with validation
- `src/tools/playlist.ts` (233 lines) - 5 MCP tools with color conversion

### Modified
- `fl-bridge/handlers/__init__.py` - Added playlist import
- `src/tools/index.ts` - Added playlist registration

## Verification Results

| Check | Result |
|-------|--------|
| TypeScript builds | PASS |
| Python syntax | PASS |
| 5 handlers registered | PASS |
| 5 MCP tools exported | PASS |
| 1-indexed validation | PASS |
| Explicit mute/solo | PASS |
| BGR color conversion | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

1. `07d9bb4` - feat(10-01): add playlist track management handlers
2. `26f8e90` - feat(10-01): add playlist track MCP tools

## Next Phase Readiness

Ready for 10-02 (Markers) which will add:
- Arrangement markers (add, list, delete, jump)
- Time signature markers
- These will follow similar patterns established here
