/**
 * Color conversion helpers shared between mixer and playlist tools.
 *
 * FL Studio stores colors as a 24-bit BGR integer (low byte = blue),
 * but our MCP surface accepts the more familiar RGB hex string.
 */

/** Regex for an RGB hex string with optional leading '#'. */
export const RGB_HEX_RE = /^#?[0-9a-f]{6}$/i;

/**
 * Convert an RGB hex string to FL Studio's BGR integer format.
 *
 * @throws If the input does not match the #RRGGBB format. We throw rather
 * than silently coerce so callers like `setTrackColor("red")` can't end
 * up writing 0 (black) to FL Studio.
 */
export function rgbHexToBgr(hex: string): number {
  if (!RGB_HEX_RE.test(hex)) {
    throw new Error(
      `Invalid hex color "${hex}" — expected format like "#FF8800" or "ff8800".`,
    );
  }
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (b << 16) | (g << 8) | r;
}
