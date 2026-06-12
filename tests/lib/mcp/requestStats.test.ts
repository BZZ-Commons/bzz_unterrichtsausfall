import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordMcpRequest,
  getMcpRequestCount,
  resetMcpRequestStats,
} from '@/src/lib/mcp/requestStats';

const T0 = 1_750_000_000_000; // fixed epoch base for deterministic buckets

describe('requestStats', () => {
  beforeEach(() => {
    resetMcpRequestStats();
  });

  it('starts at zero', () => {
    expect(getMcpRequestCount(T0)).toBe(0);
  });

  it('counts recorded requests within the window', () => {
    recordMcpRequest(T0);
    recordMcpRequest(T0 + 1_000);
    recordMcpRequest(T0 + 5 * 60_000);
    expect(getMcpRequestCount(T0 + 5 * 60_000)).toBe(3);
  });

  it('drops requests older than 15 minutes', () => {
    recordMcpRequest(T0);
    expect(getMcpRequestCount(T0 + 14 * 60_000)).toBe(1);
    expect(getMcpRequestCount(T0 + 16 * 60_000)).toBe(0);
  });

  it('keeps recent requests while old ones expire', () => {
    recordMcpRequest(T0);
    recordMcpRequest(T0 + 20 * 60_000);
    expect(getMcpRequestCount(T0 + 20 * 60_000)).toBe(1);
  });

  it('prunes expired buckets on record', () => {
    recordMcpRequest(T0);
    // Recording far in the future prunes the old bucket; only the new one remains.
    recordMcpRequest(T0 + 60 * 60_000);
    expect(getMcpRequestCount(T0 + 60 * 60_000)).toBe(1);
  });
});
