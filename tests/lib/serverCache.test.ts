import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCached, clearCache } from '@/src/lib/serverCache';

describe('serverCache.getCached', () => {
  beforeEach(() => {
    clearCache();
  });

  it('caches the value within the TTL (fn called once)', async () => {
    let t = 1000;
    const now = () => t;
    const fn = vi.fn(async () => 'value');

    const a = await getCached('k', 5000, fn, now);
    t = 4000; // still within 5000ms TTL
    const b = await getCached('k', 5000, fn, now);

    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-invokes fn after the TTL expires', async () => {
    let t = 1000;
    const now = () => t;
    const fn = vi.fn(async () => `value-${t}`);

    const a = await getCached('k', 5000, fn, now);
    t = 7000; // 6000ms later → past TTL
    const b = await getCached('k', 5000, fn, now);

    expect(a).toBe('value-1000');
    expect(b).toBe('value-7000');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('dedups concurrent callers onto a single fn invocation', async () => {
    let resolveFn: (v: string) => void = () => {};
    const fn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const p1 = getCached('k', 5000, fn);
    const p2 = getCached('k', 5000, fn);
    const p3 = getCached('k', 5000, fn);

    resolveFn('shared');
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toBe('shared');
    expect(r2).toBe('shared');
    expect(r3).toBe('shared');
    expect(fn).toHaveBeenCalledTimes(1); // all three shared one fetch
  });

  it('does NOT cache a rejected fetch — the next call retries', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered');

    await expect(getCached('k', 5000, fn)).rejects.toThrow('boom');
    // failure was not cached → second call re-invokes fn and succeeds
    await expect(getCached('k', 5000, fn)).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('concurrent callers all reject when the shared fetch rejects, then a later call retries', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const p1 = getCached('k', 5000, fn);
    const p2 = getCached('k', 5000, fn);

    await expect(p1).rejects.toThrow('fail');
    await expect(p2).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1); // both shared the one failing fetch

    await expect(getCached('k', 5000, fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('keys are independent', async () => {
    const fnA = vi.fn(async () => 'A');
    const fnB = vi.fn(async () => 'B');
    expect(await getCached('a', 5000, fnA)).toBe('A');
    expect(await getCached('b', 5000, fnB)).toBe('B');
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
  });
});
