/**
 * SysEx Codec for FL Studio Bridge Communication
 *
 * Encodes commands to SysEx format and decodes SysEx responses.
 * Uses base64 encoding for JSON payload to ensure 7-bit safety.
 *
 * SysEx Message Format:
 * [0xF0]         - SysEx Start
 * [0x7D]         - Non-commercial manufacturer ID
 * [origin]       - 0x00 = client, 0x01 = server (FL Studio)
 * [clientId]     - Client identifier (0-127)
 * [continuation] - 0x00 = complete message
 * [msgType]      - 0x01 = command, 0x02 = response
 * [status]       - 0x00 = ok, 0x01 = error
 * [...payload]   - Base64 encoded JSON bytes (7-bit safe)
 * [0xF7]         - SysEx End
 */

import type { FLCommand, FLResponse } from './types.js';

export class SysExCodec {
  /** SysEx header bytes: start + manufacturer ID */
  static readonly HEADER = [0xf0, 0x7d] as const;

  /** SysEx end byte */
  static readonly END = 0xf7;

  /** Message origins */
  static readonly ORIGIN = {
    CLIENT: 0x00,
    SERVER: 0x01,
  } as const;

  /** Message types */
  static readonly MSG_TYPE = {
    COMMAND: 0x01,
    RESPONSE: 0x02,
  } as const;

  /** Status codes */
  static readonly STATUS = {
    OK: 0x00,
    ERROR: 0x01,
  } as const;

  /**
   * Encode a command to SysEx message bytes
   *
   * @param command - The command to send
   * @param clientId - Client identifier (0-127)
   * @returns Array of SysEx bytes ready to send
   */
  static encode(command: FLCommand, clientId: number): number[] {
    // Ensure clientId is 7-bit safe
    const safeClientId = clientId & 0x7f;

    // JSON stringify and base64 encode the command
    const jsonStr = JSON.stringify(command);
    const base64Str = Buffer.from(jsonStr, 'utf-8').toString('base64');

    // Convert base64 string to 7-bit safe bytes
    const payloadBytes = Array.from(base64Str).map((char) => char.charCodeAt(0) & 0x7f);

    // Build complete SysEx message
    const message = [
      ...SysExCodec.HEADER,
      SysExCodec.ORIGIN.CLIENT,
      safeClientId,
      0x00, // continuation: complete message
      SysExCodec.MSG_TYPE.COMMAND,
      SysExCodec.STATUS.OK,
      ...payloadBytes,
      SysExCodec.END,
    ];

    return message;
  }

  /**
   * Decode a SysEx response message
   *
   * @param sysex - Array of SysEx bytes received
   * @returns Decoded response with clientId
   * @throws Error if message format is invalid
   */
  static decode(sysex: number[]): { clientId: number; data: FLResponse } {
    // Validate message structure
    if (sysex.length < 9) {
      throw new Error(`SysEx message too short: ${sysex.length} bytes`);
    }

    if (sysex[0] !== 0xf0) {
      throw new Error(`Invalid SysEx start byte: 0x${sysex[0].toString(16)}`);
    }

    if (sysex[1] !== 0x7d) {
      throw new Error(`Invalid manufacturer ID: 0x${sysex[1].toString(16)}`);
    }

    if (sysex[sysex.length - 1] !== 0xf7) {
      throw new Error(`Invalid SysEx end byte: 0x${sysex[sysex.length - 1].toString(16)}`);
    }

    // Extract header fields
    const origin = sysex[2];
    const clientId = sysex[3];
    const continuation = sysex[4];
    const msgType = sysex[5];
    const status = sysex[6];

    // Validate we're receiving a response from server
    if (origin !== SysExCodec.ORIGIN.SERVER) {
      throw new Error(`Unexpected origin: 0x${origin.toString(16)}`);
    }

    if (msgType !== SysExCodec.MSG_TYPE.RESPONSE) {
      throw new Error(`Unexpected message type: 0x${msgType.toString(16)}`);
    }

    // Extract and decode payload (bytes 7 to length-1, excluding F7)
    const payloadBytes = sysex.slice(7, -1);
    const base64Str = String.fromCharCode(...payloadBytes);
    const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');

    let data: FLResponse;
    try {
      data = JSON.parse(jsonStr) as FLResponse;
    } catch (e) {
      throw new Error(`Failed to parse response JSON: ${e}`);
    }

    // Override success based on status byte
    data.success = status === SysExCodec.STATUS.OK;

    return { clientId, data };
  }

  /**
   * Check if a byte array is a valid SysEx message for our protocol
   *
   * @param bytes - Array of bytes to check
   * @returns true if this is a valid FL Bridge SysEx message
   */
  static isValid(bytes: number[]): boolean {
    return (
      bytes.length >= 9 &&
      bytes[0] === 0xf0 &&
      bytes[1] === 0x7d &&
      bytes[bytes.length - 1] === 0xf7
    );
  }
}
