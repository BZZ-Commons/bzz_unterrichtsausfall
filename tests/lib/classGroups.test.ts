import { describe, it, expect } from 'vitest';
import { getCompanionNames, getCompanionClassIds } from '@/src/lib/classGroups';
import type { UntisClass } from '@/src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeClass = (id: number, name: string): UntisClass => ({
  id, name, longName: '', active: true,
});

// ─── getCompanionNames ────────────────────────────────────────────────────────

describe('getCompanionNames', () => {
  // ME rules
  it('ME + a/b → AB same suffix', () => {
    expect(getCompanionNames('ME23 a')).toEqual(['AB23 a']);
    expect(getCompanionNames('ME23 b')).toEqual(['AB23 b']);
  });
  it('ME + c/d → BM same suffix', () => {
    expect(getCompanionNames('ME23 c')).toEqual(['BM23 c']);
    expect(getCompanionNames('ME23 d')).toEqual(['BM23 d']);
  });
  it('ME + e/f → AB same suffix', () => {
    expect(getCompanionNames('ME23 e')).toEqual(['AB23 e']);
  });

  // IA rules
  it('IA + a/b → BM same suffix only', () => {
    expect(getCompanionNames('IA23 a')).toEqual(['BM23 a']);
    expect(getCompanionNames('IA23 b')).toEqual(['BM23 b']);
  });
  it('IA + c → AB same year c', () => {
    expect(getCompanionNames('IA23 c')).toEqual(['AB23 c']);
  });

  // AB rules
  it('AB + a/b → ME same suffix', () => {
    expect(getCompanionNames('AB23 a')).toEqual(['ME23 a']);
  });
  it('AB + c → IA a and IA b', () => {
    expect(getCompanionNames('AB23 c')).toEqual(['IA23 a', 'IA23 b']);
  });
  it('AB + e/f → ME same suffix', () => {
    expect(getCompanionNames('AB23 e')).toEqual(['ME23 e']);
  });

  // BM rules
  it('BM + a/b → IA same suffix', () => {
    expect(getCompanionNames('BM23 a')).toEqual(['IA23 a']);
    expect(getCompanionNames('BM23 b')).toEqual(['IA23 b']);
  });
  it('BM + c/d → ME same suffix', () => {
    expect(getCompanionNames('BM23 c')).toEqual(['ME23 c']);
  });
  it('BM + e/f → ME same suffix', () => {
    expect(getCompanionNames('BM23 f')).toEqual(['ME23 f']);
  });

  // Edge cases
  it('returns [] for unknown class prefix', () => {
    expect(getCompanionNames('XY99 z')).toEqual([]);
  });
  it('is case-insensitive for class names with spaces', () => {
    expect(getCompanionNames('ia23a')).toEqual(['BM23 a']);
    expect(getCompanionNames('IA23a')).toEqual(['BM23 a']);
    expect(getCompanionNames('IA 23 a')).toEqual(['BM23 a']);
  });
});

// ─── getCompanionClassIds ─────────────────────────────────────────────────────

describe('getCompanionClassIds', () => {
  const allClasses: UntisClass[] = [
    makeClass(1,  'IA23 a'),
    makeClass(2,  'IA23 b'),
    makeClass(3,  'BM23 a'),
    makeClass(4,  'BM23 b'),
    makeClass(5,  'AB23 c'),
    makeClass(6,  'ME22 b'),
    makeClass(7,  'AB22 b'),
    makeClass(8,  'BM24 a'),
    makeClass(9,  'IA24 a'),
    makeClass(10, 'IA24 b'),
  ];

  it('IA23 a → returns ID of BM23 a only', () => {
    expect(getCompanionClassIds('IA23 a', allClasses)).toEqual([3]);
  });

  it('IA23 b → returns ID of BM23 b only', () => {
    expect(getCompanionClassIds('IA23 b', allClasses)).toEqual([4]);
  });

  it('IA23 c → returns ID of AB23 c', () => {
    const withIAc = [...allClasses, makeClass(11, 'IA23 c')];
    expect(getCompanionClassIds('IA23 c', withIAc)).toEqual([5]);
  });

  it('ME22 b → returns ID of AB22 b', () => {
    expect(getCompanionClassIds('ME22 b', allClasses)).toEqual([7]);
  });

  it('BM24 a → returns IDs of IA24 a', () => {
    expect(getCompanionClassIds('BM24 a', allClasses)).toEqual([9]);
  });

  it('returns [] when no companion exists in class list', () => {
    // IA23 a's companion BM99 a does not exist
    expect(getCompanionClassIds('IA99 a', allClasses)).toEqual([]);
  });

  it('returns [] gracefully for empty class list', () => {
    expect(getCompanionClassIds('IA23 a', [])).toEqual([]);
  });

  it('returns [] for unknown class prefix', () => {
    expect(getCompanionClassIds('XY99 z', allClasses)).toEqual([]);
  });
});
