import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readLastSelection, writeLastSelection } from '@/src/lib/lastSelection';

const STORAGE_KEY = 'last-class-selection-v1';

// Node ≥22 ships an experimental global `localStorage` that is undefined unless
// the process gets `--localstorage-file`, shadowing jsdom's — stub a real one.
function makeStorage(): Pick<Storage, 'getItem' | 'setItem' | 'clear'> {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    clear: () => store.clear(),
  };
}

describe('lastSelection', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
  });

  it('returns null when nothing is stored', () => {
    expect(readLastSelection()).toBeNull();
  });

  it('round-trips a selection with companion', () => {
    writeLastSelection({ className: 'IA25a', companionName: 'BM25a' });
    expect(readLastSelection()).toEqual({ className: 'IA25a', companionName: 'BM25a' });
  });

  it('round-trips a selection without companion', () => {
    writeLastSelection({ className: 'AP25b' });
    expect(readLastSelection()).toEqual({ className: 'AP25b', companionName: undefined });
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readLastSelection()).toBeNull();
  });

  it('returns null for a wrong shape (missing/empty className)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ companionName: 'BM25a' }));
    expect(readLastSelection()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ className: '' }));
    expect(readLastSelection()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify('IA25a'));
    expect(readLastSelection()).toBeNull();
  });

  it('drops a non-string companionName instead of failing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ className: 'IA25a', companionName: 42 }));
    expect(readLastSelection()).toEqual({ className: 'IA25a', companionName: undefined });
  });

  it('returns null when localStorage is unavailable (private mode)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readLastSelection()).toBeNull();
    expect(() => writeLastSelection({ className: 'IA25a' })).not.toThrow();
  });
});
