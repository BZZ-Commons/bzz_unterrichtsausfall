'use client';

import { useEffect, useState } from 'react';

/**
 * Unobtrusive footer badge: number of MCP requests in the last 15 minutes.
 * Renders nothing until the first successful fetch; refreshes every minute.
 */
export default function McpRequestBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/mcp-stats');
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {
        // Keep the badge hidden (or stale) on fetch errors — purely informational.
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
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
