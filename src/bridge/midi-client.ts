/**
 * MIDI Client for FL Studio Bridge Communication
 *
 * Manages MIDI port connections and handles sending/receiving
 * SysEx messages to communicate with FL Studio.
 */

import midi, { Input, Output } from 'midi';
import { SysExCodec } from './sysex-codec.js';
import { ChunkReassembler } from './chunk-reassembler.js';
import { debugLog } from './debug-logger.js';
import type { FLCommand, FLResponse, PendingRequest, MidiPorts } from './types.js';

/** Default timeout for pending requests in milliseconds */
const DEFAULT_TIMEOUT = 5000;

export class MidiClient {
  private input: Input;
  private output: Output;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private reassembler = new ChunkReassembler();
  // clientId range is 1..127. 0 is reserved as the bridge's
  // "could not parse client id" sentinel, so we never assign it.
  private nextClientId = 1;
  private connected = false;

  constructor() {
    this.input = new midi.Input();
    this.output = new midi.Output();
  }

  /**
   * List available MIDI ports
   *
   * @returns Object with input and output port name arrays
   */
  listPorts(): MidiPorts {
    const inputs: string[] = [];
    const outputs: string[] = [];

    const inputCount = this.input.getPortCount();
    for (let i = 0; i < inputCount; i++) {
      inputs.push(this.input.getPortName(i));
    }

    const outputCount = this.output.getPortCount();
    for (let i = 0; i < outputCount; i++) {
      outputs.push(this.output.getPortName(i));
    }

    return { inputs, outputs };
  }

  /**
   * Find port index by name (partial match)
   *
   * @param portGetter - Function to get port name by index
   * @param portCount - Total number of ports
   * @param searchName - Name to search for (partial match)
   * @returns Port index or -1 if not found
   */
  private findPort(
    portGetter: (index: number) => string,
    portCount: number,
    searchName: string
  ): number {
    const searchLower = searchName.toLowerCase();
    for (let i = 0; i < portCount; i++) {
      const portName = portGetter(i).toLowerCase();
      if (portName.includes(searchLower)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Connect to MIDI ports by name
   *
   * @param inputPortName - Partial name of input port to connect
   * @param outputPortName - Partial name of output port to connect
   * @returns true if both ports connected successfully
   */
  connect(inputPortName: string, outputPortName: string): boolean {
    if (this.connected) {
      this.disconnect();
    }

    // Find input port
    const inputIndex = this.findPort(
      (i) => this.input.getPortName(i),
      this.input.getPortCount(),
      inputPortName
    );

    if (inputIndex === -1) {
      console.error(`[MidiClient] Input port not found: ${inputPortName}`);
      return false;
    }

    // Find output port
    const outputIndex = this.findPort(
      (i) => this.output.getPortName(i),
      this.output.getPortCount(),
      outputPortName
    );

    if (outputIndex === -1) {
      console.error(`[MidiClient] Output port not found: ${outputPortName}`);
      return false;
    }

    try {
      // Enable SysEx messages on input
      this.input.ignoreTypes(false, false, false);

      // Set up message handler
      this.input.on('message', (_deltaTime: number, message: number[]) => {
        this.handleMessage(message);
      });

      // Open ports
      this.input.openPort(inputIndex);
      this.output.openPort(outputIndex);

      this.connected = true;
      const inName = this.input.getPortName(inputIndex);
      const outName = this.output.getPortName(outputIndex);
      console.error(`[MidiClient] Connected: input=${inName}, output=${outName}`);
      debugLog(`Connected: input=${inName}, output=${outName}`);
      return true;
    } catch (error) {
      console.error(`[MidiClient] Connection failed:`, error);
      return false;
    }
  }

  /**
   * Send a command to FL Studio and wait for response
   *
   * @param action - The action to perform
   * @param params - Parameters for the action
   * @param timeout - Timeout in milliseconds (default 5000)
   * @returns Promise resolving to FL Studio's response
   */
  sendCommand(
    action: string,
    params: Record<string, unknown> = {},
    timeout = DEFAULT_TIMEOUT
  ): Promise<FLResponse> {
    if (!this.connected) {
      return Promise.reject(new Error('Not connected to MIDI ports'));
    }

    const clientId = this.nextClientId;
    // Cycle 1..127, skipping 0 (reserved as the bridge's parse-error sentinel).
    this.nextClientId = (this.nextClientId % 127) + 1;

    // Drop any stale chunk fragments left over from a previous request that
    // happened to use this id (e.g. timed out mid-stream).
    this.reassembler.drop(clientId);

    const command: FLCommand = { action, params };
    const sysexMessage = SysExCodec.encode(command, clientId);

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        debugLog(`TIMEOUT [${clientId}] ${action} after ${timeout}ms`);
        this.pendingRequests.delete(clientId);
        this.reassembler.drop(clientId);
        reject(new Error(`Command timeout after ${timeout}ms: ${action}`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(clientId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      // Send the message
      try {
        debugLog(`TX [${clientId}] ${action} (${sysexMessage.length} bytes)`);
        this.output.sendMessage(sysexMessage);
      } catch (error) {
        debugLog(`TX ERROR [${clientId}] ${action}: ${error}`);
        this.pendingRequests.delete(clientId);
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming MIDI message
   *
   * Supports chunked SysEx responses: messages with continuation byte 0x01
   * are accumulated in a per-clientId buffer. When the final chunk arrives
   * (continuation byte 0x00), all accumulated payloads are combined into a
   * single synthetic message for decoding. Single-chunk messages (the common
   * case) pass through unchanged.
   *
   * @param message - Array of MIDI bytes
   */
  private handleMessage(message: number[]): void {
    // Check if this is a SysEx message for our protocol
    if (message[0] !== 0xf0 || !SysExCodec.isValid(message)) {
      return;
    }

    const reassembled = this.reassembler.push(message);
    if (reassembled === null) {
      // Mid-stream — wait for the final chunk.
      return;
    }

    try {
      const { clientId: cid, data } = SysExCodec.decode(reassembled.message);
      debugLog(`RX [${cid}] success=${data.success} (${reassembled.message.length} bytes)`);

      const pending = this.pendingRequests.get(cid);
      if (pending) {
        this.pendingRequests.delete(cid);
        clearTimeout(pending.timeout);
        pending.resolve(data);
      } else {
        debugLog(`RX [${cid}] WARNING: no pending request`);
        console.error(`[MidiClient] Received response for unknown clientId: ${cid}`);
      }
    } catch (error) {
      debugLog(`RX ERROR: ${error}`);
      console.error(`[MidiClient] Failed to decode message:`, error);
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from MIDI ports
   */
  disconnect(): void {
    // Reject all pending requests
    for (const [clientId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
      this.pendingRequests.delete(clientId);
    }

    // Clear chunk accumulation buffers to prevent memory leaks
    this.reassembler.clear();

    // Detach the message handler so reconnects don't stack listeners.
    try {
      this.input.removeAllListeners('message');
    } catch {
      // Ignore — input may not have any listeners yet.
    }

    // Close ports
    try {
      this.input.closePort();
      this.output.closePort();
    } catch {
      // Ignore close errors
    }

    this.connected = false;
    console.error('[MidiClient] Disconnected');
  }
}
