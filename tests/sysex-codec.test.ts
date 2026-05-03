import { describe, it, expect } from 'vitest';
import { SysExCodec } from '../src/bridge/sysex-codec.js';
import type { FLCommand } from '../src/bridge/types.js';

/**
 * The codec is the wire format. If any of these tests break, the bridge
 * silently corrupts traffic in production. Round-trip + boundary cases.
 */

function buildResponseSysEx(
  clientId: number,
  payload: object,
  status: 'ok' | 'error' = 'ok',
  origin: 'server' | 'client' = 'server',
): number[] {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf-8').toString('base64');
  const payloadBytes = Array.from(b64).map((c) => c.charCodeAt(0));
  return [
    0xf0,
    0x7d,
    origin === 'server' ? 0x01 : 0x00,
    clientId & 0x7f,
    0x00,
    0x02, // response msg type
    status === 'ok' ? 0x00 : 0x01,
    ...payloadBytes,
    0xf7,
  ];
}

describe('SysExCodec.encode', () => {
  it('frames the message with start/manufacturer/end bytes', () => {
    const cmd: FLCommand = { action: 'transport.start', params: {} };
    const bytes = SysExCodec.encode(cmd, 5);
    expect(bytes[0]).toBe(0xf0);
    expect(bytes[1]).toBe(0x7d);
    expect(bytes[bytes.length - 1]).toBe(0xf7);
  });

  it('places origin=client, response=command, status=ok in the header', () => {
    const bytes = SysExCodec.encode({ action: 'noop', params: {} }, 1);
    expect(bytes[2]).toBe(0x00); // origin: client
    expect(bytes[4]).toBe(0x00); // continuation: complete
    expect(bytes[5]).toBe(0x01); // msgType: command
    expect(bytes[6]).toBe(0x00); // status: ok
  });

  it('masks clientId to 7 bits', () => {
    const bytes = SysExCodec.encode({ action: 'noop', params: {} }, 0xff);
    expect(bytes[3]).toBe(0x7f);
  });

  it('payload bytes are all printable 7-bit ASCII (base64 alphabet)', () => {
    const cmd: FLCommand = {
      action: 'notes.write',
      params: { count: 64, scale: 'A minor' },
    };
    const bytes = SysExCodec.encode(cmd, 12);
    const payload = bytes.slice(7, -1);
    for (const b of payload) {
      expect(b).toBeGreaterThanOrEqual(0x20);
      expect(b).toBeLessThanOrEqual(0x7e);
    }
  });

  it('encodes Unicode payloads as valid base64', () => {
    const cmd: FLCommand = {
      action: 'pattern.rename',
      params: { name: 'メロディ — chorus' },
    };
    const bytes = SysExCodec.encode(cmd, 7);
    const payload = bytes.slice(7, -1);
    const b64 = String.fromCharCode(...payload);
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    expect(JSON.parse(decoded)).toEqual(cmd);
  });
});

describe('SysExCodec.decode', () => {
  it('round-trips a server response payload', () => {
    const sysex = buildResponseSysEx(7, { success: true, data: { tempo: 128 } });
    const { clientId, data } = SysExCodec.decode(sysex);
    expect(clientId).toBe(7);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ tempo: 128 });
  });

  it('marks status=error responses as success=false even if body says otherwise', () => {
    const sysex = buildResponseSysEx(3, { success: true, data: 'oops' }, 'error');
    const { data } = SysExCodec.decode(sysex);
    expect(data.success).toBe(false);
  });

  it('rejects messages from origin=client (we only consume server responses)', () => {
    const sysex = buildResponseSysEx(2, { success: true }, 'ok', 'client');
    expect(() => SysExCodec.decode(sysex)).toThrow(/origin/i);
  });

  it('rejects too-short messages', () => {
    expect(() => SysExCodec.decode([0xf0, 0x7d, 0x01, 0xf7])).toThrow(/too short/i);
  });

  it('rejects bad start byte', () => {
    const sysex = buildResponseSysEx(1, { success: true });
    sysex[0] = 0xab;
    expect(() => SysExCodec.decode(sysex)).toThrow(/start byte/i);
  });

  it('rejects wrong manufacturer ID', () => {
    const sysex = buildResponseSysEx(1, { success: true });
    sysex[1] = 0x42;
    expect(() => SysExCodec.decode(sysex)).toThrow(/manufacturer/i);
  });

  it('rejects bad end byte', () => {
    const sysex = buildResponseSysEx(1, { success: true });
    sysex[sysex.length - 1] = 0x00;
    expect(() => SysExCodec.decode(sysex)).toThrow(/end byte/i);
  });

  it('rejects malformed JSON in payload', () => {
    // Build a payload of base64('{not json') and frame it.
    const bogus = Buffer.from('{not json', 'utf-8').toString('base64');
    const payload = Array.from(bogus).map((c) => c.charCodeAt(0));
    const sysex = [0xf0, 0x7d, 0x01, 0x01, 0x00, 0x02, 0x00, ...payload, 0xf7];
    expect(() => SysExCodec.decode(sysex)).toThrow(/json/i);
  });
});

describe('SysExCodec.isValid', () => {
  it('accepts a well-formed message', () => {
    expect(SysExCodec.isValid(buildResponseSysEx(1, { success: true }))).toBe(true);
  });

  it('rejects messages without our manufacturer ID', () => {
    expect(SysExCodec.isValid([0xf0, 0x42, 0x01, 0x01, 0x00, 0x02, 0x00, 0xf7])).toBe(false);
  });

  it('rejects messages that do not end with F7', () => {
    expect(SysExCodec.isValid([0xf0, 0x7d, 0x01, 0x01, 0x00, 0x02, 0x00, 0xee])).toBe(false);
  });
});
