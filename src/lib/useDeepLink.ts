import { useCallback, useEffect, useRef } from 'react';
import type { ViewMode } from '@/components/ViewToggle';
import type { UntisClass } from '@/src/types';
import { isIAClass, normalize } from '@/src/lib/classGroups';

interface CapturedParams {
  /** `?schoolyear=` short form (e.g. "25"), or null — resolved by the bootstrap. */
  urlYearShort: string | null;
  /** Whether `?details` was present — bootstrap turns on details mode. */
  detailsRequested: boolean;
}

interface DeepLinkArgs {
  classes: UntisClass[];
  handleClassChange: (id: number) => void;
  loadCalendar: (fetchIds: number[]) => void;
  loadAggregated: () => void;
  setSelectedFetchIds: (ids: number[]) => void;
  setViewMode: (mode: ViewMode) => void;
}

/**
 * Owns the popup deep-link: the pending `?class` / `?companion` / `?view` refs
 * and the effect that consumes them exactly once after classes load.
 *
 * Invariants:
 *  - `captureUrlParams()` is called ONCE from the bootstrap, before any fetch,
 *    so the pending refs are populated before classes can arrive (refs, not
 *    state — reading them must not trigger a render or race the fetch).
 *  - The consume effect runs once classes are non-empty and clears every ref it
 *    reads, so a deep link is applied a single time.
 *  - `?view=all` takes precedence over `?class=`.
 *  - A `?companion` alongside an unresolved IA class resolves directly, skipping
 *    the IA dialog.
 *  - `isPending()` gates the URL-sync effect: while a class deep-link is still
 *    pending, URL sync must NOT run or it would briefly drop `?class=`.
 */
export function useDeepLink({
  classes,
  handleClassChange,
  loadCalendar,
  loadAggregated,
  setSelectedFetchIds,
  setViewMode,
}: DeepLinkArgs) {
  const pendingClassNameRef = useRef<string | null>(null);
  const pendingCompanionNameRef = useRef<string | null>(null);
  const pendingViewModeRef = useRef<string | null>(null);

  // Read all deep-link URL params once (from the bootstrap, before any fetch).
  const captureUrlParams = useCallback((): CapturedParams => {
    const urlParams = new URLSearchParams(window.location.search);
    const getP = (k: string) => {
      const v = urlParams.get(k)?.trim();
      return v?.length ? v : null;
    };
    pendingClassNameRef.current = getP('class');
    pendingCompanionNameRef.current = getP('companion');
    pendingViewModeRef.current = getP('view');
    return {
      urlYearShort: getP('schoolyear'),
      detailsRequested: getP('details') != null,
    };
  }, []);

  // True while a class deep-link is still waiting to be consumed.
  const isPending = useCallback(() => pendingClassNameRef.current != null, []);

  // Once classes are loaded, consume any pending deep-link exactly once.
  useEffect(() => {
    if (classes.length === 0) return;

    // ?view=all takes precedence over ?class=
    if (pendingViewModeRef.current === 'all') {
      pendingViewModeRef.current = null;
      pendingClassNameRef.current = null;
      pendingCompanionNameRef.current = null;
      setViewMode('all');
      void loadAggregated();
      return;
    }

    const name = pendingClassNameRef.current;
    if (!name) return;
    const target = normalize(name);
    const match = classes.find((c) => normalize(c.name) === target);
    pendingClassNameRef.current = null;
    if (!match) {
      pendingCompanionNameRef.current = null;
      return;
    }
    setViewMode('single');
    // If the URL also carried a companion, resolve it directly (skipping the IA dialog).
    const unresolvedIA = isIAClass(match.name) && (match.fetchIds?.length ?? 0) < 2;
    const companionName = pendingCompanionNameRef.current;
    pendingCompanionNameRef.current = null;
    if (unresolvedIA && companionName) {
      const companionTarget = normalize(companionName);
      const companion = classes.find((c) => normalize(c.name) === companionTarget);
      if (companion) {
        const fetchIds = [match.id, companion.id];
        setSelectedFetchIds(fetchIds);
        void loadCalendar(fetchIds);
        return;
      }
    }
    handleClassChange(match.id);
  }, [classes, handleClassChange, loadCalendar, loadAggregated, setSelectedFetchIds, setViewMode]);

  return { captureUrlParams, isPending };
}
