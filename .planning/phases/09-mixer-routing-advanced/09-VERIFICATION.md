---
phase: 09-mixer-routing-advanced
verified: 2026-02-25T21:10:37Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "User can create sends from any track to any bus"
    status: failed
    reason: "TypeScript tools pass wrong parameter names to Python handlers"
    artifacts:
      - path: "src/tools/mixer.ts"
        issue: "create_send, remove_send, set_send_level spread sourceParam/destParam incorrectly"
    missing:
      - "Fix parameter names: sourceParam should be {source: N} not {sourceIndex: N}"
      - "Fix parameter names: destParam should be {destination: N} not {destIndex: N}"
  - truth: "User can set send levels per route"
    status: failed
    reason: "Same parameter naming mismatch as create_send"
    artifacts:
      - path: "src/tools/mixer.ts"
        issue: "set_send_level passes sourceIndex/destIndex instead of source/destination"
    missing:
      - "Fix parameter names to match Python handler expectations"
---

# Phase 09: Mixer Routing & Advanced Verification Report

**Phase Goal:** Users can create send busses, parallel processing, and control per-track EQ
**Verified:** 2026-02-25T21:10:37Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view which tracks route to which destinations | ✓ VERIFIED | get_mixer_routing tool exists, calls mixer.get_routing handler, handler scans all track pairs with getRouteSendActive |
| 2 | User can create sends from any track to any bus | ✗ FAILED | create_send tool exists but passes wrong parameter names (sourceIndex/destIndex instead of source/destination) |
| 3 | User can set send levels per route | ✗ FAILED | set_send_level tool exists but passes wrong parameter names (sourceIndex/destIndex instead of source/destination) |
| 4 | User can adjust built-in EQ bands per track | ✓ VERIFIED | get_mixer_eq and set_mixer_eq_band tools call correct handlers with correct parameters |
| 5 | User can access plugins in mixer effect slots via existing plugin control system | ✓ VERIFIED | discover_mixer_effect, get/set_mixer_effect_param tools correctly integrate with paramCache and shadowState |

**Score:** 4/5 truths verified (3 passed, 2 failed due to same root cause)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `fl-bridge/handlers/mixer.py` | 12 registered handlers | ✓ VERIFIED | 12 handlers registered (6 Phase 8 + 6 Phase 9) |
| `src/tools/mixer.ts` | 16 MCP tools | ✓ VERIFIED | 16 tools registered (6 Phase 8 + 10 Phase 9) |
| `_resolve_track_ref` helper | Name/index resolution | ✓ VERIFIED | Present in mixer.py, handles both int and str references |
| `normalizeSendLevel` helper | Multi-format level conversion | ✓ VERIFIED | Present in mixer.ts, handles normalized/percent/dB |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| get_mixer_routing tool | mixer.get_routing handler | executeCommand | ✓ WIRED | Tool calls handler, handler uses getRouteSendActive/getRouteToLevel |
| get_track_sends tool | mixer.get_track_sends handler | executeCommand | ✓ WIRED | Tool passes index or name correctly |
| create_send tool | mixer.set_route handler | executeCommand | ✗ NOT_WIRED | Tool passes {sourceIndex: N} but handler expects {source: N} |
| remove_send tool | mixer.set_route handler | executeCommand | ✗ NOT_WIRED | Same parameter mismatch as create_send |
| set_send_level tool | mixer.set_route_level handler | executeCommand | ✗ NOT_WIRED | Tool passes {sourceIndex: N} but handler expects {source: N} |
| get_mixer_eq tool | mixer.get_eq handler | executeCommand | ✓ WIRED | Tool passes index or name correctly |
| set_mixer_eq_band tool | mixer.set_eq_band handler | executeCommand | ✓ WIRED | Tool passes parameters correctly |
| discover_mixer_effect tool | plugins.discover handler | executeCommand | ✓ WIRED | Tool passes track/slot, stores in paramCache |
| get_mixer_effect_param tool | paramCache.resolveParam | resolveParam call | ✓ WIRED | Tool checks cache, resolves name, calls get_param |
| set_mixer_effect_param tool | shadowState.set | shadowState.set call | ✓ WIRED | Tool updates shadowState after setting value |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| MIX-07: Get mixer routing state | ✓ SATISFIED | None |
| MIX-08: Set mixer routing | ✗ BLOCKED | Parameter naming mismatch in TypeScript tools |
| MIX-09: Set send levels per route | ✗ BLOCKED | Parameter naming mismatch in TypeScript tools |
| MIX-10: Control mixer track EQ | ✓ SATISFIED | None |
| MIX-11: Access mixer effect slot plugins | ✓ SATISFIED | None |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/tools/mixer.ts | 411 | Parameter name mismatch | 🛑 Blocker | create_send will fail at runtime with "Missing required parameter: source" |
| src/tools/mixer.ts | 470 | Parameter name mismatch | 🛑 Blocker | remove_send will fail at runtime with "Missing required parameter: source" |
| src/tools/mixer.ts | 528 | Parameter name mismatch | 🛑 Blocker | set_send_level will fail at runtime with "Missing required parameter: source" |

**Root cause:** TypeScript tools construct `sourceParam = { sourceIndex: N }` or `{ sourceName: "X" }`, then spread it into executeCommand. But Python handlers check for `params['source']` and `params['destination']` directly.

**Expected:**
```typescript
const sourceParam = typeof source === 'number' ? { source: source } : { source: source };
```

**Actual (incorrect):**
```typescript
const sourceParam = typeof source === 'number' ? { sourceIndex: source } : { sourceName: source };
```

The handlers DO resolve name vs index internally via `_resolve_track_ref(params['source'])`, so the tools should just pass `source` and `destination` directly, not create different key names.

### Human Verification Required

Not applicable for this phase. All functionality can be verified programmatically once parameter naming is fixed.

### Gaps Summary

**Phase 9 goal is NOT achieved.** While all infrastructure exists (12 Python handlers, 16 TypeScript tools, proper FL Studio API calls), 3 of the 5 routing tools have a critical wiring failure.

**Root cause:** Parameter naming mismatch between TypeScript tools and Python handlers.

**Impact:**
- `create_send`: Will fail with "Missing required parameter: source"
- `remove_send`: Will fail with "Missing required parameter: source"  
- `set_send_level`: Will fail with "Missing required parameter: source"

**What works:**
- ✓ Routing queries (get_mixer_routing, get_track_sends)
- ✓ EQ control (get_mixer_eq, set_mixer_eq_band)
- ✓ Effect slot access (discover_mixer_effect, get/set_mixer_effect_param)

**What's broken:**
- ✗ Creating sends
- ✗ Removing sends
- ✗ Setting send levels

The fix is straightforward: Change the parameter construction in `src/tools/mixer.ts` to pass `source` and `destination` keys instead of `sourceIndex`/`sourceName`/`destIndex`/`destName`. The handlers already handle both types (int or str) via `_resolve_track_ref`.

---

*Verified: 2026-02-25T21:10:37Z*
*Verifier: Claude (gsd-verifier)*
