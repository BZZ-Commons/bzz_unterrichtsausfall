import type { UntisClass, UntisHoliday, UntisLesson } from '@/src/types';

/**
 * Runtime validation at the WebUntis boundary.
 *
 * The `webuntis` library types every response loosely (often `any`), so a shape
 * drift in the upstream API used to slip through a blind `as UntisLesson[]` cast
 * and silently misclassify days. These hand-rolled guards validate exactly the
 * fields the app consumes and throw loudly (with context + index + offending
 * field) on any violation, so drift surfaces immediately instead of corrupting
 * the calendar.
 *
 * Deliberately dependency-free (no zod) — the surface is tiny and stable.
 */

/** Truncated JSON of a value, for inclusion in error messages. */
function preview(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    json = String(value);
  }
  if (json === undefined) json = String(value);
  return json.length > 200 ? `${json.slice(0, 200)}…` : json;
}

/** Throw a richly-contextualised validation error for element `index`. */
function fail(context: string, index: number, field: string, element: unknown): never {
  throw new Error(
    `${context}: invalid WebUntis element at index ${index}, field "${field}" — ${preview(element)}`,
  );
}

function expectArray(raw: unknown, context: string): unknown[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${context}: expected an array, got ${preview(raw)}`);
  }
  return raw;
}

// ─── Per-element field guards ────────────────────────────────────────────────
// Each takes the parent record + the failing-error closure so violations carry
// full context (array index + field name).

function expectNumber(
  rec: Record<string, unknown>,
  key: string,
  onFail: (field: string) => never,
): number {
  const v = rec[key];
  if (typeof v !== 'number') onFail(key);
  return v as number;
}

function expectString(
  rec: Record<string, unknown>,
  key: string,
  onFail: (field: string) => never,
): string {
  const v = rec[key];
  if (typeof v !== 'string') onFail(key);
  return v as string;
}

function expectBoolean(
  rec: Record<string, unknown>,
  key: string,
  onFail: (field: string) => never,
): boolean {
  const v = rec[key];
  if (typeof v !== 'boolean') onFail(key);
  return v as boolean;
}

/** Optional field: absent → ok; present but wrong type → fail. */
function optionalNumber(
  rec: Record<string, unknown>,
  key: string,
  onFail: (field: string) => never,
): void {
  const v = rec[key];
  if (v != null && typeof v !== 'number') onFail(key);
}

function optionalString(
  rec: Record<string, unknown>,
  key: string,
  onFail: (field: string) => never,
): void {
  const v = rec[key];
  if (v != null && typeof v !== 'string') onFail(key);
}

function asRecord(element: unknown, context: string, index: number): Record<string, unknown> {
  if (typeof element !== 'object' || element === null || Array.isArray(element)) {
    fail(context, index, '<element>', element);
  }
  return element as Record<string, unknown>;
}

// ─── Public parsers ──────────────────────────────────────────────────────────

/**
 * Validate a raw WebUntis timetable response into `UntisLesson[]`.
 * Required: id (number), date (number).
 * Optional (type-checked if present): startTime, code, lstext, substText, su.
 * Returns the same array reference, typed.
 */
export function parseUntisLessons(raw: unknown, context: string): UntisLesson[] {
  const arr = expectArray(raw, context);
  arr.forEach((element, index) => {
    const rec = asRecord(element, context, index);
    const onFail = (field: string): never => fail(context, index, field, element);

    expectNumber(rec, 'id', onFail);
    expectNumber(rec, 'date', onFail);
    optionalNumber(rec, 'startTime', onFail);
    optionalString(rec, 'code', onFail);
    optionalString(rec, 'lstext', onFail);
    optionalString(rec, 'substText', onFail);

    // `su` is an array of { name: string }; only su[0].name and su.length are read.
    const su = rec['su'];
    if (su != null) {
      if (!Array.isArray(su)) onFail('su');
      for (const entry of su as unknown[]) {
        if (
          typeof entry !== 'object' ||
          entry === null ||
          typeof (entry as Record<string, unknown>)['name'] !== 'string'
        ) {
          onFail('su');
        }
      }
    }
  });
  return raw as UntisLesson[];
}

/**
 * Validate a raw WebUntis classes response into `UntisClass[]`.
 * Required: id (number), name (string), longName (string), active (boolean).
 */
export function parseUntisClasses(raw: unknown, context: string): UntisClass[] {
  const arr = expectArray(raw, context);
  arr.forEach((element, index) => {
    const rec = asRecord(element, context, index);
    const onFail = (field: string): never => fail(context, index, field, element);

    expectNumber(rec, 'id', onFail);
    expectString(rec, 'name', onFail);
    expectString(rec, 'longName', onFail);
    expectBoolean(rec, 'active', onFail);
  });
  return raw as UntisClass[];
}

/**
 * Validate a raw WebUntis holidays response into `UntisHoliday[]`.
 * Required: id (number), name (string), longName (string),
 * startDate (number), endDate (number).
 */
export function parseUntisHolidays(raw: unknown, context: string): UntisHoliday[] {
  const arr = expectArray(raw, context);
  arr.forEach((element, index) => {
    const rec = asRecord(element, context, index);
    const onFail = (field: string): never => fail(context, index, field, element);

    expectNumber(rec, 'id', onFail);
    expectString(rec, 'name', onFail);
    expectString(rec, 'longName', onFail);
    expectNumber(rec, 'startDate', onFail);
    expectNumber(rec, 'endDate', onFail);
  });
  return raw as UntisHoliday[];
}
