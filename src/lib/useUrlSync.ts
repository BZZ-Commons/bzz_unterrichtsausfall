import { useEffect } from 'react';
import type { ViewMode } from '@/components/ViewToggle';
import { normalize } from '@/src/lib/classGroups';

interface UrlSyncArgs {
  selectedSchoolYearShort: string | null;
  selectedClassName: string | null;
  selectedCompanionName: string | null;
  viewMode: ViewMode;
  detailsMode: boolean;
  /** True while a class deep-link is still pending — sync is skipped then. */
  isDeepLinkPending: () => boolean;
}

/**
 * Mirrors the current view into the URL query so the page stays shareable.
 *
 * Invariants:
 *  - `replaceState` runs only when the computed query string actually differs
 *    from the current location (no redundant history writes).
 *  - Param order and contents are fixed: `schoolyear`, then optional `details`,
 *    then either `view=all` XOR (`class` + optional `companion`).
 *  - Skipped while a class deep-link is still pending, so it never briefly drops
 *    `?class=` before that deep link has been consumed.
 */
export function useUrlSync({
  selectedSchoolYearShort,
  selectedClassName,
  selectedCompanionName,
  viewMode,
  detailsMode,
  isDeepLinkPending,
}: UrlSyncArgs) {
  useEffect(() => {
    if (typeof window === 'undefined' || selectedSchoolYearShort == null) return;
    if (isDeepLinkPending()) return;
    const params = new URLSearchParams();
    params.set('schoolyear', selectedSchoolYearShort);
    if (detailsMode) params.set('details', 'true');
    if (viewMode === 'all') {
      params.set('view', 'all');
    } else if (selectedClassName) {
      // Normalized (no spaces, lowercase) → "im24b" instead of "IM24+b". The
      // deep-link resolver normalizes both sides, so this still round-trips.
      params.set('class', normalize(selectedClassName));
      if (selectedCompanionName) {
        params.set('companion', normalize(selectedCompanionName));
      }
    }
    const next = `${window.location.pathname}?${params.toString()}`;
    if (next !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', next);
    }
  }, [
    selectedSchoolYearShort,
    selectedClassName,
    selectedCompanionName,
    viewMode,
    detailsMode,
    isDeepLinkPending,
  ]);
}
