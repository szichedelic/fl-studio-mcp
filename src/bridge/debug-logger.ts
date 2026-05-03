/**
 * Optional Debug Logger for FL Studio MCP
 *
 * Enabled via FL_DEBUG=1 environment variable.
 * Appends to disk and rotates by line count when the file gets too big.
 */

import * as fs from 'fs';

const DEBUG_ENABLED = process.env.FL_DEBUG === '1' || process.env.FL_DEBUG === 'true';
const MAX_LOG_LINES = 1000;
// Allow some headroom above MAX_LOG_LINES so we don't rotate every flush.
const ROTATE_AT_LINES = MAX_LOG_LINES + 500;
const LOG_FILE = process.env.FL_DEBUG_FILE || './fl-studio-mcp-debug.log';

let logBuffer: string[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let appendedSinceRotateCheck = 0;

export function debugLog(message: string): void {
  if (!DEBUG_ENABLED) return;

  const timestamp = new Date().toISOString();
  logBuffer.push(`[${timestamp}] ${message}`);

  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushToFile, 100);
}

function flushToFile(): void {
  if (logBuffer.length === 0) return;

  const toWrite = logBuffer.join('\n') + '\n';
  const lineCount = logBuffer.length;
  logBuffer = [];

  try {
    fs.appendFileSync(LOG_FILE, toWrite);
    appendedSinceRotateCheck += lineCount;
    if (appendedSinceRotateCheck >= MAX_LOG_LINES) {
      appendedSinceRotateCheck = 0;
      maybeRotate();
    }
  } catch (error) {
    console.error('[DebugLogger] Failed to write log:', error);
  }
}

/**
 * If the log has grown past ROTATE_AT_LINES, truncate it to the last
 * MAX_LOG_LINES. We only do this rarely so the cost is amortised.
 */
function maybeRotate(): void {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter((line) => line.length > 0);
    if (lines.length <= ROTATE_AT_LINES) return;
    const trimmed = lines.slice(-MAX_LOG_LINES).join('\n') + '\n';
    fs.writeFileSync(LOG_FILE, trimmed);
  } catch (error) {
    console.error('[DebugLogger] Rotation failed:', error);
  }
}

export function isDebugEnabled(): boolean {
  return DEBUG_ENABLED;
}
