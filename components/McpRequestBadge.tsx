'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/src/lib/fetchJson';

/**
 * Unobtrusive footer badge: number of MCP requests in the last 15 minutes.
 * Renders nothing until the first successful fetch; refreshes every minute,
 * but only while the tab is visible (hidden tabs would otherwise poll forever).
 */
export default function McpRequestBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const data = await fetchJson<{ count: number }>('/api/mcp-stats');
        if (!cancelled) setCount(data.count);
      } catch {
        // Keep the badge hidden (or stale) on fetch errors — purely informational.
      }
    };
    load();
    const id = setInterval(load, 60_000);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  if (count === null) return null;

  return (
    <span
      title="MCP-Anfragen in den letzten 15 Minuten"
      className="tabular-nums cursor-help"
      aria-label="MCP-Anfragen in den letzten 15 Minuten"
    >
      {count}
    </span>
  );
}
