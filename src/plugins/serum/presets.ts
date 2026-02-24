/**
 * Serum 2 preset filesystem scanner
 *
 * Scans the local Serum 2 preset directory for .fxp and .SerumPreset files,
 * returning structured preset info for browsing and searching. The preset
 * directory can be overridden via the SERUM2_PRESET_DIR environment variable.
 *
 * This runs on the MCP server (Node.js) side -- full filesystem access.
 * It does NOT load presets into Serum; that is done via FL Bridge preset
 * navigation handlers (plugins.next_preset / plugins.prev_preset).
 */

import { readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { homedir } from 'node:os';
import type { SerumPresetInfo } from './types.js';

/** Default Serum 2 preset directory (Windows) */
const DEFAULT_SERUM2_PRESET_DIR = join(
  homedir(),
  'Documents',
  'Xfer',
  'Serum 2 Presets',
  'Presets'
);

/** Recognized preset file extensions (lowercase) */
const PRESET_EXTENSIONS = new Set(['.fxp', '.serumpreset']);

/**
 * Get the Serum 2 preset directory path.
 *
 * Reads from SERUM2_PRESET_DIR environment variable if set,
 * otherwise falls back to the default Windows location.
 *
 * @returns Absolute path to the Serum 2 presets directory
 */
export function getSerumPresetDir(): string {
  return process.env.SERUM2_PRESET_DIR || DEFAULT_SERUM2_PRESET_DIR;
}

/**
 * Recursively scan a directory for preset files.
 *
 * @param dir - Directory to scan
 * @param results - Accumulator array (mutated in place)
 */
async function scanDirectory(
  dir: string,
  results: SerumPresetInfo[]
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Directory doesn't exist or permission denied -- silently skip
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await scanDirectory(fullPath, results);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (PRESET_EXTENSIONS.has(ext)) {
        // Category is the immediate parent folder name
        const category = basename(dir);
        results.push({
          name: basename(entry.name, extname(entry.name)),
          path: fullPath,
          category,
          extension: ext,
        });
      }
    }
  }
}

/**
 * List Serum 2 presets from the filesystem.
 *
 * Recursively scans the preset directory for .fxp and .SerumPreset files.
 * Results can be filtered by category (parent folder name) and/or name
 * (case-insensitive substring match).
 *
 * @param filterCategory - Optional category filter (case-insensitive substring)
 * @param filterName - Optional name filter (case-insensitive substring)
 * @returns Array of matching presets (empty if directory missing or no matches)
 */
export async function listSerumPresets(
  filterCategory?: string,
  filterName?: string
): Promise<SerumPresetInfo[]> {
  const presetDir = getSerumPresetDir();
  const results: SerumPresetInfo[] = [];

  try {
    await scanDirectory(presetDir, results);
  } catch {
    // Top-level error catch -- return empty on any filesystem failure
    return [];
  }

  // Apply filters
  let filtered = results;

  if (filterCategory) {
    const cat = filterCategory.toLowerCase();
    filtered = filtered.filter((p) => p.category.toLowerCase().includes(cat));
  }

  if (filterName) {
    const name = filterName.toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(name));
  }

  // Sort by category then name for consistent ordering
  filtered.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category);
    return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
  });

  return filtered;
}
