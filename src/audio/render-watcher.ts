/**
 * Chokidar-based WAV file watcher.
 * Detects new WAV files in a watched directory and registers them
 * in the render registry automatically (fire-and-forget).
 */

import chokidar from 'chokidar';
import { basename, join } from 'node:path';
import { existsSync, mkdirSync, type Stats } from 'node:fs';
import { renderRegistry } from './render-registry.js';
import type { RenderInfo } from './types.js';

export class RenderWatcher {
  private watcher: ReturnType<typeof chokidar.watch> | null = null;
  private watchedDir: string | null = null;

  /**
   * Start watching a directory for new WAV files.
   * If already watching the same directory, returns immediately.
   * If watching a different directory, closes previous watcher first.
   */
  startWatching(directory: string): void {
    // Already watching this directory
    if (this.watcher && this.watchedDir === directory) {
      return;
    }

    // Close existing watcher if watching a different directory
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.watchedDir = null;
    }

    // Ensure directory exists
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    console.error(`[render-watcher] Watching: ${directory}`);

    this.watcher = chokidar.watch(directory, {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
      ignored: (path: string, _stats?: Stats) => {
        // Don't ignore directories (allow traversal of the watched dir itself)
        // For files, ignore anything that isn't a .wav
        if (_stats && _stats.isFile()) {
          return !path.toLowerCase().endsWith('.wav');
        }
        return false;
      },
    });

    this.watcher.on('add', (filePath: string) => {
      const filename = basename(filePath);
      console.error(`[render-watcher] WAV detected: ${filename}`);

      const info: RenderInfo = {
        path: filePath,
        filename,
        timestamp: Date.now(),
      };
      renderRegistry.register(info);
    });

    this.watcher.on('error', (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[render-watcher] Error: ${msg}`);
    });

    this.watchedDir = directory;
  }

  /**
   * Check if a file already exists in the directory.
   * If found, registers it immediately and returns the full path.
   * Otherwise returns null.
   */
  checkExisting(filename: string, directory: string): string | null {
    const fullPath = join(directory, filename);
    if (existsSync(fullPath)) {
      const info: RenderInfo = {
        path: fullPath,
        filename,
        timestamp: Date.now(),
      };
      renderRegistry.register(info);
      return fullPath;
    }
    return null;
  }

  /** Whether the watcher is currently active. */
  isWatching(): boolean {
    return this.watcher !== null;
  }

  /** Return the currently watched directory, or null. */
  getWatchedDirectory(): string | null {
    return this.watchedDir;
  }

  /** Stop watching and clean up. */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      this.watchedDir = null;
      console.error('[render-watcher] Stopped');
    }
  }
}

/** Singleton render watcher instance. */
export const renderWatcher = new RenderWatcher();
