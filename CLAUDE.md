# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP server for natural-language control of FL Studio. TypeScript/Node.js MCP server talks to a Python MIDI Controller Script running inside FL Studio over virtual MIDI (loopMIDI on Windows, IAC on macOS) using base64-encoded JSON in MIDI SysEx messages. SoX CLI is used for sample manipulation. See `.planning/PROJECT.md` for the product vision and shipped milestones (v1.0, v2.0, v2.1 — 51 tools across 12 groups).

## Commands

- `npm run build` — TypeScript compile to `dist/`
- `npm run dev` — Run server directly via `tsx` (no build step)
- `npm start` — Run the built server (`dist/index.js`)
- `npm test` — Run the vitest suite once (CI-style)
- `npm run test:watch` — Watch mode
- `npm run test:coverage` — One-off run with v8 coverage
- Tests live in `tests/` and import directly from `src/` via the `.ts` extension. Add new tests as `tests/<thing>.test.ts`. The suite focuses on pure protocol/music code; anything that opens MIDI ports or talks to FL Studio is not covered (and shouldn't be — those need integration tests against a real bridge).

The MCP server uses stdio transport; it is launched by the MCP client (e.g. Claude Code via `.mcp.json`), not started manually. To exercise tools, configure `.mcp.json` from `.mcp.json.example` and connect a client.

Env vars: `FL_PORT_TO_FL` / `FL_PORT_FROM_FL` (MIDI port names — defaults `FL Bridge In` / `FL Bridge Out`), `FL_DEBUG=1`, `FL_DEBUG_FILE`.

## Architecture (the parts that span files)

Three processes, two protocols:

1. **MCP server** (`src/`, Node.js) — exposes tools to Claude over stdio. `src/index.ts` wires `ConnectionManager` (MIDI client) and `registerTools()` together.
2. **FL Bridge** (`fl-bridge/`, Python) — a FL Studio MIDI Controller Script (`device_FLBridge.py`) installed into FL Studio's Hardware folder. Receives SysEx in `OnSysEx`, dispatches via `protocol/commands.py` to `handlers/*.py`, sends responses via `device.midiOutSysex` (immediate; `OnIdle` is a fallback queue).
3. **SoX CLI** — invoked from `src/audio/sox-runner.ts` for sample processing.

### SysEx wire protocol (`src/bridge/sysex-codec.ts` ↔ `fl-bridge/protocol/sysex.py`)

`F0 7D <origin> <clientId> <continuation> <msgType> <status> <base64-json-payload> F7`. Manufacturer ID `0x7D` (non-commercial). Origins: `0x00` client, `0x01` server. Large responses are chunked — the codec on both sides handles reassembly. JSON is base64'd to stay 7-bit safe inside SysEx.

### Tool registration

All tools register through `src/tools/index.ts` → `registerTools(server, connection)`. Each `src/tools/<group>.ts` exports a `register*Tools()` that calls `server.tool(...)` and uses `ConnectionManager.send()` to round-trip a command to the bridge. Adding a new tool means: (a) new file under `src/tools/`, (b) wire it into `tools/index.ts`, (c) add a matching handler under `fl-bridge/handlers/` and register it in the bridge's command dispatcher.

### Piano roll integration (note generation)

FL Studio's piano roll Python subinterpreter has **no file I/O** — it can only read what's literally in the `.pyscript` source. So `src/music/pyscript-writer.ts` (Node side) writes `ComposeWithBridge.pyscript` into `~/Documents/Image-Line/FL Studio/Settings/Piano roll scripts/` with note data embedded as Python literals. The user (or a tool) then runs the script from FL Studio's piano roll. The MIDI Controller Script cannot do this write itself — it has no access to the Piano roll scripts directory.

### Plugin parameter shadow state (`src/plugins/shadow-state.ts`)

`getParamValue` is unreliable for many VSTs, so we keep a shadow Map keyed by `channel:slot:param` of values we set. Source is `user` (via MCP) or `discovered` (read at plugin scan); user values take precedence and survive rediscovery.

### Render workflow

FL Studio has no programmatic render/export API. The render flow is: tool produces a guided set of instructions → user renders manually → `src/audio/render-watcher.ts` (chokidar) detects the new WAV → `render-registry.ts` indexes it → sample tools can then process it via SoX.

## FL Studio Python constraints (read before touching `fl-bridge/`)

These are load-bearing — violating them crashes FL Studio silently:

- **All module-level code must be in try/except.** Init failures kill the script with no message.
- **No threads, no asyncio.** FL Studio's Python has broken threading. Everything is synchronous and event-driven via `OnSysEx`/`OnIdle`/`OnMidiMsg` callbacks.
- **`device_*.py` naming is required** for the Controller Script entry point.
- **First line `# name=FL Bridge`** is what makes "FL Bridge" appear in the Controller-type dropdown.
- The bridge runs in a "test mode" when imported outside FL Studio (mock `device`/`transport`/`patterns`/`channels`/`mixer`) — useful, but most handlers do nothing meaningful without the real modules.

## Other things worth knowing

- **Mixer is 0-indexed (0=Master); playlist is 1-indexed.** This mirrors FL Studio internals; do not "normalize" it.
- **Volume `0.8` = unity (0 dB)**, color is BGR internally but RGB hex at the MCP boundary, tempo is set via `processRECEvent(bpm*1000)`, undo uses `undoUp`/`undoDown` (plain `undo()` toggles unpredictably).
- **VST params are positional**, not stable IDs. Name-based lookups use 3-tier fuzzy matching (see `src/plugins/`); Serum 2 has 144 semantic aliases in `src/plugins/serum/aliases.ts`.
- `.planning/` holds the GSD workflow state (PROJECT.md, ROADMAP.md, STATE.md, phase/plan docs). Treat it as authoritative for product context, not as code.
- `.mcp.json` is gitignored; `fl-bridge/shared/*.json` is gitignored runtime IPC.

## Slash commands available in this repo

`.claude/commands/` defines: `branch-create`, `commit-organize`, `push-pr`, `merge-pr`, `ship`, `send-it`. Prefer these over ad-hoc git workflows when the user asks to commit/PR/ship.
