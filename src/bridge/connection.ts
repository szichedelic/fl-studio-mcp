/**
 * Connection Manager for FL Studio Bridge
 *
 * High-level interface for managing the MIDI connection to FL Studio.
 * Wraps MidiClient with state management and cleaner async interface.
 */

import { MidiClient } from './midi-client.js';
import type { ConnectionState, FLResponse, MidiPorts } from './types.js';

export class ConnectionManager {
  private client: MidiClient;
  private state: ConnectionState = 'disconnected';

  constructor() {
    this.client = new MidiClient();
  }

  /**
   * List available MIDI ports
   *
   * @returns Object with input and output port name arrays
   */
  listPorts(): MidiPorts {
    return this.client.listPorts();
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Connect to FL Studio via MIDI ports
   *
   * @param inputPort - Name (or partial name) of MIDI input port
   * @param outputPort - Name (or partial name) of MIDI output port
   * @returns true if connection successful
   */
  async connect(inputPort: string, outputPort: string): Promise<boolean> {
    if (this.state !== 'disconnected') {
      this.disconnect();
    }

    this.state = 'connecting';

    try {
      const success = this.client.connect(inputPort, outputPort);

      if (success) {
        this.state = 'connected';
        return true;
      } else {
        this.state = 'disconnected';
        return false;
      }
    } catch (error) {
      this.state = 'disconnected';
      throw error;
    }
  }

  /**
   * Execute a command on FL Studio
   *
   * @param action - The action to perform
   * @param params - Parameters for the action
   * @param timeout - Timeout in milliseconds (default 5000)
   * @returns Promise resolving to FL Studio's response
   * @throws Error if not connected
   */
  async executeCommand(
    action: string,
    params: Record<string, unknown> = {},
    timeout?: number
  ): Promise<FLResponse> {
    if (this.state !== 'connected') {
      throw new Error(`Cannot execute command: state is ${this.state}`);
    }

    return this.client.sendCommand(action, params, timeout);
  }

  /**
   * Check if connected to FL Studio
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Disconnect from FL Studio
   */
  disconnect(): void {
    this.client.disconnect();
    this.state = 'disconnected';
  }
}

// Export singleton instance for convenience
export const connectionManager = new ConnectionManager();
