---
phase: 04-generic-plugin-control
plan: 01
subsystem: protocol
tags: [sysex, chunking, midi, rtmidi, buffer-limit]

# Dependency graph
requires:
  - phase: 01-foundation-communication
    provides: SysEx protocol layer (sysex.py, sysex-codec.ts, midi-client.ts)
provides:
  - Transparent SysEx response chunking for payloads exceeding 2048 bytes
  - build_chunked_sysex_response Python function
  - Chunk accumulation and reassembly in TypeScript MidiClient
affects:
  - 04-02 (plugin parameter handlers rely on chunked responses)
  - 04-03 (MCP plugin tools will receive large discovery payloads)
  - Any future handler producing responses > 1800 bytes base64

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chunked SysEx: continuation byte 0x01 for intermediate, 0x00 for final"
    - "MAX_PAYLOAD_BYTES=1800 keeps each chunk under RtMidi 2048 buffer"
    - "Per-clientId chunk buffer accumulation in MidiClient"

key-files:
  created: []
  modified:
    - fl-bridge/protocol/sysex.py
    - fl-bridge/device_FLBridge.py
    - src/bridge/midi-client.ts

key-decisions:
  - "1800 byte payload limit (conservative margin under 2048 RtMidi buffer)"
  - "Chunking lives in protocol layer, transparent to handlers and codec"
  - "build_sysex_response preserved unchanged for backward compatibility"

patterns-established:
  - "Chunked sending: build_chunked_sysex_response returns List[List[int]], caller iterates"
  - "Chunk reassembly: MidiClient accumulates per-clientId, builds synthetic message for codec"
  - "Plugin handler import: separate try/except with graceful fallback"

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 4 Plan 01: SysEx Response Chunking Summary

**Transparent SysEx chunking layer splitting large FL Studio responses into sub-2048-byte chunks with Python-side splitting and TypeScript-side reassembly**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T06:35:37Z
- **Completed:** 2026-02-24T06:38:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `build_chunked_sysex_response` to sysex.py that transparently splits large base64 payloads into multiple SysEx messages under 1808 bytes each
- Updated `device_FLBridge.py` to send all responses via the chunked API, with per-chunk debug logging
- Added chunk accumulation buffer and reassembly logic to TypeScript MidiClient, combining multi-chunk responses into a single synthetic message for codec decoding
- Small responses (under 1800 bytes base64) produce exactly 1 chunk, identical to the original `build_sysex_response` output -- zero behavioral change for existing commands
- Verified: 200-parameter payload (typical VST discovery) correctly chunks into 9 messages and reassembles perfectly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add chunked SysEx response building (Python) and update FL Bridge sender** - `ec8fce8` (feat)
2. **Task 2: Add chunk accumulation and reassembly (TypeScript)** - `4f7634b` (feat)

## Files Created/Modified
- `fl-bridge/protocol/sysex.py` - Added MAX_PAYLOAD_BYTES constant and build_chunked_sysex_response function
- `fl-bridge/device_FLBridge.py` - Updated OnSysEx to use chunked sending, added plugin handler import with fallback
- `src/bridge/midi-client.ts` - Added chunkBuffers Map, continuation byte branching in handleMessage, buffer cleanup in disconnect

## Decisions Made
- **MAX_PAYLOAD_BYTES = 1800:** Conservative limit leaving 248 bytes of headroom under the 2048-byte RtMidi buffer (8 bytes header/footer + safety margin). Matches the approach in the research doc.
- **Chunking transparent to SysExCodec:** The codec already handles any valid SysEx message. Reassembly builds a synthetic complete message before passing to decode, so sysex-codec.ts required zero modifications.
- **Preserved build_sysex_response:** The original single-message function is unchanged. It is still used by OnIdle queue processing and potentially by other callers. The chunked version is an addition, not a replacement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Chunked protocol layer is complete and ready for Plan 02 (plugin parameter handlers)
- Plugin handler import in device_FLBridge.py will auto-detect handlers/plugins.py when it exists
- All existing transport, state, patterns, and pianoroll commands continue working unchanged

---
*Phase: 04-generic-plugin-control*
*Completed: 2026-02-24*
