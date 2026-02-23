/**
 * Optional Debug Logger for FL Studio MCP
 *
 * Enabled via FL_DEBUG=1 environment variable.
 * Implements log rotation to prevent disk bloat.
 */

import * as fs from 'fs';
import * as path from 'path';

const DEBUG_ENABLED = process.env.FL_DEBUG === '1' || process.env.FL_DEBUG === 'true';
const MAX_LOG_LINES = 1000;
const LOG_FILE = process.env.FL_DEBUG_FILE || path.join(process.cwd(), 'fl-studio-mcp-debug.log');

// In-memory buffer for batching writes
let logBuffer: string[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Log a debug message (only if FL_DEBUG is enabled)
 */
export function debugLog(message: string): void {
  if (!DEBUG_ENABLED) return;

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;

  logBuffer.push(line);

  // Batch writes - flush after 100ms of no new logs
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushToFile, 100);
}

/**
 * Flush buffered logs to file with rotation
 */
function flushToFile(): void {
  if (logBuffer.length === 0) return;

  try {
    // Read existing lines (if file exists)
    let existingLines: string[] = [];
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      existingLines = content.split('\n').filter(line => line.trim());
    }

    // Combine and rotate
    const allLines = [...existingLines, ...logBuffer];
    const rotatedLines = allLines.slice(-MAX_LOG_LINES);

    // Write back
    fs.writeFileSync(LOG_FILE, rotatedLines.join('\n') + '\n');

    logBuffer = [];
  } catch (error) {
    // Silently fail - don't break the app for logging
    console.error('[DebugLogger] Failed to write log:', error);
    logBuffer = [];
  }
}

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
  return DEBUG_ENABLED;
}
