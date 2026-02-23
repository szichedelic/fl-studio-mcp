/**
 * Shared types for FL Studio MCP bridge communication
 */

/**
 * Command to be sent to FL Studio via SysEx
 */
export interface FLCommand {
  action: string;
  params: Record<string, unknown>;
}

/**
 * Response received from FL Studio
 */
export interface FLResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Connection state for MIDI client
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/**
 * Pending request tracking for async command/response
 */
export interface PendingRequest {
  resolve: (response: FLResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Available MIDI ports
 */
export interface MidiPorts {
  inputs: string[];
  outputs: string[];
}
