/**
 * Tiny JSON-fetch helpers shared by the page's data hooks.
 *
 * `fetchJson` unwraps a `{ error }` body into a thrown Error on non-2xx so each
 * caller can surface a message uniformly. `isAbortError` lets callers swallow
 * the DOMException raised when an in-flight request is aborted (see the data
 * hooks' single-controller-per-concern abort semantics).
 */

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';
