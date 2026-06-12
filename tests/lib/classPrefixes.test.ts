import { describe, it, expect } from 'vitest';
import {
  matchesAllowedPrefix,
  prefixRank,
  compareClassPriority,
  PREFIX_ORDER,
} from '@/src/lib/classPrefixes';

describe('matchesAllowedPrefix', () => {
  it('accepts real class prefixes', () => {
    for (const name of [
      'IA24 a',
      'IM23 b',
      'KVA24 c',
      'KVE25 d',
      'ME24 c',
      'FBA23 a',
      'FBM24 a',
      'AB24 c',
      'BM24 a',
    ]) {
      expect(matchesAllowedPrefix(name), name).toBe(true);
    }
  });

  it('rejects Förderkurse, Freifächer and Lernfoyer', () => {
    // The user-reported FKBM2 plus the rest of the junk category.
    for (const name of [
      'FKBM2',
      'FKBM23',
      'FKDE',
      'FKKVE23',
      'FKSP',
      'FFEN',
      'LFH a',
      'LFS a (UserId:5)',
    ]) {
      expect(matchesAllowedPrefix(name), name).toBe(false);
    }
  });
});

describe('prefixRank', () => {
  it('orders by PREFIX_ORDER', () => {
    expect(prefixRank('IA24 a')).toBeLessThan(prefixRank('ME24 a'));
    expect(prefixRank('ME24 a')).toBeLessThan(prefixRank('AB24 a'));
    expect(prefixRank('AB24 a')).toBeLessThan(prefixRank('BM24 a'));
  });

  it('ranks unknown prefixes last', () => {
    expect(prefixRank('FKBM2')).toBe(PREFIX_ORDER.length);
  });
});

describe('compareClassPriority', () => {
  it('orders by prefix first, then by name', () => {
    const sorted = [{ name: 'ME24 a' }, { name: 'IA24 b' }, { name: 'IA24 a' }, { name: 'BM24 a' }]
      .sort(compareClassPriority)
      .map((c) => c.name);
    expect(sorted).toEqual(['IA24 a', 'IA24 b', 'ME24 a', 'BM24 a']);
  });
});
