import { describe, it, expect, vi } from 'vitest';
import { runBridgeTool } from '../src/tools/util.ts';
import type { ConnectionManager } from '../src/bridge/connection.ts';

/**
 * runBridgeTool is the shared scaffold underneath ~30 tools, so any
 * regression in it cascades. Lock down the behavioral contract here.
 */

function fakeConnection(impl: ConnectionManager['executeCommand']): ConnectionManager {
  return { executeCommand: impl } as unknown as ConnectionManager;
}

describe('runBridgeTool', () => {
  it('passes args through unchanged when no buildParams given', async () => {
    const exec = vi.fn().mockResolvedValue({ success: true, data: 'ok' });
    const conn = fakeConnection(exec);

    await runBridgeTool(conn, {
      action: 'foo.bar',
      args: { x: 1, y: 'hello' },
      describe: 'do thing',
    });

    expect(exec).toHaveBeenCalledWith('foo.bar', { x: 1, y: 'hello' });
  });

  it('calls buildParams when provided', async () => {
    const exec = vi.fn().mockResolvedValue({ success: true });
    const conn = fakeConnection(exec);

    await runBridgeTool(conn, {
      action: 'mixer.set_volume',
      args: { track: 3, volume: 0.5 },
      buildParams: ({ track, volume }: { track: number; volume: number }) => ({ index: track, volume }),
      describe: 'set volume',
    });

    expect(exec).toHaveBeenCalledWith('mixer.set_volume', { index: 3, volume: 0.5 });
  });

  it('returns success content as pretty-printed JSON by default', async () => {
    const conn = fakeConnection(vi.fn().mockResolvedValue({ success: true, data: { foo: 1 } }));
    const out = await runBridgeTool(conn, {
      action: 'x',
      args: {},
      describe: 'do x',
    });
    expect(out.isError).toBeUndefined();
    expect(out.content[0].type).toBe('text');
    expect(out.content[0].text).toContain('"foo": 1');
  });

  it('uses formatSuccess if provided', async () => {
    const conn = fakeConnection(vi.fn().mockResolvedValue({ success: true, data: 42 }));
    const out = await runBridgeTool(conn, {
      action: 'x',
      args: {},
      describe: 'do x',
      formatSuccess: (r) => `Custom: ${(r.data as number) + 1}`,
    });
    expect(out.content[0].text).toBe('Custom: 43');
  });

  it('returns isError with bridge error message on bridge failure', async () => {
    const conn = fakeConnection(vi.fn().mockResolvedValue({ success: false, error: 'thing broke' }));
    const out = await runBridgeTool(conn, {
      action: 'x',
      args: {},
      describe: 'do x',
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('Failed to do x');
    expect(out.content[0].text).toContain('thing broke');
  });

  it('falls back to JSON if bridge response has no error string', async () => {
    const conn = fakeConnection(vi.fn().mockResolvedValue({ success: false, partial: true }));
    const out = await runBridgeTool(conn, {
      action: 'x',
      args: {},
      describe: 'do x',
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('partial');
  });

  it('catches transport errors and returns isError', async () => {
    const conn = fakeConnection(vi.fn().mockRejectedValue(new Error('socket closed')));
    const out = await runBridgeTool(conn, {
      action: 'x',
      args: {},
      describe: 'do x',
    });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain('Error do x');
    expect(out.content[0].text).toContain('socket closed');
  });
});
