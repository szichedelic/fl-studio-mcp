import { describe, it, expect } from 'vitest';
import {
  resolveSemanticAlias,
  getAliasGroups,
  SERUM_ALIASES,
} from '../src/plugins/serum/aliases.ts';

describe('resolveSemanticAlias', () => {
  it('resolves a known semantic name to the actual Serum parameter', () => {
    expect(resolveSemanticAlias('master volume')).toBe('Main Vol');
    expect(resolveSemanticAlias('volume')).toBe('Main Vol');
    expect(resolveSemanticAlias('main volume')).toBe('Main Vol');
  });

  it('is case-insensitive', () => {
    expect(resolveSemanticAlias('MASTER VOLUME')).toBe('Main Vol');
    expect(resolveSemanticAlias('Master Volume')).toBe('Main Vol');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveSemanticAlias('  master volume  ')).toBe('Main Vol');
  });

  it('returns the input unchanged when no alias matches (falls through to fuzzy match)', () => {
    expect(resolveSemanticAlias('nonexistent param 9999')).toBe('nonexistent param 9999');
  });

  it('resolves portamento aliases consistently', () => {
    const target = resolveSemanticAlias('portamento');
    expect(resolveSemanticAlias('porta')).toBe(target);
    expect(resolveSemanticAlias('glide')).toBe(target);
    expect(resolveSemanticAlias('glide time')).toBe(target);
  });
});

describe('SERUM_ALIASES integrity', () => {
  it('contains entries', () => {
    expect(SERUM_ALIASES.length).toBeGreaterThan(0);
  });

  it('every entry has at least one semantic name and a non-empty actual', () => {
    for (const alias of SERUM_ALIASES) {
      expect(alias.semantic.length).toBeGreaterThan(0);
      expect(alias.actual.length).toBeGreaterThan(0);
      expect(alias.group.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate semantic keys (case-insensitive)', () => {
    const seen = new Map<string, string>();
    for (const alias of SERUM_ALIASES) {
      for (const sem of alias.semantic) {
        const key = sem.toLowerCase().trim();
        if (seen.has(key)) {
          throw new Error(
            `Duplicate semantic key "${sem}" maps to both "${seen.get(key)}" and "${alias.actual}"`,
          );
        }
        seen.set(key, alias.actual);
      }
    }
  });
});

describe('getAliasGroups', () => {
  it('returns a sorted, deduped list of group names', () => {
    const groups = getAliasGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(new Set(groups).size).toBe(groups.length);
    const sorted = [...groups].sort();
    expect(groups).toEqual(sorted);
  });

  it('includes the major Serum sections', () => {
    const groups = getAliasGroups();
    expect(groups).toContain('global');
    expect(groups).toContain('filter-1');
  });
});
