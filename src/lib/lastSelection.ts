/**
 * Persists the last class selection in `localStorage`, so returning visitors
 * land on their class without re-selecting it (incl. the IA BM/ABU answer).
 * Class NAMES are stored (not ids) — they're stable across school years and
 * resolve through the same path as a `?class=`/`?companion=` deep link.
 */

const STORAGE_KEY = 'last-class-selection-v1';

export interface LastSelection {
  className: string;
  /** Companion class name for unresolved IA merges (the BM/ABU pick). */
  companionName?: string;
}

export function readLastSelection(): LastSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null) return null;
    const { className, companionName } = parsed as Partial<LastSelection>;
    if (typeof className !== 'string' || className.length === 0) return null;
    return {
      className,
      companionName:
        typeof companionName === 'string' && companionName.length > 0 ? companionName : undefined,
    };
  } catch {
    // localStorage unavailable (private mode) or corrupted JSON — behave as "nothing stored".
    return null;
  }
}

export function writeLastSelection(selection: LastSelection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // localStorage unavailable — persisting is best-effort only.
  }
}
