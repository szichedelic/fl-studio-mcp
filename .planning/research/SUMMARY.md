# Project Research Summary

**Project:** FL Studio MCP Server
**Domain:** DAW Integration / AI-Assisted Music Production
**Researched:** 2026-02-23
**Confidence:** MEDIUM

## Executive Summary

Building an MCP server for FL Studio requires solving a fundamental problem: FL Studio has no official external API. The solution is a hybrid architecture where a TypeScript MCP server communicates with FL Studio via virtual MIDI ports using a Python bridge script running inside FL Studio. This architecture is proven by existing implementations but has significant constraints.

The recommended approach uses Node.js with the official MCP SDK for the server layer, communicates via Flapi (SysEx over virtual MIDI), and executes commands inside FL Studio using Python MIDI Controller Scripts. The core value proposition is natural language music composition - generating chord progressions, melodies, bass lines, and drum patterns from Claude's prompts. Differentiation comes from deep humanization, multi-level abstraction (high-level creative direction to low-level tweaks), and full-spectrum control (piano roll + mixer + arrangement + plugins).

The critical risks are: (1) FL Studio API timing constraints that cause crashes if not respected, (2) VST parameter indexing instability across plugin updates, (3) Python environment limitations (no threading, stripped-down interpreter), and (4) Flapi being unmaintained. Mitigations include defensive programming with PME flag checks, name-based parameter resolution with shadow state, event-driven architecture without threading, and forking Flapi if needed.

## Key Findings

### Recommended Stack

The stack bridges three worlds: MCP protocol (TypeScript), external communication (Python + MIDI), and FL Studio internal execution (Python 3.9).

**Core technologies:**
- **Node.js 20.x + TypeScript 5.5+**: MCP server runtime with official @modelcontextprotocol/sdk — stable, well-documented, async-capable
- **Python 3.9-3.11**: FL Studio bridge and internal scripts — matches FL Studio's embedded Python version
- **Flapi 1.0.1 + python-rtmidi**: SysEx-over-MIDI communication — only viable external API solution for FL Studio
- **loopMIDI (Windows) / IAC Driver (macOS)**: Virtual MIDI ports for IPC — required for Flapi communication
- **Zod 3.x**: Schema validation for MCP tool inputs — official MCP SDK pattern

**Critical limitation:** FL Studio's MIDI Controller Scripting API is the only external control mechanism. Piano Roll Scripting API requires the piano roll to be open for a pattern, limiting automated note creation. VST parameter control requires empirical discovery (no stable parameter IDs). Tempo, BPM, and time signature are not accessible via the API.

### Expected Features

**Must have (table stakes):**
- Transport control (play/stop/record) — basic DAW automation baseline
- Note/MIDI generation — core value proposition (natural language to notes)
- Chord progression, melody, bass line, drum pattern generation — essential musical building blocks
- Piano roll manipulation — create and edit patterns
- Scale/key locking — quality assurance for note generation
- Project state reading — understand existing arrangement
- Mixer track control — volume, pan, mute, solo
- Basic humanization — distinguish from robotic quantization

**Should have (competitive):**
- Deep humanization engine — brownian noise timing, contextual velocity curves, performance artifacts
- Multi-level abstraction — accept both "melancholic piano intro" and "shift note 3 up a semitone"
- Iterative refinement — quick back-and-forth without re-describing entire context
- Playlist/arrangement control — structure songs, not just patterns (underserved in competitors)
- Serum 2 sound design — create patches via natural language (very high complexity)
- Addictive Drums 2 integration — kit selection, velocity curves, MIDI mapping

**Defer (v2+):**
- Voice input (text works first)
- Auto-mixing/mastering (different domain)
- Contextual suggestions (requires robust musical knowledge system)
- Full song generation (anti-pattern: removes creative ownership)

**Anti-patterns to avoid:**
- Full song generation that removes creative control
- Over-automation that replaces human decisions
- Simple randomization humanization that sounds worse than quantized
- Cloud dependencies for core functions

### Architecture Approach

The architecture uses a bridge pattern with three distinct systems: Claude (MCP client) communicates with an MCP server (TypeScript) over stdio, which communicates with FL Studio via virtual MIDI ports using SysEx messages. A Python script running inside FL Studio (the "FL Bridge") receives MIDI messages, decodes them, executes FL Studio API calls, and returns results.

**Major components:**
1. **MCP Server (TypeScript/Node.js)** — MCP protocol handling, tool definitions with Zod schemas, command encoding/decoding, MIDI communication
2. **FL Bridge (Python)** — Runs inside FL Studio as MIDI Controller Script, executes API calls, reads project state, handles Piano Roll operations
3. **Virtual MIDI Ports (loopMIDI)** — Bidirectional IPC using SysEx messages with JSON payloads
4. **Tool Definitions** — Zod schemas for atomic operations (pattern.create, notes.add, mixer.set_volume) composed by Claude for complex workflows

**Communication protocol:** SysEx messages (0xF0...0xF7) carry JSON payloads with command/response correlation via UUIDs. All operations are async with timeout handling.

**Critical pattern:** State snapshot before mutation — read current project state before making changes to enable validation and conflict detection. Graceful degradation when optimal approach isn't available (Piano Roll API vs. MIDI recording fallback).

### Critical Pitfalls

1. **"Operation Unsafe at Current Time" crashes** — FL Studio API operations can only be called during specific callback phases. Attempting operations at the wrong time causes silent crashes without error messages. Prevention: Check PME flags before every state-modifying operation, wrap in try/catch, test during playback/recording/idle states.

2. **Threading incompatibility** — FL Studio uses a stripped-down Python interpreter where threading is broken. Any concurrent execution conflicts with the audio engine. Prevention: Event-driven architecture only, use OnIdle callbacks for queuing, handle async in MCP server (outside FL Studio) but execute synchronously inside FL Studio.

3. **VST parameter indexing mismatch** — FL Studio indexes parameters by position, not stable IDs. Plugin updates break parameter mappings silently. Prevention: Use parameter names as primary identifiers, build runtime name-to-index mapping layer, cache per-instance not globally, validate periodically.

4. **Initialization errors crash FL Studio** — Any exception during script load causes FL Studio to crash on every startup until fixed. No error messages shown. Prevention: Wrap all module-level code in try/except, use lazy imports, keep initialization minimal, validate config files exist.

5. **getParamValue broken for VSTs** — Reading current VST parameter values fails or returns incorrect values (known FL Studio bug). Prevention: Maintain shadow state, track every parameter set, design features to work without current state knowledge.

## Implications for Roadmap

Based on research, suggested phase structure follows dependency chains and risk mitigation:

### Phase 1: Foundation & Communication
**Rationale:** All features depend on reliable MCP-FL Studio communication. This is the highest-risk component (MIDI setup, timing constraints, crash risks). Validate architecture before building on it.

**Delivers:**
- MCP server with stdio transport
- Virtual MIDI communication layer (loopMIDI setup)
- FL Bridge Python script with safe initialization
- SysEx encoding/decoding with command/response correlation
- Transport control (play/stop/record) as proof of connection

**Addresses (from FEATURES.md):**
- Transport control (table stakes)

**Avoids (from PITFALLS.md):**
- Pitfall #2 (Threading) — establish event-driven architecture from day one
- Pitfall #3 (Initialization crashes) — defensive error handling, lazy imports
- Pitfall #7 (MIDI port setup) — explicit Windows configuration with validation

**Research flags:** LOW — architecture is proven by existing implementations, but hands-on testing needed for timing constraints and crash scenarios.

### Phase 2: Project State Reading
**Rationale:** Read operations are safer than writes. Validates FL Studio API understanding before mutations. Enables context-aware tool calls.

**Delivers:**
- Pattern enumeration and selection
- Channel information reading
- Mixer state reading (volume, pan, routing)
- Project structure understanding

**Addresses (from FEATURES.md):**
- Project state reading (table stakes)
- Pattern selection (table stakes)

**Avoids (from PITFALLS.md):**
- Pitfall #1 (Unsafe operations) — read-only operations establish PME flag checking patterns
- Pitfall #5 (getParamValue broken) — discover which reads work, which don't

**Research flags:** LOW — documented API, but need to test which reads actually work vs. documented.

### Phase 3: Note Generation Core
**Rationale:** Core value proposition. Enables first useful workflows. Dependency: requires pattern selection from Phase 2.

**Delivers:**
- Piano roll note creation (add/delete/modify)
- Chord progression generation
- Melody generation
- Bass line generation
- Scale/key locking

**Addresses (from FEATURES.md):**
- Note/MIDI generation (table stakes)
- Chord progression, melody, bass line (table stakes)
- Piano roll manipulation (table stakes)
- Scale/key locking (table stakes)

**Avoids (from PITFALLS.md):**
- Pitfall #1 (Unsafe operations) — implement PME flag checks for write operations
- Graceful degradation if piano roll isn't open

**Research flags:** MEDIUM — Piano Roll API requires open piano roll (constraint needs hands-on validation). Fallback strategies (MIDI recording) need testing.

### Phase 4: Drum Pattern Generation
**Rationale:** Completes essential musical building blocks. Can be developed in parallel with Phase 3 (independent feature).

**Delivers:**
- Drum pattern generation with groove templates
- Basic velocity variation
- MIDI note mapping for drum kits

**Addresses (from FEATURES.md):**
- Drum pattern generation (table stakes)

**Avoids (from PITFALLS.md):**
- Pitfall #6 (Bad humanization) — use simple but correct velocity curves initially

**Research flags:** LOW — same technical approach as Phase 3, different musical domain.

### Phase 5: Basic Humanization
**Rationale:** Moves from functional to quality output. Requires note generation foundation from Phase 3/4.

**Delivers:**
- Timing variation (brownian noise, not uniform random)
- Velocity curves (contextual: downbeats stronger)
- Genre-appropriate humanization profiles

**Addresses (from FEATURES.md):**
- Basic humanization (table stakes)

**Avoids (from PITFALLS.md):**
- Pitfall #6 (Humanization sounds worse) — brownian noise distributions, contextual variation, configurable amount

**Research flags:** HIGH — requires dedicated research spike. Humanization is complex domain with significant quality risks. Study real performance timing patterns, test on isolated drums to hear artifacts clearly.

### Phase 6: Mixer Control
**Rationale:** Completes table stakes. Enables mixing workflows after composition is functional.

**Delivers:**
- Mixer track control (volume, pan, mute, solo)
- Basic routing setup
- Sidechain configuration

**Addresses (from FEATURES.md):**
- Mixer track control (table stakes)
- Sidechain setup (differentiator)
- Bus/send routing (differentiator)

**Avoids (from PITFALLS.md):**
- Same PME flag patterns from Phases 1-3

**Research flags:** LOW — documented mixer module, straightforward API.

### Phase 7: VST Plugin Control (Serum 2 & Addictive Drums 2)
**Rationale:** High-value differentiation but requires complex parameter discovery. Deferred until core composition works.

**Delivers:**
- Generic VST parameter control via plugins module
- Serum 2 parameter mapping and control
- Addictive Drums 2 integration (kit selection, velocity curves)

**Addresses (from FEATURES.md):**
- Plugin parameter control (differentiator)
- Serum 2 sound design (differentiator)
- Addictive Drums 2 integration (differentiator)

**Avoids (from PITFALLS.md):**
- Pitfall #4 (Parameter indexing) — name-based resolution with runtime mapping
- Pitfall #5 (getParamValue broken) — shadow state, don't rely on reads
- Pitfall #12 (AD2 MIDI quirks) — specific testing, CC reverse for hi-hat

**Research flags:** VERY HIGH — requires dedicated research phase for parameter discovery, Serum 2 parameter documentation, AD2 MIDI mapping specifics. Consider using fl_param_checker tool.

### Phase 8: Deep Humanization & Multi-Level Abstraction
**Rationale:** Competitive differentiation after core functionality is proven. Requires robust foundation from previous phases.

**Delivers:**
- Advanced humanization (performance artifacts, timing drift/return)
- Multi-level abstraction (high-level creative to low-level tweaks)
- Iterative refinement with session context

**Addresses (from FEATURES.md):**
- Deep humanization engine (differentiator)
- Multi-level abstraction (differentiator)
- Iterative refinement (differentiator)

**Avoids (from PITFALLS.md):**
- Pitfall #6 (Humanization) — sophisticated algorithms, genre-appropriate profiles

**Research flags:** MEDIUM — requires musical domain knowledge research, study of professional humanization tools (HumBeat 2, MidiHumanizer).

### Phase 9: Playlist/Arrangement Control
**Rationale:** Underserved in competitors, high-value differentiation. Requires solid foundation across all previous phases.

**Delivers:**
- Playlist clip manipulation
- Song structure arrangement
- Section creation (intro, verse, chorus)

**Addresses (from FEATURES.md):**
- Playlist/arrangement control (differentiator)

**Avoids (from PITFALLS.md):**
- Same safety patterns from previous phases

**Research flags:** MEDIUM — playlist API is documented but less commonly used. Need to understand clip manipulation patterns.

### Phase Ordering Rationale

- **Phases 1-2 are foundation** — communication and state reading must work before anything else. High risk, validate early.
- **Phases 3-4 deliver core value** — note and drum generation are the main use case. Can develop in parallel.
- **Phase 5 adds quality** — humanization turns functional output into professional output. Requires dedicated research.
- **Phases 6-7 complete the toolkit** — mixer and VST control enable full production workflows. VST control has complex parameter discovery challenges.
- **Phases 8-9 are competitive differentiation** — advanced features that set this apart from competitors after core functionality is proven.

**Dependency chain:**
- Phase 2 depends on Phase 1 (communication required for state reading)
- Phase 3 depends on Phase 2 (pattern selection required for note creation)
- Phase 5 depends on Phases 3-4 (humanization requires note generation)
- Phase 8 depends on Phase 5 (deep humanization builds on basic humanization)
- Phase 9 depends on Phases 3-6 (arrangement requires patterns, notes, mixer)

**Risk mitigation:**
- Validate risky components early (Phase 1: MIDI communication, crash risks)
- Defer complex research (Phase 7: VST parameter discovery) until core is proven
- Build quality incrementally (Phase 5 basic → Phase 8 advanced humanization)

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 5 (Basic Humanization):** Complex domain with significant quality risks. Requires dedicated research spike to study brownian noise patterns, velocity curves, performance timing analysis. HIGH priority research.

- **Phase 7 (VST Plugin Control):** Parameter discovery for Serum 2 and AD2 is non-trivial. FL Studio VST3 parameter ID bug complicates this. Need to research fl_param_checker tool, Serum parameter documentation, AD2 MIDI mapping specifics. VERY HIGH priority research.

- **Phase 8 (Deep Humanization):** Requires musical domain knowledge and study of professional tools (HumBeat 2, MidiHumanizer). MEDIUM priority research.

- **Phase 9 (Playlist/Arrangement):** Playlist API is documented but less commonly used. Need to understand clip manipulation patterns and arrangement workflows. MEDIUM priority research.

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Foundation):** Architecture proven by existing implementations (karl-andres/fl-studio-mcp, calvinw/fl-studio-mcp). Standard patterns for MCP server + MIDI communication.

- **Phase 2 (State Reading):** Documented API, straightforward read operations. Standard state management patterns.

- **Phase 3 (Note Generation):** Piano Roll API documented, pattern established. Musical generation algorithms are domain knowledge (not research-phase scope).

- **Phase 4 (Drum Patterns):** Same technical approach as Phase 3, different musical domain. No additional research needed.

- **Phase 6 (Mixer Control):** Well-documented mixer module, straightforward control patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Architecture is proven by existing implementations, but Flapi is unmaintained (marked on GitHub). TypeScript MCP SDK is well-documented. FL Studio Python environment has known limitations. |
| Features | MEDIUM | Feature expectations validated against competitors (AbletonGPT, Melosurf). Table stakes clear, but differentiators (deep humanization, Serum integration) have complexity unknowns. |
| Architecture | MEDIUM | Bridge pattern validated by AbletonOSC/ableton-osc-mcp analogues. FL Studio API capabilities documented officially, but practical limitations (Piano Roll context, getParamValue bugs) require hands-on validation. |
| Pitfalls | MEDIUM | Critical pitfalls sourced from official docs and community forums. Threading/initialization/timing constraints are well-documented. VST parameter issues confirmed by forum discussions but dated (2023-2024). |

**Overall confidence:** MEDIUM

Research is sufficient to begin roadmap planning, but several areas require validation during implementation:

- Hands-on testing of FL Studio API timing constraints and crash scenarios
- Piano Roll API behavior when piano roll isn't open (fallback strategies)
- VST parameter discovery and mapping stability
- MIDI communication latency and reliability
- Humanization algorithm quality (requires dedicated research spike before Phase 5)

### Gaps to Address

**Gap 1: FL Studio API timing constraints (PME flags)**
- **Issue:** Documentation mentions PME flags but doesn't exhaustively list which operations require which flags in which contexts.
- **How to handle:** Establish comprehensive PME flag checking patterns in Phase 1. Test extensively during playback, recording, idle states. Build reusable safety wrappers.

**Gap 2: Piano Roll API context requirements**
- **Issue:** Piano Roll Scripting only works when piano roll is open for a pattern. Unclear if we can programmatically open piano roll or must guide user.
- **How to handle:** Test in Phase 3. If can't open programmatically, implement fallback via MIDI recording (requires transport in record mode). Document workflow requirements.

**Gap 3: VST parameter discovery methodology**
- **Issue:** No stable parameter IDs, empirical discovery required. fl_param_checker tool exists but not well-documented.
- **How to handle:** Dedicated research spike before Phase 7. Hands-on testing with Serum 2 and AD2. Build parameter mapping tool or integrate fl_param_checker.

**Gap 4: Humanization algorithm effectiveness**
- **Issue:** Simple randomization fails (sounds worse than quantized), but sophisticated approaches require musical domain knowledge.
- **How to handle:** Dedicated research spike before Phase 5. Study HumBeat 2, MidiHumanizer, academic papers on performance timing. Test on isolated drums to hear artifacts clearly. Start with subtle amounts.

**Gap 5: Flapi maintenance status**
- **Issue:** Flapi is marked "unmaintained" with half-finished refactor. May need to fork or replace.
- **How to handle:** Test Flapi 1.0.1 in Phase 1. If stable, use as-is. If buggy, evaluate: fork and maintain, build custom bridge, or use alternative IPC (JSON file queue with keystroke triggers).

**Gap 6: Real-time latency characteristics**
- **Issue:** MIDI latency affected by audio buffer length, driver type. Unclear if acceptable for real-time feedback.
- **How to handle:** Benchmark in Phase 1. Test with ASIO vs. default Windows audio drivers. Document buffer size requirements. Set expectations for slight delay (not truly "real-time").

## Sources

### Primary (HIGH confidence)
- [FL Studio MIDI Scripting Manual](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm) — Official API documentation
- [FL Studio Python API Stubs (Official)](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/) — Type hints and module documentation
- [FL Studio Piano Roll Scripting API](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/pianoroll_scripting_api.htm) — Official piano roll docs
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Official MCP SDK
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) — Protocol design
- [MCP Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server) — Implementation patterns

### Secondary (MEDIUM confidence)
- [karl-andres/fl-studio-mcp](https://github.com/karl-andres/fl-studio-mcp) — Existing MCP implementation using Flapi
- [calvinw/fl-studio-mcp](https://github.com/calvinw/fl-studio-mcp) — Alternative implementation using JSON file queue
- [Flapi PyPI](https://pypi.org/project/flapi/) — FL Studio remote control via SysEx
- [Flapi GitHub](https://github.com/MaddyGuthridge/Flapi) — Source code, architecture explanation
- [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) — Virtual MIDI for Windows
- [AbletonOSC MCP](https://github.com/nozomi-koborinai/ableton-osc-mcp) — Reference architecture for DAW integration
- [FL MIDI 101 Guide](https://flmidi-101.readthedocs.io/) — Community documentation, threading warnings
- [fl_param_checker](https://github.com/MaddyGuthridge/fl_param_checker) — VST parameter discovery tool
- [AbletonGPT](https://www.abletongpt.com/) — Competitor analysis
- [Melosurf](https://melosurf.com/) — Competitor analysis
- [VST3 Parameter Automation](https://steinbergmedia.github.io/vst3_dev_portal/pages/Technical+Documentation/Parameters+Automation/Index.html) — VST3 spec

### Tertiary (LOW confidence - needs validation)
- [FL Scripting API Functionality Forum](https://forum.image-line.com/viewtopic.php?t=309492) — getParamValue bugs, dated 2023
- [VST3 Parameter ID Issue Forum](https://forum.image-line.com/viewtopic.php?t=299601) — Parameter indexing bug, dated 2024
- [Will Python API Get Fixed Forum](https://forum.image-line.com/viewtopic.php?t=272593) — API limitations discussion, dated 2022
- [How to Humanize MIDI Guide](https://unison.audio/how-to-humanize-midi/) — Brownian noise patterns
- [How to Make MIDI Drums Sound Human](https://blog.zzounds.com/2020/05/27/how-to-make-your-midi-drums-sound-human/) — Velocity variation techniques
- [Linux Audio Conference - Humanization Paper](https://lac2020.sciencesconf.org/316448/LAC_20.pdf) — Academic research on timing randomization
- [HumBeat 2 Drum Humanizer](https://developdevice.com/products/humbeat-2-0-the-ultimate-midi-drum-humanizer) — Commercial humanization tool
- [AI Serum Preset Generator](https://pounding.systems/products/ai-serum-preset-generator) — AI sound design example
- [Addictive Drums 2 MIDI Mapping Forum](https://gearspace.com/board/music-computers/970564-addictive-drums-2-midi-mapping-work.html) — AD2 MIDI quirks

---

*Research completed: 2026-02-23*
*Ready for roadmap: Yes*
