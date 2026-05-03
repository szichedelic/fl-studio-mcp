/**
 * Shared helpers for MCP tool implementations.
 *
 * The vast majority of tools in this project follow the same pattern:
 *   1. Take zod-validated args.
 *   2. Translate them into the params shape the bridge expects.
 *   3. Call connection.executeCommand and surface result.success.
 *   4. Format a text response (or fall back to dumping the JSON).
 *   5. Catch transport-level errors and return them as isError.
 *
 * runBridgeTool collapses (3)-(5). Each tool just supplies how to
 * build params and how to format success — failure handling is
 * uniform across the suite, so adding traceback/diagnostic info is
 * a one-place change.
 */

import type { ConnectionManager } from '../bridge/connection.js';

/**
 * The shape MCP tool callbacks return. Includes a string index signature
 * because the MCP SDK's tool-callback return type permits arbitrary
 * metadata keys.
 */
export interface ToolResponse {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

export interface RunBridgeToolOptions<TArgs> {
  /** Bridge action name, e.g. 'mixer.set_volume'. */
  action: string;
  /** Args from the MCP client (already zod-validated). */
  args: TArgs;
  /**
   * Translate args into the params payload the Python handler expects.
   * Default: pass args straight through. Many handlers want renames
   * (e.g. `track` -> `index`) so override here.
   */
  buildParams?: (args: TArgs) => Record<string, unknown>;
  /**
   * Verb shown in failure / error messages, e.g. 'set mixer volume'.
   * Used as `Failed to <verb>: <details>` and `Error <verb>ing: <msg>`.
   */
  describe: string;
  /**
   * Custom success formatter. Receives the bridge response. Default:
   * pretty-printed JSON.
   */
  formatSuccess?: (result: { success: boolean; data?: unknown; error?: string }) => string;
}

/**
 * Execute a bridge action and produce a uniform MCP tool response.
 */
export async function runBridgeTool<TArgs>(
  connection: ConnectionManager,
  options: RunBridgeToolOptions<TArgs>,
): Promise<ToolResponse> {
  const { action, args, describe } = options;
  const buildParams = options.buildParams ?? ((a: TArgs) => a as Record<string, unknown>);
  const formatSuccess = options.formatSuccess ?? ((r) => JSON.stringify(r, null, 2));

  try {
    const params = buildParams(args);
    const result = await connection.executeCommand(action, params);

    if (!result.success) {
      const detail = result.error ?? JSON.stringify(result);
      return {
        content: [{ type: 'text', text: `Failed to ${describe}: ${detail}` }],
        isError: true,
      };
    }

    return { content: [{ type: 'text', text: formatSuccess(result) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error ${describe}: ${message}` }],
      isError: true,
    };
  }
}
