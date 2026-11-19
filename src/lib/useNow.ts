import { useEffect, useState } from 'react';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Current time for date-dependent rendering (draft notice, preview gate, school-year
 * list). Refreshes hourly and whenever the tab becomes visible again, so a page left
 * open across midnight or a school-year boundary doesn't keep a stale date.
 */
export function useNow(intervalMs = HOUR_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
}
