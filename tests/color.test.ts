import { describe, it, expect } from 'vitest';
import { rgbHexToBgr, RGB_HEX_RE } from '../src/util/color.ts';

describe('rgbHexToBgr', () => {
  it('converts a 6-char hex with hash to BGR int', () => {
    // #FF0000 (red) -> R=0xFF, G=0x00, B=0x00 -> BGR int 0x0000FF
    expect(rgbHexToBgr('#FF0000')).toBe(0x0000ff);
    // #00FF00 (green) -> 0x00FF00
    expect(rgbHexToBgr('#00FF00')).toBe(0x00ff00);
    // #0000FF (blue) -> 0xFF0000
    expect(rgbHexToBgr('#0000FF')).toBe(0xff0000);
  });

  it('accepts hex without leading #', () => {
    expect(rgbHexToBgr('FF8800')).toBe(rgbHexToBgr('#FF8800'));
  });

  it('is case-insensitive', () => {
    expect(rgbHexToBgr('#ff8800')).toBe(rgbHexToBgr('#FF8800'));
  });

  it('throws on non-hex input rather than silently returning 0', () => {
    // This is the regression we just fixed: "red" used to parse as NaN and
    // bitwise ops would produce 0 (black) without any error surfacing.
    expect(() => rgbHexToBgr('red')).toThrow(/invalid hex/i);
    expect(() => rgbHexToBgr('not-a-color')).toThrow(/invalid hex/i);
  });

  it('throws on too-short hex', () => {
    expect(() => rgbHexToBgr('#FFF')).toThrow(/invalid hex/i);
  });

  it('throws on too-long hex', () => {
    expect(() => rgbHexToBgr('#FFFFFFF')).toThrow(/invalid hex/i);
  });

  it('throws on non-hex characters', () => {
    expect(() => rgbHexToBgr('#GG0000')).toThrow(/invalid hex/i);
  });
});

describe('RGB_HEX_RE', () => {
  it('matches the supported formats', () => {
    expect(RGB_HEX_RE.test('#FF0000')).toBe(true);
    expect(RGB_HEX_RE.test('FF0000')).toBe(true);
    expect(RGB_HEX_RE.test('#ff8800')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(RGB_HEX_RE.test('red')).toBe(false);
    expect(RGB_HEX_RE.test('#FFF')).toBe(false);
    expect(RGB_HEX_RE.test('#GGGGGG')).toBe(false);
  });
});
