import { WebUntis, type SchoolYear } from 'webuntis';
import type { UntisLesson, UntisSchoolYear, UntisWeekLesson } from '@/src/types';
import { parseUntisLessons, parseUntisWeekLessons } from '@/src/lib/untisBoundary';

/** WebUntis rate-limit recovery: one retry after a short backoff. */
const RATE_LIMIT_RETRY_BACKOFF_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when a thrown error looks like a WebUntis rate-limit (429 / ECONNRESET). */
function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /429|ECONNRESET|rate.?limit/i.test(err.message);
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
    const found = (await untis.getSchoolyears(true)).find((y) => y.id === yearId);
    if (!found) throw new Error(`School year ${yearId} not found`);
    return found;
  }
  return untis.getCurrentSchoolyear(true);
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
 * Run a WebUntis fetch with a single retry on rate-limit errors (429 /
 * ECONNRESET) after a short backoff — empirically enough to clear the limit.
 */
async function withRateLimitRetry<T>(fetchRaw: () => Promise<T>): Promise<T> {
  try {
    return await fetchRaw();
  } catch (err) {
    if (!isRateLimitError(err)) throw err;
    await sleep(RATE_LIMIT_RETRY_BACKOFF_MS);
    return fetchRaw();
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
 * Creates a WebUntis client, logs in, runs `fn`, then logs out.
 * Guarantees logout even on error — callers only write the domain logic.
 */
export async function withUntisClient<T>(fn: (untis: WebUntis) => Promise<T>): Promise<T> {
  const untis = createUntisClient();
  await untis.login();
  try {
    const result = await fn(untis);
    try {
      await untis.logout();
    } catch {
      /* session may have expired during long fetch — ignore */
    }
    return result;
  } catch (error) {
    try {
      await untis.logout();
    } catch {
      /* ignore secondary logout error */
    }
    throw error;
  }
}
