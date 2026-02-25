/**
 * In-memory registry for tracked rendered WAV files.
 * Provides register/query operations used by the watcher and MCP tools.
 */

import type { RenderInfo } from './types.js';

export class RenderRegistry {
  private renders: RenderInfo[] = [];

  /** Register a new render entry. */
  register(info: RenderInfo): void {
    this.renders.push(info);
    console.error(
      `[render-registry] Registered: ${info.filename} (${this.renders.length} total)`
    );
  }

  /** Return a copy of all registered renders. */
  getAll(): RenderInfo[] {
    return [...this.renders];
  }

  /** Return the most recently registered render, or undefined. */
  getLatest(): RenderInfo | undefined {
    return this.renders.length > 0
      ? this.renders[this.renders.length - 1]
      : undefined;
  }

  /** Find a render by filename (case-insensitive). */
  getByFilename(name: string): RenderInfo | undefined {
    const lower = name.toLowerCase();
    return this.renders.find((r) => r.filename.toLowerCase() === lower);
  }

  /** Return the number of registered renders. */
  count(): number {
    return this.renders.length;
  }

  /** Clear all registered renders. */
  clear(): void {
    this.renders = [];
  }
}

/** Singleton render registry instance. */
export const renderRegistry = new RenderRegistry();
