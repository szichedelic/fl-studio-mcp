/**
 * Chunk reassembler for incoming SysEx responses.
 *
 * Multi-chunk responses use continuation=0x01 on every chunk except the
 * final one (continuation=0x00). Per-clientId state is held here so the
 * MidiClient stays focused on transport.
 */

export interface ReassembledMessage {
  /** Either the original single-chunk message, or a synthesised one whose
   *  payload concatenates every chunk we accumulated. */
  message: number[];
}

export class ChunkReassembler {
  private buffers: Map<number, number[][]> = new Map();

  /**
   * Feed one incoming SysEx message in.
   *
   * Returns null if this was a non-final chunk (still accumulating). Returns
   * a fully reassembled message once the final chunk arrives — or for
   * single-chunk messages, the original message unchanged.
   */
  push(message: number[]): ReassembledMessage | null {
    const clientId = message[3];
    const continuation = message[4];

    if (continuation === 0x01) {
      const payload = message.slice(7, -1);
      let buf = this.buffers.get(clientId);
      if (!buf) {
        buf = [];
        this.buffers.set(clientId, buf);
      }
      buf.push(payload);
      return null;
    }

    const buffered = this.buffers.get(clientId);
    if (!buffered || buffered.length === 0) {
      return { message };
    }

    const finalPayload = message.slice(7, -1);
    const combined = [...buffered.flat(), ...finalPayload];
    this.buffers.delete(clientId);
    return {
      message: [...message.slice(0, 7), ...combined, 0xf7],
    };
  }

  /** Drop any partial chunks for the given clientId (timeout / new request). */
  drop(clientId: number): void {
    this.buffers.delete(clientId);
  }

  /** Drop all partial chunks (disconnect). */
  clear(): void {
    this.buffers.clear();
  }

  /** Number of clientIds currently mid-stream. Used for tests / diagnostics. */
  pendingCount(): number {
    return this.buffers.size;
  }
}
