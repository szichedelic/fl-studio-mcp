/**
 * Type declarations for node-midi package
 */

declare module 'midi' {
  import { EventEmitter } from 'events';

  export class Input extends EventEmitter {
    /**
     * Get the number of available input ports
     */
    getPortCount(): number;

    /**
     * Get the name of a specified input port
     * @param portNumber - The port index
     */
    getPortName(portNumber: number): string;

    /**
     * Open the specified input port
     * @param portNumber - The port index to open
     */
    openPort(portNumber: number): void;

    /**
     * Open a virtual input port with the specified name
     * @param portName - Name for the virtual port
     */
    openVirtualPort(portName: string): void;

    /**
     * Close the input port
     */
    closePort(): void;

    /**
     * Configure which message types to ignore
     * @param sysex - Ignore SysEx messages
     * @param timing - Ignore timing messages
     * @param activeSensing - Ignore active sensing messages
     */
    ignoreTypes(sysex: boolean, timing: boolean, activeSensing: boolean): void;

    /**
     * Register message handler
     */
    on(event: 'message', listener: (deltaTime: number, message: number[]) => void): this;
  }

  export class Output {
    /**
     * Get the number of available output ports
     */
    getPortCount(): number;

    /**
     * Get the name of a specified output port
     * @param portNumber - The port index
     */
    getPortName(portNumber: number): string;

    /**
     * Open the specified output port
     * @param portNumber - The port index to open
     */
    openPort(portNumber: number): void;

    /**
     * Open a virtual output port with the specified name
     * @param portName - Name for the virtual port
     */
    openVirtualPort(portName: string): void;

    /**
     * Close the output port
     */
    closePort(): void;

    /**
     * Send a MIDI message
     * @param message - Array of MIDI bytes to send
     */
    sendMessage(message: number[]): void;
  }

  const midi: {
    Input: typeof Input;
    Output: typeof Output;
  };

  export default midi;
}
