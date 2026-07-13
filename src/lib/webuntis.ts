import { WebUntis, type SchoolYear } from 'webuntis';
import type { UntisLesson, UntisSchoolYear, UntisWeekLesson } from '@/src/types';
import { parseUntisLessons, parseUntisWeekLessons } from '@/src/lib/untisBoundary';

/**
 * WebUntis rate-limit recovery: retry backoffs (ms), one per additional attempt.
 * WebUntis throttles by IP; under load the block escalates from a plain 429 to a
 * dropped TLS handshake, so a couple of escalating retries clears most cases.
 */
const RATE_LIMIT_RETRY_BACKOFFS_MS = [1500, 4000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True when a thrown error looks like a transient WebUntis rate-limit / network
 * hiccup that a retry can clear. WebUntis throttling surfaces as a 429, a reset
 * connection (ECONNRESET), a dropped TLS handshake ("socket disconnected before
 * secure TLS connection"), or a timeout — all worth retrying.
 */
function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /429|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|rate.?limit|socket disconnected|secure TLS/i.test(
    err.message,
  );
}

/**
 * True when a WebUntis call returned an empty JSON-RPC result — the package
 * throws `"Server didn't return any result."`. Happens for calls scoped to the
 * "current" school year during the summer gap between years (no year is active).
 */
function isNoResultError(err: unknown): boolean {
  return err instanceof Error && /didn't return any result/i.test(err.message);
}

function createUntisClient(): WebUntis {
  const school = process.env.WEBUNTIS_SCHOOL;
  const username = process.env.WEBUNTIS_USERNAME;
  const password = process.env.WEBUNTIS_PASSWORD;
  const baseUrl = process.env.WEBUNTIS_BASE_URL;

  if (!school || !username || !password || !baseUrl) {
    throw new Error(
      'Missing WebUntis environment variables: WEBUNTIS_SCHOOL, WEBUNTIS_USERNAME, WEBUNTIS_PASSWORD, WEBUNTIS_BASE_URL',
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
    const years = await withRateLimitRetry(() => untis.getSchoolyears(true));
    const found = years.find((y) => y.id === yearId);
    if (!found) throw new Error(`School year ${yearId} not found`);
    return found;
  }
  return getCurrentOrDefaultSchoolyear(untis);
}

/**
 * The "current" school year, resilient to the summer gap between years.
 *
 * `untis.getCurrentSchoolyear()` throws "Server didn't return any result" when no
 * year is active — e.g. between the end of one year in mid-July and the start of
 * the next in mid-August. We instead pick from the full list: the year whose range
 * contains today, else the most recent by start date (the upcoming year during the
 * gap). Mirrors the client's `findDefaultSchoolYear`.
 */
async function getCurrentOrDefaultSchoolyear(untis: WebUntis): Promise<SchoolYear> {
  const years = await withRateLimitRetry(() => untis.getSchoolyears(true));
  if (years.length === 0) throw new Error('No school years available');
  const now = Date.now();
  const containing = years.find(
    (y) => new Date(y.startDate).getTime() <= now && now <= new Date(y.endDate).getTime(),
  );
  if (containing) return containing;
  return years.reduce((a, b) =>
    new Date(a.startDate).getTime() >= new Date(b.startDate).getTime() ? a : b,
  );
}

/** Convert a raw WebUntis school year into the app's Date-based shape. */
export function toUntisSchoolYear(raw: SchoolYear): UntisSchoolYear {
  return {
    id: raw.id,
    name: raw.name,
    startDate: new Date(raw.startDate),
    endDate: new Date(raw.endDate),
  };
}

/**
 * Lightweight variant for callers that need only the year ID — skips the
 * `getSchoolyears` fetch when an ID is already provided.
 */
export async function resolveSchoolyearId(untis: WebUntis, yearId: number | null): Promise<number> {
  if (yearId !== null && !isNaN(yearId)) return yearId;
  return (await getCurrentOrDefaultSchoolyear(untis)).id;
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
 * Run a WebUntis fetch, retrying on transient rate-limit / network errors with
 * escalating backoff (see {@link RATE_LIMIT_RETRY_BACKOFFS_MS}). Non-retryable
 * errors are rethrown immediately.
 */
export async function withRateLimitRetry<T>(fetchRaw: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchRaw();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= RATE_LIMIT_RETRY_BACKOFFS_MS.length) throw err;
      await sleep(RATE_LIMIT_RETRY_BACKOFFS_MS[attempt]);
    }
  }
}

/**
 * Holidays for the WebUntis "current" school year, degrading to an empty list
 * when there is no current year — i.e. the summer gap between years, where the
 * server returns no result and the package throws "Server didn't return any
 * result". Holidays only paint Ferien cells, so an empty list is a safe
 * degradation: the rest of the calendar still classifies from the timetables.
 */
export async function fetchHolidaysSafe(
  untis: WebUntis,
): Promise<Awaited<ReturnType<WebUntis['getHolidays']>>> {
  try {
    return await withRateLimitRetry(() => untis.getHolidays(true));
  } catch (err) {
    if (isNoResultError(err)) return [];
    throw err;
  }
}

/**
 * Fetch one class's timetable for a school-year range, with a single retry on
 * rate-limit errors. The result is validated at the boundary (`parseUntisLessons`)
 * so upstream shape drift fails loudly instead of silently misclassifying days.
 *
 * This is the ONLY way routes should fetch timetables — it unifies retry +
 * validation at a single chokepoint.
 */
export async function fetchClassTimetable(
  untis: WebUntis,
  schoolYear: { startDate: Date; endDate: Date },
  classId: number,
): Promise<UntisLesson[]> {
  const raw = await withRateLimitRetry(() =>
    untis.getTimetableForRange(
      schoolYear.startDate,
      schoolYear.endDate,
      classId,
      1, // WebUntis.TYPES.CLASS
    ),
  );
  return parseUntisLessons(raw, `timetable for class ${classId}`);
}

/**
 * Fetch one class's week timetable via the newer REST endpoint
 * (`getTimetableForWeek`), validated into `UntisWeekLesson[]`. Unlike the classic
 * range API, this exposes `lessonCode`, the only authoritative way to tell an
 * official Untis lesson (`"LESSON"`) from a manually created WebUntis booking
 * (`"WEBUNTIS_ACTIVITY"`). Used by the booking strip-out — see
 * `stripWebUntisBookings` in calendar-server.ts. `weekDate` may be any date
 * within the desired week.
 */
export async function fetchClassTimetableWeek(
  untis: WebUntis,
  weekDate: Date,
  classId: number,
): Promise<UntisWeekLesson[]> {
  const raw = await withRateLimitRetry(() =>
    untis.getTimetableForWeek(weekDate, classId, 1 /* WebUntis.TYPES.CLASS */),
  );
  return parseUntisWeekLessons(raw, `week timetable for class ${classId}`);
}

/**
 * Fetch one teacher's timetable for a single day, validated into `UntisLesson[]`.
 * A teacher's all-day "Unterrichtsausfall: …" event is the only place the real
 * reason for a cancelled lesson lives (the cancelled lesson itself carries none) —
 * used by `fetchTeacherAusfallReasons` to enrich Unterrichtsausfall days.
 */
export async function fetchTeacherTimetableDay(
  untis: WebUntis,
  day: Date,
  teacherId: number,
): Promise<UntisLesson[]> {
  const raw = await withRateLimitRetry(() =>
    untis.getTimetableForRange(day, day, teacherId, 2 /* WebUntis.TYPES.TEACHER */),
  );
  return parseUntisLessons(raw, `timetable for teacher ${teacherId}`);
}

/**
 * WebUntis revokes a session after "less than 10min of idle" (per its docs), so
 * we re-login a little before that to keep the shared session usable.
 */
const SESSION_MAX_AGE_MS = 8 * 60 * 1000;

let sharedClient: WebUntis | null = null;
let sharedClientLoginAt = 0;
/** Login mutex: concurrent callers await the same in-flight login. */
let loginInFlight: Promise<WebUntis> | null = null;

/** True when an error indicates the WebUntis session is no longer valid. */
function isSessionError(err: unknown): boolean {
  return err instanceof Error && /session is not valid|no session id/i.test(err.message);
}

/** Discard the shared session so the next call logs in fresh. */
function invalidateSharedClient(): void {
  sharedClient = null;
  sharedClientLoginAt = 0;
}

/**
 * A logged-in WebUntis client, shared across requests instead of re-created per
 * call. WebUntis throttles logins per IP, and a fresh login for every API route
 * (4+ per page load) trips that limit; reusing one warm session collapses those
 * to a single login. The session is re-created only when older than
 * {@link SESSION_MAX_AGE_MS} or after a session error. The `loginInFlight` mutex
 * collapses concurrent bootstrap requests into one login.
 */
async function getSharedClient(): Promise<WebUntis> {
  if (sharedClient && Date.now() - sharedClientLoginAt < SESSION_MAX_AGE_MS) {
    return sharedClient;
  }
  if (loginInFlight) return loginInFlight;

  const stale = sharedClient;
  invalidateSharedClient();
  loginInFlight = (async () => {
    // Best-effort logout of the stale session to free it server-side.
    if (stale) {
      try {
        await stale.logout();
      } catch {
        /* already revoked — ignore */
      }
    }
    const client = createUntisClient();
    // login() is the request most often hit by WebUntis rate-limiting; the
    // backoff+retry clears the transient case.
    await withRateLimitRetry(() => client.login());
    sharedClient = client;
    sharedClientLoginAt = Date.now();
    return client;
  })();
  try {
    return await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

/**
 * Run `fn` with a shared, logged-in WebUntis client (see {@link getSharedClient}).
 * Sessions are reused across calls rather than logging in per request — callers
 * only write the domain logic. On a session-invalid error the shared session is
 * discarded and `fn` is retried once with a fresh login.
 */
export async function withUntisClient<T>(fn: (untis: WebUntis) => Promise<T>): Promise<T> {
  const client = await getSharedClient();
  try {
    return await fn(client);
  } catch (error) {
    if (!isSessionError(error)) throw error;
    // Session died mid-use (e.g. server-side idle revoke) — re-login once and retry.
    invalidateSharedClient();
    const fresh = await getSharedClient();
    return fn(fresh);
  }
}
