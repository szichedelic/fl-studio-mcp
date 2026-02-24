# Phase 4: Generic Plugin Control - Research

**Researched:** 2026-02-23
**Domain:** FL Studio plugins Python API, SysEx chunking, parameter management
**Confidence:** MEDIUM (API surface verified from official stubs; SysEx limits verified from compiled source; getParamValue reliability and FL Studio receive-side buffer are LOW confidence)

## Summary

Phase 4 requires building bidirectional plugin parameter control through the existing FL Bridge SysEx protocol. The FL Studio `plugins` Python module provides a complete API for discovering and manipulating any plugin's parameters by index. VST plugins report a fixed 4240 parameter slots (4096 standard + 128 MIDI CC + 16 aftertouch), but most are blank/unnamed -- filtering to only named parameters is the core discovery challenge.

The critical technical blocker is **SysEx message size limits**. The project's node-midi package (v2.0.0) compiles RtMidi with `RT_SYSEX_BUFFER_SIZE=2048` on Windows, meaning incoming SysEx messages are silently discarded if they exceed 2048 bytes. Even 30 parameters with names would produce ~1420 bytes of SysEx payload, and a typical VST with 100+ named parameters would produce 6000+ bytes. **Response chunking is mandatory** before any plugin parameter discovery can work.

The shadow state decision (already locked in STATE.md) is the right call. While I could not find specific bug reports about `getParamValue` returning wrong values, the pattern of maintaining a local cache of set values is a well-established defensive practice. Shadow state should live on the Node.js/TypeScript side as an in-memory Map, since it needs to survive individual command roundtrips but not FL Studio restarts (parameters reset to plugin defaults on restart anyway).

**Primary recommendation:** Implement SysEx response chunking first (both Python send-side and TypeScript receive-side), then build plugin parameter handlers on top of the chunked protocol. Parameter name-to-index resolution should be cached on the TypeScript side to avoid repeated 4240-iteration scans.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FL Studio `plugins` module | Built-in (FL Studio v21+) | All parameter discovery and control | Only API for plugin access from MIDI scripts |
| FL Studio `channels` module | Built-in | Get selected channel index for plugin targeting | Required to resolve "current plugin" |
| FL Studio `mixer` module | Built-in | Get mixer track/slot for effect plugins | Required for mixer plugin targeting |
| `zod` (already installed) | ^3.25.30 | MCP tool input validation | Already in project, use for plugin tool params |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Hand-rolled fuzzy match | N/A | Parameter name resolution | Simple normalized string includes/startsWith is sufficient for Phase 4; save Fuse.js for Phase 5 if needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled fuzzy match | Fuse.js (~30KB) | Overkill for Phase 4 where exact/prefix match suffices; revisit for Phase 5 Serum semantic names |
| In-memory shadow state | File-based cache | Adds complexity for no benefit (state is invalid after FL Studio restart anyway) |
| Command-level pagination | Protocol-level chunking | Pagination is simpler but forces all callers to handle it; chunking is transparent once built |

**Installation:**
No new dependencies needed. All FL Studio modules are built-in. TypeScript side uses existing `zod` for tool validation.

## Architecture Patterns

### Recommended Project Structure

```
fl-bridge/
  handlers/
    plugins.py              # NEW: plugin parameter handlers
src/
  bridge/
    sysex-codec.ts          # MODIFY: add chunk reassembly
    midi-client.ts          # MODIFY: accumulate chunked responses
  plugins/
    param-cache.ts          # NEW: parameter name->index cache
    shadow-state.ts         # NEW: shadow state for set values
    types.ts                # NEW: plugin-related types
  tools/
    plugins.ts              # NEW: MCP tool definitions
```

### Pattern 1: Chunked SysEx Response (Python send-side)

**What:** Split large responses into multiple SysEx messages using the continuation byte (byte 4 in protocol).
**When to use:** Any response exceeding ~1800 bytes of base64 payload (conservative limit under 2048 buffer).

```python
# fl-bridge/protocol/sysex.py - new function
# Source: Flapi Protocol.md (MAX_DATA_LEN = 1000), adapted for our protocol

MAX_PAYLOAD_BYTES = 1800  # Conservative: 2048 buffer - 8 header bytes - safety margin

def build_chunked_sysex_response(client_id, response, success=True):
    """Build one or more SysEx messages, chunking if payload exceeds limit."""
    json_str = json.dumps(response)
    json_bytes = json_str.encode('utf-8')
    base64_str = base64.b64encode(json_bytes).decode('ascii')

    chunks = []
    for i in range(0, len(base64_str), MAX_PAYLOAD_BYTES):
        chunk_payload = base64_str[i:i + MAX_PAYLOAD_BYTES]
        is_last = (i + MAX_PAYLOAD_BYTES >= len(base64_str))
        continuation = 0x00 if is_last else 0x01

        message = [
            SYSEX_START, MANUFACTURER_ID, ORIGIN_SERVER,
            client_id & 0x7F, continuation,
            MSG_TYPE_RESPONSE,
            STATUS_OK if success else STATUS_ERROR,
            *[ord(c) for c in chunk_payload],
            SYSEX_END
        ]
        chunks.append(message)

    return chunks
```

### Pattern 2: Chunked SysEx Reassembly (TypeScript receive-side)

**What:** Accumulate continuation messages and reassemble into a single response.
**When to use:** Any incoming SysEx with continuation byte = 0x01.

```typescript
// src/bridge/midi-client.ts - modification to handleMessage
// Accumulation buffer per clientId

private chunkBuffers: Map<number, number[][]> = new Map();

private handleMessage(deltaTime: number, message: number[]): void {
  if (!SysExCodec.isValid(message)) return;

  const continuation = message[4];
  const clientId = message[3];

  if (continuation === 0x01) {
    // More chunks coming -- accumulate payload bytes
    const payloadBytes = message.slice(7, -1); // exclude F7
    if (!this.chunkBuffers.has(clientId)) {
      this.chunkBuffers.set(clientId, []);
    }
    this.chunkBuffers.get(clientId)!.push(payloadBytes);
    return; // Don't resolve yet
  }

  // continuation === 0x00 -- final chunk
  let fullPayload: number[];
  const buffered = this.chunkBuffers.get(clientId);
  if (buffered && buffered.length > 0) {
    // Combine all accumulated chunks + this final chunk's payload
    const finalPayload = message.slice(7, -1);
    fullPayload = [...buffered.flat(), ...finalPayload];
    this.chunkBuffers.delete(clientId);
    // Build synthetic complete message for decoding
    message = [
      ...message.slice(0, 7), // header
      ...fullPayload,
      0xF7 // end
    ];
  }

  // Decode complete message as before
  const { clientId: cid, data } = SysExCodec.decode(message);
  // ... resolve pending request
}
```

### Pattern 3: Plugin Parameter Discovery with Filtering

**What:** Iterate all 4240 parameter slots, return only those with non-empty names.
**When to use:** `plugins.discover` command handler.

```python
# fl-bridge/handlers/plugins.py
# Source: FL Studio API Stubs (IL-Group/FL-Studio-API-Stubs)

import plugins
import channels

def handle_plugin_discover(params):
    """Discover all named parameters for a plugin."""
    index = params.get('index', channels.selectedChannel())
    slot_index = params.get('slotIndex', -1)

    if not plugins.isValid(index, slot_index):
        return {'success': False, 'error': f'No valid plugin at index {index}, slot {slot_index}'}

    plugin_name = plugins.getPluginName(index, slot_index)
    param_count = plugins.getParamCount(index, slot_index)

    discovered = []
    for i in range(param_count):
        name = plugins.getParamName(i, index, slot_index)
        if name and name.strip():  # Filter blank/empty parameter names
            discovered.append({
                'index': i,
                'name': name,
                'value': plugins.getParamValue(i, index, slot_index)
            })

    return {
        'success': True,
        'pluginName': plugin_name,
        'channelIndex': index,
        'slotIndex': slot_index,
        'totalSlots': param_count,
        'parameters': discovered
    }
```

### Pattern 4: TypeScript Parameter Cache

**What:** Cache parameter name-to-index mapping per plugin instance to avoid re-scanning 4240 slots.
**When to use:** First discovery call and subsequent lookups.

```typescript
// src/plugins/param-cache.ts

interface PluginParamInfo {
  index: number;
  name: string;
}

interface CachedPlugin {
  pluginName: string;
  channelIndex: number;
  slotIndex: number;
  params: PluginParamInfo[];
  paramsByName: Map<string, PluginParamInfo>;  // lowercase name -> info
  discoveredAt: number;  // Date.now()
}

class ParamCache {
  private cache: Map<string, CachedPlugin> = new Map();

  private key(channelIndex: number, slotIndex: number): string {
    return `${channelIndex}:${slotIndex}`;
  }

  set(channelIndex: number, slotIndex: number, plugin: CachedPlugin): void {
    this.cache.set(this.key(channelIndex, slotIndex), plugin);
  }

  resolveParam(channelIndex: number, slotIndex: number, name: string): PluginParamInfo | undefined {
    const cached = this.cache.get(this.key(channelIndex, slotIndex));
    if (!cached) return undefined;

    const normalized = name.toLowerCase().trim();
    // Exact match first
    const exact = cached.paramsByName.get(normalized);
    if (exact) return exact;

    // Prefix match
    for (const [key, info] of cached.paramsByName) {
      if (key.startsWith(normalized) || normalized.startsWith(key)) {
        return info;
      }
    }

    // Contains match
    for (const [key, info] of cached.paramsByName) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return info;
      }
    }

    return undefined;
  }

  invalidate(channelIndex?: number, slotIndex?: number): void {
    if (channelIndex !== undefined && slotIndex !== undefined) {
      this.cache.delete(this.key(channelIndex, slotIndex));
    } else {
      this.cache.clear();
    }
  }
}
```

### Pattern 5: Shadow State for Parameter Values

**What:** Maintain a TypeScript-side record of every parameter value set through our system.
**When to use:** Every `setParamValue` call updates shadow state; every `getParamValue` checks shadow state first.

```typescript
// src/plugins/shadow-state.ts

interface ShadowValue {
  value: number;        // 0.0 - 1.0
  setAt: number;        // Date.now()
  source: 'user' | 'discovered';
}

class ShadowState {
  // key: "channelIndex:slotIndex:paramIndex"
  private state: Map<string, ShadowValue> = new Map();

  private key(ch: number, slot: number, param: number): string {
    return `${ch}:${slot}:${param}`;
  }

  set(ch: number, slot: number, param: number, value: number): void {
    this.state.set(this.key(ch, slot, param), {
      value,
      setAt: Date.now(),
      source: 'user'
    });
  }

  get(ch: number, slot: number, param: number): ShadowValue | undefined {
    return this.state.get(this.key(ch, slot, param));
  }

  // Called on discovery to populate initial values
  populateFromDiscovery(ch: number, slot: number, params: Array<{index: number, value: number}>): void {
    for (const p of params) {
      const existing = this.state.get(this.key(ch, slot, p.index));
      if (!existing || existing.source === 'discovered') {
        this.state.set(this.key(ch, slot, p.index), {
          value: p.value,
          setAt: Date.now(),
          source: 'discovered'
        });
      }
    }
  }

  clear(): void {
    this.state.clear();
  }
}
```

### Anti-Patterns to Avoid

- **Scanning all 4240 params on every get/set:** Cache the name->index mapping on first discovery; only re-scan if plugin changes or cache is invalidated.
- **Sending unchunked large responses:** Even if it works today with loopMIDI, the 2048-byte buffer limit is hard-coded. Always chunk.
- **Trusting getParamValue after setParamValue:** Some VSTs don't reflect changes immediately. Prefer shadow state for values we've set.
- **Using paramIndex 0 as a sentinel:** Index 0 is a valid parameter. Use -1 or undefined for "not found."
- **Storing shadow state persistently:** It becomes stale the moment the user touches the plugin GUI. It's only useful for values *we* set in the current session.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SysEx framing/encoding | Custom binary protocol | Existing sysex.py / sysex-codec.ts | Already tested, just extend for chunking |
| Plugin API access | Direct MIDI CC manipulation | FL Studio `plugins` module | The module handles all VST/AU communication internally |
| Input validation | Manual param checking | `zod` schemas (already installed) | Type-safe, generates good error messages |
| Parameter indexing for FL native plugins | Manual lookup tables | `plugins.getParamName()` iteration | Works universally for any plugin |
| Complex fuzzy matching | Levenshtein distance impl | Simple normalize + includes/startsWith | Sufficient for Phase 4; reconsider for Phase 5 |

**Key insight:** The FL Studio `plugins` module already does the hard work of communicating with VST/AU plugins. Our job is just plumbing: discover names, cache mappings, route get/set calls. The only genuinely new engineering is the SysEx chunking layer.

## Common Pitfalls

### Pitfall 1: SysEx Buffer Overflow (Silent Data Loss)

**What goes wrong:** Response exceeds 2048 bytes, node-midi's RtMidi silently discards the entire message. The MCP server sees a timeout instead of a response.
**Why it happens:** RtMidi on Windows uses pre-allocated fixed-size buffers (`RT_SYSEX_BUFFER_SIZE=2048` in this project's node-midi build). Messages larger than the buffer are silently dropped.
**How to avoid:** Always use chunked responses. Set max chunk payload to 1800 base64 chars (conservative margin under 2048 total).
**Warning signs:** Timeout errors on commands that should succeed; works for small plugins but fails for large ones.

### Pitfall 2: Channel Index vs. Mixer Index Confusion

**What goes wrong:** Passing a mixer track index where a channel index is expected (or vice versa), causing wrong plugin or crash.
**Why it happens:** The `plugins` module uses the same `index` parameter for both channel rack and mixer, distinguished only by `slotIndex` (-1 for channel rack, 0-9 for mixer slots).
**How to avoid:** Require explicit `slotIndex` parameter. Default to -1 (channel rack). Document clearly in MCP tool descriptions.
**Warning signs:** "Plugin not valid" errors when the plugin clearly exists.

### Pitfall 3: Iterating All 4240 Parameters Synchronously

**What goes wrong:** Calling `getParamName` 4240 times in a single handler blocks FL Studio's audio/UI thread.
**Why it happens:** FL Studio Python scripts run on the main thread. No threading available.
**How to avoid:** Accept that the scan will take some time (~50-200ms for 4240 calls based on community reports). This is acceptable for a one-time discovery. Cache results aggressively on the TypeScript side. Do NOT try to split the iteration across OnIdle calls -- it adds complexity for marginal benefit.
**Warning signs:** Audio glitches during parameter discovery (unlikely for a single scan, but possible if done repeatedly).

### Pitfall 4: Empty String Parameter Names

**What goes wrong:** VST plugins pad their parameter list with empty-string names for unused slots. Returning all 4240 produces a useless response.
**Why it happens:** VST spec allocates 4096 parameter slots; most plugins use far fewer. FL Studio reports empties as `""`.
**How to avoid:** Filter: `if name and name.strip()`. Some plugins may have parameters named with only spaces, so strip before checking.
**Warning signs:** Discovery returns thousands of parameters with blank names.

### Pitfall 5: Shadow State Becomes Stale

**What goes wrong:** User changes a parameter via the FL Studio GUI, but shadow state still holds the old value.
**Why it happens:** Shadow state only tracks changes made through our MCP tools, not GUI interactions.
**How to avoid:** Shadow state should only be used as fallback. For reads, try `getParamValue` from FL Studio first; fall back to shadow state only if the FL Studio value seems wrong or if the caller specifically wants the "last set" value. Include a `source` field so callers know whether they're getting a live value or a shadow value.
**Warning signs:** Param values seem "stuck" at previously set values even after manual adjustment.

### Pitfall 6: Plugin Loading Changes Indices

**What goes wrong:** Adding or removing a channel shifts all subsequent channel indices, invalidating the parameter cache.
**Why it happens:** Channel indices in FL Studio are positional, not stable IDs.
**How to avoid:** Cache by channel index but provide a `refresh` command to invalidate cache. Consider using channel name as a secondary key for user-facing commands (though name can also change).
**Warning signs:** Parameters map to wrong plugin after channel rack changes.

## Code Examples

### FL Studio `plugins` Module API (Complete Reference)

```python
# Source: IL-Group/FL-Studio-API-Stubs, verified against official docs
import plugins

# === Validation ===
plugins.isValid(index, slotIndex=-1, useGlobalIndex=False)  # -> bool

# === Plugin Info ===
plugins.getPluginName(index, slotIndex=-1, userName=False, useGlobalIndex=False)  # -> str
# userName=True returns user-assigned name (e.g., "My Serum Bass")

# === Parameter Discovery ===
plugins.getParamCount(index, slotIndex=-1, useGlobalIndex=False)  # -> int
# Returns 4240 for VST plugins (4096 params + 128 MIDI CC + 16 aftertouch)

plugins.getParamName(paramIndex, index, slotIndex=-1, useGlobalIndex=False)  # -> str
# Returns "" for unused parameter slots

# === Parameter Values ===
plugins.getParamValue(paramIndex, index, slotIndex=-1, useGlobalIndex=False)  # -> float
# Range: 0.0 to 1.0 (normalized)

plugins.setParamValue(value, paramIndex, index, slotIndex=-1, pickupMode=0, useGlobalIndex=False)  # -> None
# value: 0.0 to 1.0 (normalized)
# pickupMode: 0=disabled, 1=always, 2=FL Studio setting

plugins.getParamValueString(paramIndex, index, slotIndex=-1, pickupMode=0, useGlobalIndex=False)  # -> str
# Returns human-readable value (e.g., "440 Hz", "75%"). Only some FL Studio native plugins support this.

# === Presets ===
plugins.getPresetCount(index, slotIndex=-1, useGlobalIndex=False)  # -> int
plugins.nextPreset(index, slotIndex=-1, useGlobalIndex=False)  # -> None
plugins.prevPreset(index, slotIndex=-1, useGlobalIndex=False)  # -> None

# === Advanced ===
plugins.getName(index, slotIndex=-1, flag=FPN_Param, paramIndex=0, useGlobalIndex=False)  # -> str
# flag values: FPN_Param(0), FPN_ParamValue(1), FPN_Semitone(2), FPN_Patch(3),
#              FPN_VoiceLevel(4), FPN_VoiceLevelHint(5), FPN_Preset(6), FPN_OutCtrl(7), FPN_VoiceColor(8), FPN_OutVoice(9)
```

### Indexing Conventions

```python
# Channel rack plugin (generator):
plugins.isValid(channelIndex)                     # slotIndex defaults to -1
plugins.getParamName(0, channelIndex)             # first param of channel plugin

# Mixer effect plugin:
plugins.isValid(mixerTrackIndex, slotIndex=0)     # first effect slot on mixer track
plugins.getParamName(0, mixerTrackIndex, 0)       # first param of first effect

# Using global channel index (FL Studio v26+):
plugins.isValid(globalIndex, useGlobalIndex=True) # ignores channel groups
```

### Response Chunking Send Pattern (Python)

```python
# In OnSysEx handler, replace single send with chunked send:

def send_response(client_id, result):
    """Send response, chunking if needed."""
    chunks = build_chunked_sysex_response(
        client_id=client_id,
        response=result,
        success=result.get('success', True)
    )
    for chunk in chunks:
        device.midiOutSysex(bytes(chunk))
```

### MCP Tool Definition Pattern

```typescript
// Source: existing project pattern from src/tools/state.ts
import { z } from 'zod';

server.tool(
  'discover_plugin_params',
  'Discover all named parameters of a loaded plugin. Returns parameter names and current values.',
  {
    channelIndex: z.number().int().min(0).optional()
      .describe('Channel rack index. Omit to use selected channel.'),
    slotIndex: z.number().int().min(-1).max(9).default(-1)
      .describe('Mixer effect slot (-1 for channel rack plugin, 0-9 for mixer effects)'),
  },
  async ({ channelIndex, slotIndex }) => {
    // Check cache first, then call FL Bridge if needed
    const result = await connection.executeCommand('plugins.discover', {
      index: channelIndex,
      slotIndex,
    });
    // Update param cache and shadow state from discovery
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| plugins API unavailable | Full plugins module with getParam*/setParam* | FL Studio 20.7.3 (Oct 2020) | Enabled scripted plugin control for first time |
| Only channel rack plugins | Mixer effect slot support via slotIndex | Same release | Full mixer plugin access |
| Grouped channel index only | `useGlobalIndex` parameter | FL Studio v26+ (API v26) | Reliable indexing regardless of channel grouping |
| Manual parameter lookup tables | `getParamName()` iteration | Always available | Universal discovery, no per-plugin dictionaries needed |

**Deprecated/outdated:**
- Per-plugin parameter dictionaries (like forgery810/vst-parameters): These are fragile, version-specific, and unnecessary when `getParamName()` is available at runtime.

## Open Questions

1. **FL Studio receive-side SysEx buffer limit**
   - What we know: `device.midiOutSysex()` has no documented output size limit. Node-midi output also has no size limit (confirmed in RtMidi docs: "There is no such limit for outgoing sysex messages via RtMidiOut").
   - What's unclear: What is FL Studio's buffer for *incoming* SysEx (from MCP to FL)? Our current commands are small (< 200 bytes) so this hasn't been an issue. Chunking is only needed for FL-to-MCP responses currently.
   - Recommendation: Keep outgoing commands small (they already are). Monitor for issues if we ever need to send large payloads to FL Studio.

2. **getParamValue reliability specifics**
   - What we know: The project decision says "getParamValue unreliable for VSTs." Could not find specific bug reports or documentation confirming this.
   - What's unclear: Is it all VSTs? Specific hosts? Specific param types? Stale values? Zero values?
   - Recommendation: Build shadow state as decided, but treat `getParamValue` as the primary source. Shadow state is the fallback. Include both values in responses so the user/planner can validate during Phase 4 testing.

3. **FL Studio main thread blocking during 4240-param scan**
   - What we know: FL Studio Python scripts run single-threaded. A 4240-iteration loop blocks the audio/UI thread.
   - What's unclear: How long does the scan actually take? Reports suggest 50-200ms, but this is unverified.
   - Recommendation: Accept the blocking for discovery (one-time cost per plugin). Cache aggressively. If it proves too slow, consider returning first N params and paginating at command level.

4. **useGlobalIndex requirement**
   - What we know: Available since API v26. Makes channel indexing consistent.
   - What's unclear: What FL Studio version is the user running? Does FL Bridge need to detect API version?
   - Recommendation: Default to `useGlobalIndex=False` for backward compatibility. Add it as an optional parameter on tools.

## Sources

### Primary (HIGH confidence)
- [IL-Group/FL-Studio-API-Stubs](https://github.com/IL-Group/FL-Studio-API-Stubs) - `plugins/__init__.py` full function signatures, parameter types, return types
- [FL Studio Official Manual - MIDI Scripting](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm) - Official API reference
- [FL Studio Python API Docs](https://il-group.github.io/FL-Studio-API-Stubs/midi_controller_scripting/) - Online documentation portal
- Node-midi v2.0.0 binding.gyp source - `RT_SYSEX_BUFFER_SIZE=2048` (verified in local `node_modules/midi/binding.gyp` line 63)
- RtMidi source (vendored in node-midi) - Buffer allocation code, `RT_SYSEX_BUFFER_COUNT=4`, no outgoing size limit

### Secondary (MEDIUM confidence)
- [Flapi Protocol](https://github.com/MaddyGuthridge/Flapi) - `MAX_DATA_LEN=1000`, chunking protocol design, continuation byte pattern (verified via _consts.py and Protocol.md references)
- [forgery810/vst-parameters](https://github.com/forgery810/vst-parameters) - Real-world parameter dictionary examples, empty string key observations
- [flemcee FL Studio MCP](https://glama.ai/mcp/servers/@tylerjharden/flemcee) - Uses `limit=64` default for parameter listing (pagination approach)
- [fl_param_checker](https://github.com/MaddyGuthridge/fl_param_checker) - Plugin parameter index discovery tool (change detection approach)

### Tertiary (LOW confidence)
- Community reports of getParamValue reliability issues (referenced in project STATE.md but no specific bug reports found)
- FL Studio forum discussions on SysEx message handling (sparse, mostly unanswered questions)
- Main thread blocking estimates for 4240-param scan (50-200ms, unverified community reports)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - API surface fully verified from official stubs and documentation
- Architecture (chunking): HIGH - Buffer size verified from compiled source code in node_modules
- Architecture (parameter handling): MEDIUM - API verified but runtime behavior needs hands-on testing
- Pitfalls: MEDIUM - Based on API analysis and community patterns, but FL Studio specifics unverified
- Shadow state design: MEDIUM - Sound engineering practice but getParamValue bug specifics unknown

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain; FL Studio API changes are infrequent)
