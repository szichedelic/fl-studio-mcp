/**
 * Audio Render Tools for FL Studio MCP
 *
 * Provides MCP tools for the guided audio rendering workflow:
 * - render_pattern: Generate step-by-step FL Studio export instructions
 *   and automatically start watching for the rendered WAV file.
 * - list_renders: List all WAV files detected this session.
 * - check_render: Check if a specific rendered WAV file has been detected.
 *
 * These tools bridge the gap between FL Studio's manual export (Ctrl+R)
 * and downstream sample manipulation by tracking rendered outputs
 * through chokidar file watching + an in-memory registry.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionManager } from '../bridge/connection.js';
import { z } from 'zod';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir } from 'node:fs/promises';
import { renderWatcher } from '../audio/render-watcher.js';
import { renderRegistry } from '../audio/render-registry.js';

/** Default output directory for rendered WAV files. */
function getDefaultRenderDir(): string {
  return join(homedir(), 'Documents', 'FL Studio MCP', 'Renders');
}

/**
 * Sanitize a string for use as a filename.
 * Removes invalid characters, collapses whitespace, and limits length.
 */
function sanitizeFilename(name: string): string {
  let result = name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (result.length > 100) {
    result = result.slice(0, 100);
  }

  return result || 'render';
}

/**
 * Register audio render tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param connection - The ConnectionManager for FL Studio communication
 */
export function registerRenderTools(
  server: McpServer,
  connection: ConnectionManager,
): void {
  // ── render_pattern ──────────────────────────────────────────────────

  const renderPatternSchema = {
    filename: z.string().optional()
      .describe('Custom filename without extension. Omit for auto-generated name based on current pattern.'),
    outputDir: z.string().optional()
      .describe('Output directory. Defaults to ~/Documents/FL Studio MCP/Renders/'),
  };

  server.tool(
    'render_pattern',
    'Get step-by-step instructions to render the current pattern as a WAV file. Automatically starts watching for the rendered file.',
    renderPatternSchema,
    async ({ filename, outputDir }) => {
      try {
        // Step 1: Try to read current FL Studio state for pattern name
        let patternName = 'Pattern';
        try {
          const stateResult = await connection.executeCommand('state.patterns', {});
          if (stateResult.success) {
            const data = stateResult as unknown as { currentName?: string; name?: string };
            patternName = data.currentName || data.name || 'Pattern';
          }
        } catch {
          // FL Studio not connected — use generic name
        }

        // Step 2: Generate filename
        const baseName = filename
          ? sanitizeFilename(filename)
          : sanitizeFilename(patternName + '_render');
        const wavFilename = baseName + '.wav';

        // Step 3: Determine output directory
        const renderDir = outputDir || getDefaultRenderDir();

        // Step 4: Ensure output directory exists
        await mkdir(renderDir, { recursive: true });

        // Step 5: Check if file already exists
        const existing = renderWatcher.checkExisting(wavFilename, renderDir);
        if (existing) {
          return {
            content: [{
              type: 'text' as const,
              text: [
                `File already exists: ${existing}`,
                '',
                'This render has been registered and is available for sample manipulation.',
                `Use list_renders to see all tracked renders, or check_render with filename "${wavFilename}" to verify.`,
              ].join('\n'),
            }],
          };
        }

        // Step 6: Start file watcher
        renderWatcher.startWatching(renderDir);

        // Step 7: Build step-by-step instructions
        const fullPath = join(renderDir, wavFilename);
        const instructions = [
          `Render Instructions for: ${patternName}`,
          '='.repeat(40),
          '',
          'Follow these steps in FL Studio:',
          '',
          '1. Make sure the pattern you want to render is selected',
          '   (check the pattern selector in the toolbar)',
          '',
          '2. Set the render source:',
          '   - Go to the Channel Rack',
          '   - Right-click the channel you want to render',
          '   - Or use the full pattern for a mixdown',
          '',
          '3. Open the Export dialog:',
          '   - Press Ctrl+R (or File > Export > Wave file)',
          '',
          '4. Configure export settings:',
          `   - Save location: ${renderDir}`,
          `   - Filename: ${baseName}`,
          '   - Format: WAV (16-bit or 24-bit)',
          '   - Mode: "Pat" (pattern) for single pattern render',
          '',
          '5. Click "Start" to begin rendering',
          '',
          '---',
          '',
          `Target file: ${fullPath}`,
          '',
          'I am now watching for this file automatically.',
          'Once rendering is complete, the file will be detected and registered.',
          `Use check_render with filename "${wavFilename}" to verify when it appears.`,
        ];

        return {
          content: [{ type: 'text' as const, text: instructions.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error setting up render: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── list_renders ──────────────────────────────────────────────────

  server.tool(
    'list_renders',
    'List all rendered WAV files detected this session. These files are available for sample manipulation.',
    {},
    async () => {
      try {
        const renders = renderRegistry.getAll();

        if (renders.length === 0) {
          const watchDir = renderWatcher.getWatchedDirectory();
          const lines = [
            'No rendered files detected this session.',
          ];
          if (watchDir) {
            lines.push('', `Currently watching: ${watchDir}`);
            lines.push('Renders will appear here automatically when WAV files are saved to that directory.');
          } else {
            lines.push('', 'No directory is being watched. Use render_pattern to start a render workflow.');
          }
          return {
            content: [{ type: 'text' as const, text: lines.join('\n') }],
          };
        }

        const lines = [
          `Rendered files this session (${renders.length}):`,
          '',
        ];

        for (const render of renders) {
          const time = new Date(render.timestamp).toLocaleTimeString();
          lines.push(`  ${render.filename}`);
          lines.push(`    Path: ${render.path}`);
          lines.push(`    Detected: ${time}`);
          if (render.patternName) {
            lines.push(`    Pattern: ${render.patternName}`);
          }
          lines.push('');
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n').trimEnd() }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error listing renders: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── check_render ──────────────────────────────────────────────────

  const checkRenderSchema = {
    filename: z.string()
      .describe('Filename to check (with or without .wav extension)'),
  };

  server.tool(
    'check_render',
    'Check if a specific rendered WAV file has been detected.',
    checkRenderSchema,
    async ({ filename }) => {
      try {
        // Normalize: ensure .wav extension
        const normalizedFilename = filename.toLowerCase().endsWith('.wav')
          ? filename
          : filename + '.wav';

        const render = renderRegistry.getByFilename(normalizedFilename);

        if (render) {
          const time = new Date(render.timestamp).toLocaleTimeString();
          return {
            content: [{
              type: 'text' as const,
              text: [
                `Render found: ${render.filename}`,
                `Path: ${render.path}`,
                `Detected: ${time}`,
                '',
                'This file is available for sample manipulation.',
              ].join('\n'),
            }],
          };
        }

        // Not found — provide helpful context
        const total = renderRegistry.count();
        const watchDir = renderWatcher.getWatchedDirectory();
        const lines = [
          `Render not found: ${normalizedFilename}`,
        ];

        if (total > 0) {
          lines.push('', `${total} other render(s) are tracked. Use list_renders to see them.`);
        }

        if (watchDir) {
          lines.push('', `Currently watching: ${watchDir}`);
          lines.push('The file may still be rendering. Check again after FL Studio finishes exporting.');
        } else {
          lines.push('', 'No directory is being watched. Use render_pattern to start a render workflow.');
        }

        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error checking render: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
