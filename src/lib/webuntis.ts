import { WebUntis, type SchoolYear } from 'webuntis';

function createUntisClient(): WebUntis {
  const school = process.env.WEBUNTIS_SCHOOL;
  const username = process.env.WEBUNTIS_USERNAME;
  const password = process.env.WEBUNTIS_PASSWORD;
  const baseUrl = process.env.WEBUNTIS_BASE_URL;

  if (!school || !username || !password || !baseUrl) {
    throw new Error(
      'Missing WebUntis environment variables: WEBUNTIS_SCHOOL, WEBUNTIS_USERNAME, WEBUNTIS_PASSWORD, WEBUNTIS_BASE_URL'
    );
  }

  return new WebUntis(school, username, password, baseUrl);
}

/**
 * Resolve a school year by ID, or fall back to the current one.
 * Returns the full year object (incl. start/end dates).
 */
export async function resolveSchoolyear(
  untis: WebUntis,
  yearId: number | null,
): Promise<SchoolYear> {
  if (yearId !== null && !isNaN(yearId)) {
    const found = (await untis.getSchoolyears(true)).find((y) => y.id === yearId);
    if (!found) throw new Error(`School year ${yearId} not found`);
    return found;
  }
  return untis.getCurrentSchoolyear(true);
}

/**
 * Lightweight variant for callers that need only the year ID — skips the
 * `getSchoolyears` fetch when an ID is already provided.
 */
export async function resolveSchoolyearId(
  untis: WebUntis,
  yearId: number | null,
): Promise<number> {
  if (yearId !== null && !isNaN(yearId)) return yearId;
  return (await untis.getCurrentSchoolyear(true)).id;
}

/**
 * Run async tasks with a max concurrency limit, preserving input order.
 * Used to avoid overwhelming the WebUntis API with hundreds of parallel calls.
 */
export async function mapWithConcurrency<TIn, TOut>(
  items: ReadonlyArray<TIn>,
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results: TOut[] = new Array(items.length);
  let cursor = 0;

  async function runOne(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runOne());
  await Promise.all(workers);
  return results;
}

/**
 * Creates a WebUntis client, logs in, runs `fn`, then logs out.
 * Guarantees logout even on error — callers only write the domain logic.
 */
export async function withUntisClient<T>(fn: (untis: WebUntis) => Promise<T>): Promise<T> {
  const untis = createUntisClient();
  await untis.login();
  try {
    const result = await fn(untis);
    await untis.logout();
    return result;
  } catch (error) {
    try { await untis.logout(); } catch { /* ignore secondary logout error */ }
    throw error;
  }
}
