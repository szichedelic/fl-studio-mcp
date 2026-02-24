# Milestones: FL Studio MCP Server

## Completed Milestones

### v1.0: Foundation & Note Generation
**Completed:** 2026-02-23
**Phases:** 1-2 (of original 10-phase roadmap)

**What shipped:**
- MCP server (TypeScript/Node.js) with stdio transport
- SysEx-over-MIDI bridge to FL Studio via loopMIDI
- FL Bridge Python MIDI controller script
- Transport control (play, stop, record)
- Project state reading (channels, patterns, mixer)
- Pattern selection and creation
- Music theory engine (scales, chords, melody/bass generation using tonal library)
- Piano roll note creation via embedded .pyscript (ComposeWithBridge)
- 6 MCP tools: add_notes, create_chord_progression, create_melody, create_bass_line, get_scale_info, clear_notes

**Key decisions:**
- Single loopMIDI port for bidirectional communication
- SysEx JSON protocol for command/response
- Embedded .pyscript approach (Node.js writes note data as Python literals into .pyscript file) — FL Studio's piano roll subinterpreter has no file I/O
- Velocity as 0.0-1.0 float (FL Studio native), timing in beats (quarter notes)
- tonal library for music theory (chroma is root-relative, not C-relative)

**Validated requirements:**
- FOUND-01: Transport control
- FOUND-02: Project state reading
- FOUND-03: Pattern selection/creation
- COMP-01: Note/MIDI generation
- COMP-02: Chord progression generation
- COMP-03: Melody generation
- COMP-04: Bass line generation
- COMP-06: Scale/key locking

**Last phase number:** 2 (10 were planned, but pivoting to new milestone)
