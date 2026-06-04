import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCached, setCached, clearAllCaches } from '@/src/lib/cache';

beforeEach(() => clearAllCaches());

describe('getCached', () => {
  it('returns null for unknown key', () => {
    expect(getCached('missing')).toBeNull();
  });

  it('returns stored data within TTL', () => {
    setCached('k', { value: 42 }, 60_000);
    expect(getCached('k')).toEqual({ value: 42 });
  });

  it('returns null and evicts entry after TTL expires', () => {
    vi.useFakeTimers();
    setCached('k', 'hello', 1_000);
    vi.advanceTimersByTime(1_001);
    expect(getCached('k')).toBeNull();
    vi.useRealTimers();
  });
});

describe('setCached', () => {
  it('overwrites an existing entry', () => {
    setCached('k', 'first', 60_000);
    setCached('k', 'second', 60_000);
    expect(getCached('k')).toBe('second');
  });
});

describe('clearAllCaches', () => {
  it('removes all entries', () => {
    setCached('a', 1, 60_000);
    setCached('b', 2, 60_000);
    clearAllCaches();
    expect(getCached('a')).toBeNull();
    expect(getCached('b')).toBeNull();
  });
});
