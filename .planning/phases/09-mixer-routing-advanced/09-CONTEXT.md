# Phase 9: Mixer Routing & Advanced - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Send routing between mixer tracks, EQ band control, and effect slot access. Users can create sends, set levels, adjust built-in EQ, and access plugins in mixer effect slots via existing plugin control system.

</domain>

<decisions>
## Implementation Decisions

### Send Routing Model
- Track references: Support BOTH name lookup and index for flexibility
- Route querying: Both full routing table AND per-track sends (two tools)

### Send Level Interface
- Level format: Accept BOTH percentage (0-100%) and decibels, normalize internally
- Pre/post fader: Support BOTH modes (pre-fader for effects, post for parallel)

### Claude's Discretion
- Bus naming convention (whether to auto-suffix "Bus")
- Orphan track cleanup behavior
- Send level confirmation verbosity
- EQ band granularity and parameter exposure
- Effect slot referencing approach (integrate with existing plugin system)

</decisions>

<specifics>
## Specific Ideas

- Follows Phase 8 patterns for track references (name lookup + index)
- Reuse existing plugin control system for effect slot access
- Volume 0.8 = unity gain pattern applies to send levels

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-mixer-routing-advanced*
*Context gathered: 2026-02-25*
