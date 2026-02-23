/**
 * MIDI Client for FL Studio Bridge Communication
 *
 * Manages MIDI port connections and handles sending/receiving
 * SysEx messages to communicate with FL Studio.
 */

import midi, { Input, Output } from 'midi';
import { SysExCodec } from './sysex-codec.js';
import type { FLCommand, FLResponse, PendingRequest, MidiPorts } from './types.js';

/** Default timeout for pending requests in milliseconds */
const DEFAULT_TIMEOUT = 5000;

export class MidiClient {
  private input: Input;
  private output: Output;
  private pendingRequests: Map<number, PendingRequest> = new Map();
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
      this.input.on('message', (deltaTime: number, message: number[]) => {
        this.handleMessage(deltaTime, message);
      });

      // Open ports
      this.input.openPort(inputIndex);
      this.output.openPort(outputIndex);

      this.connected = true;
      console.error(
        `[MidiClient] Connected: input=${this.input.getPortName(inputIndex)}, output=${this.output.getPortName(outputIndex)}`
      );
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
    this.nextClientId = (this.nextClientId + 1) & 0x7f; // Wrap at 127

    const command: FLCommand = { action, params };
    const sysexMessage = SysExCodec.encode(command, clientId);

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(clientId);
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
        this.output.sendMessage(sysexMessage);
      } catch (error) {
        this.pendingRequests.delete(clientId);
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming MIDI message
   *
   * @param deltaTime - Time since last message
   * @param message - Array of MIDI bytes
   */
  private handleMessage(deltaTime: number, message: number[]): void {
    // Check if this is a SysEx message for our protocol
    if (message[0] !== 0xf0 || !SysExCodec.isValid(message)) {
      return;
    }

    try {
      const { clientId, data } = SysExCodec.decode(message);

      // Find and resolve pending request
      const pending = this.pendingRequests.get(clientId);
      if (pending) {
        this.pendingRequests.delete(clientId);
        clearTimeout(pending.timeout);
        pending.resolve(data);
      } else {
        console.error(`[MidiClient] Received response for unknown clientId: ${clientId}`);
      }
    } catch (error) {
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
