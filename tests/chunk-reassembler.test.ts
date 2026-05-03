import { describe, it, expect } from 'vitest';
import { ChunkReassembler } from '../src/bridge/chunk-reassembler.js';
import { SysExCodec } from '../src/bridge/sysex-codec.js';

/**
 * The reassembler exists so that the bug class we hit in commit a1121ca
 * (stale fragments leaking across clientId reuse) cannot regress silently.
 * Test the protocol behavior, not the implementation detail.
 */

function chunk(clientId: number, payload: string, isFinal: boolean): number[] {
  return [
    0xf0,
    0x7d,
    0x01,
    clientId & 0x7f,
    isFinal ? 0x00 : 0x01,
    0x02,
    0x00,
    ...Array.from(payload).map((c) => c.charCodeAt(0)),
    0xf7,
  ];
}

function buildAndChunk(payloadObj: object, clientId: number, chunkSize: number): number[][] {
  const json = JSON.stringify(payloadObj);
  const b64 = Buffer.from(json, 'utf-8').toString('base64');
  const chunks: number[][] = [];
  for (let i = 0; i < b64.length; i += chunkSize) {
    const slice = b64.slice(i, i + chunkSize);
    const isFinal = i + chunkSize >= b64.length;
    chunks.push(chunk(clientId, slice, isFinal));
  }
  return chunks;
}

describe('ChunkReassembler', () => {
  it('passes single-chunk messages through unchanged', () => {
    const r = new ChunkReassembler();
    const [msg] = buildAndChunk({ success: true, data: 'small' }, 4, 1024);
    const out = r.push(msg);
    expect(out).not.toBeNull();
    expect(out!.message).toEqual(msg);
  });

  it('returns null for non-final chunks', () => {
    const r = new ChunkReassembler();
    const chunks = buildAndChunk({ success: true, data: 'x'.repeat(2000) }, 5, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(r.push(chunks[i])).toBeNull();
    }
  });

  it('reassembles a multi-chunk response into a decodable message', () => {
    const r = new ChunkReassembler();
    const original = { success: true, data: { params: 'a'.repeat(2000) } };
    const chunks = buildAndChunk(original, 9, 64);

    let final: number[] | null = null;
    for (const c of chunks) {
      const out = r.push(c);
      if (out) final = out.message;
    }
    expect(final).not.toBeNull();

    const decoded = SysExCodec.decode(final!);
    expect(decoded.clientId).toBe(9);
    expect(decoded.data).toEqual({ ...original, success: true });
  });

  it('keeps streams for different clientIds independent', () => {
    const r = new ChunkReassembler();
    const a = buildAndChunk({ data: 'a'.repeat(800) }, 1, 100);
    const b = buildAndChunk({ data: 'b'.repeat(800) }, 2, 100);

    // Interleave: chunk a0, b0, a1, b1, ...
    let aFinal: number[] | null = null;
    let bFinal: number[] | null = null;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i < a.length) {
        const out = r.push(a[i]);
        if (out) aFinal = out.message;
      }
      if (i < b.length) {
        const out = r.push(b[i]);
        if (out) bFinal = out.message;
      }
    }

    expect(aFinal).not.toBeNull();
    expect(bFinal).not.toBeNull();
    const decodedA = SysExCodec.decode(aFinal!);
    const decodedB = SysExCodec.decode(bFinal!);
    expect((decodedA.data.data as string).startsWith('aaaa')).toBe(true);
    expect((decodedB.data.data as string).startsWith('bbbb')).toBe(true);
  });

  it('drop() prevents stale fragments from corrupting the next stream', () => {
    // This is the regression that motivated the fix. Without drop(),
    // chunks from request N would fuse with chunks from request N+1
    // (after clientId wrap) and decode to garbage.
    const r = new ChunkReassembler();
    const stale = buildAndChunk({ data: 'x'.repeat(500) }, 7, 80);

    // Simulate first request: send 2 chunks, then "time out".
    r.push(stale[0]);
    r.push(stale[1]);
    expect(r.pendingCount()).toBe(1);
    r.drop(7);
    expect(r.pendingCount()).toBe(0);

    // Now reuse clientId 7 for a fresh request — it should decode cleanly.
    const fresh = buildAndChunk({ data: 'fresh-payload' }, 7, 1024);
    const out = r.push(fresh[0]);
    expect(out).not.toBeNull();
    const decoded = SysExCodec.decode(out!.message);
    expect(decoded.data.data).toBe('fresh-payload');
  });

  it('clear() resets all in-flight streams', () => {
    const r = new ChunkReassembler();
    r.push(buildAndChunk({ data: 'x'.repeat(500) }, 1, 80)[0]);
    r.push(buildAndChunk({ data: 'y'.repeat(500) }, 2, 80)[0]);
    expect(r.pendingCount()).toBe(2);
    r.clear();
    expect(r.pendingCount()).toBe(0);
  });
});
