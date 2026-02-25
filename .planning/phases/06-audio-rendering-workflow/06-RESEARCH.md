# Phase 6: Audio Rendering Workflow - Research

**Researched:** 2026-02-25
**Domain:** FL Studio audio export, file system watching, guided manual workflow, render tracking
**Confidence:** HIGH (domain well-understood from prior research; FL Studio API constraints verified; chokidar is mature)

## Summary

Phase 6 implements a guided audio rendering workflow that bridges the gap between FL Studio's MIDI-only scripting API and the need to produce WAV files for downstream sample manipulation (Phase 7). The core constraint is well-established: **FL Studio's MIDI Controller Scripting API has NO programmatic render/export function**. There is no SysEx command, Python API call, or transport command that triggers audio export. The user MUST press Ctrl+R (or File > Export > Wave File) manually.

The phase builds two components: (1) an MCP tool that generates clear, context-aware step-by-step instructions for the user (including suggested filename, recommended output path, and exact FL Studio dialog settings), and (2) a chokidar-based file watcher that monitors a configured output directory for new WAV files, automatically detecting when a render completes and tracking it for Phase 7. The watcher uses `awaitWriteFinish` to avoid detecting partially-written files.

The architecture is intentionally simple -- no new Python handlers are needed in FL Bridge. The rendering tool reads current FL Studio state (pattern name, channel info) via existing SysEx commands to generate smart file names and instructions. The file watcher runs as a long-lived background service within the MCP server process.

**Primary recommendation:** Build a `render_pattern` MCP tool that generates instructions and starts a file watcher, plus a `list_renders` tool for tracking. Use chokidar v4 with `awaitWriteFinish` for reliable WAV detection on Windows. Store render metadata (path, timestamp, source pattern, channel) in an in-memory registry that Phase 7 consumes.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chokidar | ^4.0.3 | File system watching for rendered WAV files | 30M+ repos use it; handles Windows fs.watch quirks; written in TypeScript; awaitWriteFinish prevents partial-file detection; v4 has 1 dependency |
| node:fs/promises | Built-in | Read file stats (size, mtime) for render confirmation | Verify WAV file validity after detection |
| node:path | Built-in | Path manipulation for output directories | Cross-platform path handling |
| node:os | Built-in | `homedir()` for default output path | Resolve user's Documents directory |
| zod (already installed) | ^3.25.30 | MCP tool input validation | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing bridge tools | Already built | Read pattern name, channel info for smart filenames | Every render instruction generation |
| Existing state tools | Already built | `get_patterns`, `get_channels`, `transport_state` | Context for render instructions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chokidar | Node.js `fs.watch` | fs.watch is unreliable on Windows (duplicate events, missing events, no recursive watching normalization). chokidar normalizes all platform quirks. |
| chokidar v4 | chokidar v5 | v5 is ESM-only (compatible with this project) but was released Nov 2025, only 3 months old. v4 is more battle-tested. Both work with Node 24. |
| In-memory render registry | SQLite/file-based registry | Overkill for session-scoped tracking. Renders are ephemeral per MCP session. In-memory Map is simpler and sufficient. |
| Watching single directory | Watching multiple directories | Start simple with one configurable directory. Can expand later if needed. |

**Installation:**
```bash
npm install chokidar@^4.0.3
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  audio/
    render-watcher.ts      # NEW: Chokidar-based WAV file watcher service
    render-registry.ts     # NEW: In-memory tracking of rendered files
    types.ts               # NEW: RenderInfo, WatcherConfig types
  tools/
    render.ts              # NEW: MCP tools (render_pattern, list_renders)
  tools/
    index.ts               # MODIFY: Register render tools
```

### Pattern 1: Guided Manual Workflow Tool

**What:** An MCP tool that reads FL Studio state (current pattern name, selected channel name, tempo) and generates human-friendly step-by-step render instructions with a smart filename suggestion.
**When to use:** When user says "render this pattern" or "export to WAV."

```typescript
// src/tools/render.ts
// This tool does NOT trigger a render. It generates instructions and starts watching.

server.tool(
  'render_pattern',
  'Get step-by-step instructions to render the current pattern as a WAV file. Starts watching for the rendered file automatically.',
  {
    filename: z.string().optional()
      .describe('Custom filename (without extension). Omit for auto-generated name.'),
    outputDir: z.string().optional()
      .describe('Output directory. Defaults to ~/Documents/FL Studio MCP/Renders/'),
  },
  async ({ filename, outputDir }) => {
    // 1. Read current FL Studio state for context
    const patternsResult = await connection.executeCommand('state.patterns', {});
    const channelsResult = await connection.executeCommand('state.channels', {});

    // 2. Generate smart filename from pattern name + channel name
    const patternName = patternsResult.patterns?.[patternsResult.currentPattern - 1]?.name ?? 'Pattern';
    const suggestedName = filename ?? sanitizeFilename(`${patternName}_render`);

    // 3. Determine output directory
    const renderDir = outputDir ?? getDefaultRenderDir();

    // 4. Start file watcher for this render
    renderWatcher.watchFor(suggestedName + '.wav', renderDir);

    // 5. Return step-by-step instructions
    return {
      content: [{
        type: 'text',
        text: [
          `To render "${patternName}" as a WAV file:`,
          '',
          '1. Make sure you are in Pattern mode (not Song mode)',
          '   - Check the Pat/Song toggle in the transport bar',
          '2. Press Ctrl+R (or File > Export > Wave File)',
          `3. Navigate to: ${renderDir}`,
          `4. Set filename to: ${suggestedName}.wav`,
          '5. Settings:',
          '   - WAV bit depth: 32-Bit float (recommended)',
          '   - Mode: Pattern',
          '   - Leave other settings as default',
          '6. Click "Start" to begin rendering',
          '',
          `Watching for: ${suggestedName}.wav`,
          'I will automatically detect when the file appears.',
        ].join('\n'),
      }],
    };
  }
);
```

### Pattern 2: File Watcher Service

**What:** A long-lived chokidar watcher that monitors a directory for new .wav files. When a file appears and stabilizes (finished writing), it registers the render in the in-memory registry and can notify the user.
**When to use:** Started by `render_pattern`, runs in background.

```typescript
// src/audio/render-watcher.ts
import chokidar from 'chokidar';
import { join, extname, basename } from 'node:path';

export class RenderWatcher {
  private watcher: ReturnType<typeof chokidar.watch> | null = null;
  private pendingRenders: Map<string, { resolve: (path: string) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();

  /**
   * Start watching a directory for new WAV files.
   */
  startWatching(directory: string): void {
    if (this.watcher) return; // Already watching

    this.watcher = chokidar.watch(directory, {
      persistent: true,
      ignoreInitial: true,           // Only detect NEW files
      awaitWriteFinish: {
        stabilityThreshold: 2000,    // Wait 2s after file stops growing
        pollInterval: 500,           // Check size every 500ms
      },
      depth: 0,                      // Only watch top-level directory
      ignored: (path: string, stats) => {
        // Only watch .wav files
        if (stats?.isFile()) return !path.toLowerCase().endsWith('.wav');
        return false;
      },
    });

    this.watcher.on('add', (filePath: string) => {
      const name = basename(filePath);
      console.error(`[render-watcher] New WAV detected: ${name}`);
      // Check if this matches a pending render
      this.resolvePending(name, filePath);
      // Always register in the render registry
      renderRegistry.register({
        path: filePath,
        filename: name,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Watch for a specific filename. Returns a promise that resolves
   * when the file appears, or rejects on timeout.
   */
  watchFor(filename: string, directory: string, timeoutMs = 300000): Promise<string> {
    this.startWatching(directory);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRenders.delete(filename);
        reject(new Error(`Render timeout: ${filename} not detected within ${timeoutMs / 1000}s`));
      }, timeoutMs);
      this.pendingRenders.set(filename.toLowerCase(), { resolve, timeout: timer });
    });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
```

### Pattern 3: Render Registry (In-Memory Tracking)

**What:** A simple in-memory store that tracks all rendered WAV files detected during this MCP session. Phase 7 (Sample Manipulation) reads from this registry to know what files are available.
**When to use:** Every detected render is stored here. Phase 7 tools query it.

```typescript
// src/audio/render-registry.ts

export interface RenderInfo {
  path: string;          // Absolute path to WAV file
  filename: string;      // Just the filename
  timestamp: number;     // When it was detected (Date.now())
  patternName?: string;  // Source pattern name (if known)
  channelName?: string;  // Source channel name (if known)
}

export class RenderRegistry {
  private renders: RenderInfo[] = [];

  register(info: RenderInfo): void {
    this.renders.push(info);
    console.error(`[render-registry] Registered: ${info.filename} (${this.renders.length} total)`);
  }

  getAll(): RenderInfo[] {
    return [...this.renders];
  }

  getLatest(): RenderInfo | undefined {
    return this.renders[this.renders.length - 1];
  }

  getByFilename(name: string): RenderInfo | undefined {
    return this.renders.find(r =>
      r.filename.toLowerCase() === name.toLowerCase()
    );
  }

  count(): number {
    return this.renders.length;
  }

  clear(): void {
    this.renders.length = 0;
  }
}

export const renderRegistry = new RenderRegistry();
```

### Pattern 4: Smart Filename Generation

**What:** Generate descriptive, filesystem-safe filenames from FL Studio state.
**When to use:** When generating render instructions without a user-specified filename.

```typescript
// Part of src/tools/render.ts or src/audio/render-watcher.ts

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')     // Remove illegal characters
    .replace(/\s+/g, '_')              // Spaces to underscores
    .replace(/_+/g, '_')               // Collapse multiple underscores
    .replace(/^_|_$/g, '')             // Trim leading/trailing underscores
    .substring(0, 100)                 // Limit length
    || 'render';                       // Fallback
}

function generateRenderFilename(patternName: string, channelName?: string): string {
  const parts = [patternName];
  if (channelName) parts.push(channelName);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  parts.push(timestamp);
  return sanitizeFilename(parts.join('_'));
}
```

### Anti-Patterns to Avoid

- **Trying to trigger FL Studio's export dialog programmatically:** There is no API for this. `transport.globalTransport()` has no render command. `ui` keyboard functions cannot simulate Ctrl+R (no modifier key support). Do not waste time exploring this.
- **Using `fs.watch` instead of chokidar:** Native `fs.watch` on Windows fires duplicate events, sometimes misses files, and does not normalize event types. Chokidar exists specifically to solve these problems.
- **Not using `awaitWriteFinish`:** WAV renders can be large (10-100MB). Without `awaitWriteFinish`, the `add` event fires when the file first appears on disk, before FL Studio finishes writing it. This results in reading a truncated or locked file.
- **Persisting render registry to disk:** Renders are session-scoped. The MCP server restarts between sessions. There is no value in persisting a render database. Keep it in-memory.
- **Making the watcher promise block the MCP response:** The `render_pattern` tool should return instructions immediately and start watching in the background. Do not make the user wait for the render to complete before they see instructions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File system watching | `fs.watch` wrapper with deduplication | chokidar | chokidar handles Windows quirks, duplicate events, partial writes, and platform normalization. 30M+ repos trust it. |
| Partial-write detection | Custom file-size polling loop | chokidar `awaitWriteFinish` | Built-in feature, battle-tested, configurable thresholds |
| Filename sanitization | Complex regex engine | Simple replace chain (see Pattern 4) | Only need to strip illegal Windows chars and normalize spaces. 10 lines of code, not a library. |
| WAV file validation | Custom WAV header parser | `fs.stat` for size check | At this phase, we just need to confirm the file exists and is non-empty. Full WAV parsing is Phase 7's concern. |

**Key insight:** Phase 6 is architecturally simple. The complexity is in the UX -- generating clear, helpful instructions that minimize user friction. The code itself is straightforward: one MCP tool, one file watcher, one registry.

## Common Pitfalls

### Pitfall 1: Detecting Partially-Written WAV Files

**What goes wrong:** The file watcher detects the WAV file as soon as FL Studio creates it on disk, before the render is complete. Reading the file at this point yields truncated or locked data.
**Why it happens:** FL Studio creates the output file and writes to it progressively during render. `fs.watch` fires on file creation, not file completion.
**How to avoid:** Use chokidar with `awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 }`. This polls the file size and only fires the `add` event after the size has been stable for 2 seconds.
**Warning signs:** Downstream Phase 7 tools fail with "unexpected end of file" or WAV parsing errors.

### Pitfall 2: FL Studio Saves to Unexpected Location

**What goes wrong:** The user exports to a different directory than the one the watcher is monitoring. The file is never detected.
**Why it happens:** FL Studio's export dialog remembers the last export location. If the user previously exported elsewhere, the dialog defaults to that location. There is no API to read or set the export directory.
**How to avoid:** (a) Make the watched directory configurable. (b) Include the exact path in the instructions. (c) Provide a `check_render` tool that can scan a user-specified path. (d) Set a reasonable timeout (5 minutes) and provide helpful messages when the timeout expires.
**Warning signs:** `render_pattern` returns instructions, but the render is never detected despite the user completing the export.

### Pitfall 3: User Exports in Song Mode Instead of Pattern Mode

**What goes wrong:** The user renders the entire song instead of just the current pattern. The resulting WAV is much larger than expected and contains content from all patterns.
**Why it happens:** FL Studio defaults to whatever mode the user was last in. The export dialog has a "Pattern" vs "Song" toggle.
**How to avoid:** (a) Read the current loop mode via `transport.getLoopMode()` (0=pattern, 1=song) and include a warning in the instructions if in song mode. (b) Explicitly instruct the user to select "Pattern" mode in the export dialog.
**Warning signs:** Rendered file is unexpectedly large or long.

### Pitfall 4: Watcher Accumulates Stale State Across Tool Calls

**What goes wrong:** Multiple calls to `render_pattern` accumulate pending watchers and never clean them up, leading to memory leaks or stale matches.
**Why it happens:** Each `render_pattern` call starts watching for a specific filename. If the user never completes the render, the pending promise and timeout remain.
**How to avoid:** (a) Timeout all pending renders (5 minutes default). (b) Cancel previous pending renders when a new one starts. (c) The watcher itself is a singleton -- only start one instance per directory.
**Warning signs:** Memory usage grows over time; stale renders appear in the registry.

### Pitfall 5: Ignoring Pre-Existing Files in Watch Directory

**What goes wrong:** chokidar's `ignoreInitial: true` means files already in the directory when watching starts are not reported. But if the user has already rendered the file before calling `render_pattern`, it won't be detected.
**How to avoid:** Before starting the watcher, check if the expected file already exists in the target directory. If it does, skip watching and register it immediately.
**Warning signs:** User says "I already rendered it" but the system doesn't detect the file.

## Code Examples

### Complete MCP Tool: render_pattern

```typescript
// Source: Project pattern based on existing tool structure

server.tool(
  'render_pattern',
  'Get step-by-step instructions to render the current pattern as a WAV file. Automatically watches for the rendered file.',
  {
    filename: z.string().optional()
      .describe('Custom filename without extension. Omit for auto-generated name based on pattern/channel.'),
    outputDir: z.string().optional()
      .describe('Output directory path. Defaults to ~/Documents/FL Studio MCP/Renders/'),
  },
  async ({ filename, outputDir }) => {
    try {
      // Read FL Studio state for context
      const stateResult = await connection.executeCommand('state.patterns', {});
      const currentPattern = stateResult.currentPattern ?? 1;
      const patternName = stateResult.patterns?.find(
        (p: { index: number }) => p.index === currentPattern
      )?.name ?? `Pattern ${currentPattern}`;

      // Generate filename
      const renderName = filename ?? sanitizeFilename(`${patternName}_render`);
      const renderDir = outputDir ?? getDefaultRenderDir();
      const fullFilename = `${renderName}.wav`;

      // Ensure output directory exists
      await mkdir(renderDir, { recursive: true });

      // Check if file already exists
      const fullPath = join(renderDir, fullFilename);
      if (existsSync(fullPath)) {
        renderRegistry.register({
          path: fullPath,
          filename: fullFilename,
          timestamp: Date.now(),
          patternName,
        });
        return {
          content: [{
            type: 'text',
            text: `File already exists: ${fullPath}\nRegistered for sample manipulation.`,
          }],
        };
      }

      // Start watching (non-blocking)
      renderWatcher.startWatching(renderDir);

      // Build instructions
      const lines = [
        `Render "${patternName}" to WAV:`,
        '',
        '1. Press Ctrl+R (or File > Export > Wave File)',
        `2. Navigate to: ${renderDir}`,
        `3. Set filename to: ${fullFilename}`,
        '4. Ensure settings:',
        '   - Format: WAV',
        '   - Bit depth: 32-Bit float',
        '   - Mode: Pattern (not Song)',
        '5. Click "Start"',
        '',
        `Watching ${renderDir} for ${fullFilename}...`,
        'I will automatically detect when the render completes.',
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error preparing render: ${msg}` }],
        isError: true,
      };
    }
  }
);
```

### Chokidar Watcher with awaitWriteFinish

```typescript
// Source: chokidar v4 documentation (https://github.com/paulmillr/chokidar)

import chokidar from 'chokidar';

const watcher = chokidar.watch('/path/to/renders', {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,  // File size must be stable for 2 seconds
    pollInterval: 500,         // Check every 500ms
  },
  depth: 0,
  ignored: (path: string, stats) => {
    if (stats?.isFile()) return !path.toLowerCase().endsWith('.wav');
    return false;
  },
});

watcher.on('add', (filePath) => {
  console.log(`Render complete: ${filePath}`);
});

// Cleanup
await watcher.close();
```

### list_renders Tool

```typescript
// Source: Project pattern

server.tool(
  'list_renders',
  'List all rendered WAV files detected this session. These are available for sample manipulation.',
  {},
  async () => {
    const renders = renderRegistry.getAll();
    if (renders.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No renders detected yet. Use render_pattern to render a pattern to WAV first.',
        }],
      };
    }

    const lines = [`Rendered files (${renders.length}):\n`];
    for (const r of renders) {
      const time = new Date(r.timestamp).toLocaleTimeString();
      lines.push(`  ${r.filename}`);
      lines.push(`    Path: ${r.path}`);
      lines.push(`    Detected: ${time}`);
      if (r.patternName) lines.push(`    Source: ${r.patternName}`);
      lines.push('');
    }

    return { content: [{ type: 'text', text: lines.join('\n').trimEnd() }] };
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.watch` for file detection | chokidar with platform normalization | chokidar v4 (Sep 2024) | Reliable cross-platform watching, especially on Windows |
| Hoping for FL Studio render API | Accepting manual workflow + smart automation around it | Confirmed in prior research (2026-02-23) | Clear architecture decision: guide user, detect result |
| chokidar v3 with 13 dependencies | chokidar v4 with 1 dependency | Sep 2024 | Lighter install, TypeScript native |

**Deprecated/outdated:**
- chokidar glob support: Removed in v4. Use `ignored` filter function instead.
- `@types/chokidar`: Not needed -- chokidar v4+ has built-in TypeScript types.
- `fs.watchFile` polling approach: chokidar handles this internally when needed.

## FL Studio API Constraints (Verified)

These constraints are documented from prior research and HIGH confidence official sources:

| Constraint | Verified Source | Impact on Phase 6 |
|------------|----------------|--------------------|
| No render/export API function | FL Studio API Stubs -- general, transport modules | Must use guided manual workflow |
| No Ctrl+R keyboard simulation | UI keyboard module lacks modifier keys | Cannot trigger export programmatically |
| No project file path API | general module only has getProjectTitle/Author/Genre | Cannot determine FL Studio data folder path |
| `transport.getLoopMode()` returns 0=pattern, 1=song | FL Studio API Stubs -- transport module | CAN check and warn about pattern vs song mode |
| `patterns.patternNumber()` and `patterns.getPatternName()` available | Already used in existing handlers | CAN read current pattern info for smart filenames |
| `channels.getChannelName()` available | Already used in existing handlers | CAN read channel names for context |

## Open Questions

1. **FL Studio export dialog default directory**
   - What we know: FL Studio remembers the last export directory per session. On fresh install, there is no fixed default -- it opens a "Save As" dialog. Users can set a project data folder via Options, which creates a `rendered` subfolder.
   - What's unclear: Whether there is a way to read or predict the export dialog's default directory from outside FL Studio.
   - Recommendation: Use a MCP-server-managed directory (`~/Documents/FL Studio MCP/Renders/`) as the recommended output path. Instruct the user to navigate there. This gives the watcher a predictable location to monitor.

2. **Concurrent render detection**
   - What we know: chokidar can detect multiple files appearing in the same directory.
   - What's unclear: Whether the user might render multiple patterns in rapid succession, and whether the watcher needs to handle this.
   - Recommendation: The watcher detects ALL new .wav files in the directory, not just the expected filename. Register all detected renders in the registry.

3. **File watcher lifecycle management**
   - What we know: The watcher should be a singleton. It should start on first `render_pattern` call and persist for the MCP session.
   - What's unclear: Whether the watcher should stop when the MCP server disconnects from FL Studio, or persist for the entire process lifetime.
   - Recommendation: Start on first use, stop on process exit (or when `connection.disconnect()` is called). chokidar's `close()` is async and clean.

## Sources

### Primary (HIGH confidence)
- [FL Studio API Stubs - transport module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/transport/) - getLoopMode (0=pattern, 1=song), no render command
- [FL Studio API Stubs - general module](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/general/) - getProjectTitle but no file path functions
- [FL Studio Export Documentation](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/fformats_save_export.htm) - Export dialog settings, WAV format options, pattern vs song mode
- [chokidar GitHub](https://github.com/paulmillr/chokidar) - v4 API, awaitWriteFinish, TypeScript types, ESM support
- [chokidar npm](https://www.npmjs.com/package/chokidar) - v4.0.3 latest in v4 line, v5.0.0 ESM-only
- Prior project research: `.planning/research/ARCHITECTURE.md` - Confirmed no render API exists
- Prior project research: `.planning/research/STACK.md` - chokidar selected for file watching

### Secondary (MEDIUM confidence)
- [FL Studio Forum - Render as Audio Clip](https://forum.image-line.com/viewtopic.php?t=324022) - Rendered files go to `data/patches/rendered` subfolder
- [FL Studio Forum - Consolidated WAV location](https://forum.image-line.com/viewtopic.php?t=193031) - Project data folder settings control render output
- [FL Studio Forum - Export default directory](https://forum.image-line.com/viewtopic.php?t=308980) - Export dialog remembers last used location
- [chokidar GitHub Issue #675](https://github.com/paulmillr/chokidar/issues/675) - awaitWriteFinish with large files, stabilityThreshold tuning
- [Migrating chokidar 3.x to 4.x](https://dev.to/43081j/migrating-from-chokidar-3x-to-4x-5ab5) - Glob removal, filter function pattern

### Tertiary (LOW confidence)
- FL Studio export dialog default directory behavior (no authoritative source found; varies by user configuration)
- Whether chokidar v4 awaitWriteFinish works perfectly for 100MB+ WAV files on Windows (documented issues exist, but stabilityThreshold=2000 should handle typical renders)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - chokidar is well-established, v4 API is stable and TypeScript-native
- Architecture: HIGH - Simple pattern: MCP tool + file watcher + registry. No new FL Bridge code needed.
- Pitfalls: HIGH - Based on concrete analysis of FL Studio API gaps and chokidar behavior
- Code patterns: HIGH - Based on existing project patterns (tools, bridge, types)

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (chokidar v4 is stable; FL Studio API changes are infrequent)
