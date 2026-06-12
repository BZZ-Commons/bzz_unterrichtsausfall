import { format, startOfISOWeek, addDays } from 'date-fns';
import type { WebUntis } from 'webuntis';
import type { SchoolPeriod, UntisSchoolYear } from '@/src/types';
import { parseUntisDate } from '@/src/lib/calendar';
import { fetchClassTimetable } from '@/src/lib/webuntis';
import { parseUntisClasses } from '@/src/lib/untisBoundary';

function untisDateToIso(date: number): string {
  const s = date.toString();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// Monday of the calendar week AFTER the given untis date
function nextWeekMonday(untisDate: number): string {
  return format(startOfISOWeek(addDays(parseUntisDate(untisDate), 7)), 'yyyy-MM-dd');
}

function findIaClass(
  classes: ReadonlyArray<{ id: number; name: string; active: boolean }>,
  yearSuffix: string,
): { id: number; name: string } | undefined {
  return classes.find(
    (c) => c.active && new RegExp(`^IA${yearSuffix}\\b`, 'i').test(c.name) && /\ba\b/i.test(c.name),
  );
}

async function extractSubjectRanges(
  untis: WebUntis,
  classId: number,
  schoolYear: UntisSchoolYear,
): Promise<Array<{ first: number; last: number }>> {
  const lessons = await fetchClassTimetable(untis, schoolYear, classId);

  const morning = lessons.filter(
    (l) =>
      l.code !== 'cancelled' &&
      l.startTime != null &&
      l.startTime >= 700 &&
      l.startTime <= 900 &&
      (l.su?.length ?? 0) > 0,
  );

  const subjectMap = new Map<string, { first: number; last: number }>();
  for (const l of morning) {
    const subj = l.su![0].name;
    const existing = subjectMap.get(subj);
    if (!existing) {
      subjectMap.set(subj, { first: l.date, last: l.date });
    } else {
      if (l.date > existing.last) existing.last = l.date;
    }
  }

  return [...subjectMap.values()].sort((a, b) => a.first - b.first).slice(0, 4);
}

/**
 * Fetch Q1–Q4 and Semester 1/2 boundaries for a school year.
 *
 * Validates via two IA classes:
 *   - IA{YY} a   — 1st-year class (primary)
 *   - IA{YY-1} a — 2nd-year class (cross-validation)
 *
 * Q boundaries snap to Monday of the next calendar week after the previous
 * quarter's last lesson. When both classes have 4 quarters, uses the later
 * last-date per quarter (the quarter ends when both classes finish the module).
 */
export async function fetchSchoolPeriods(
  untis: WebUntis,
  schoolYear: UntisSchoolYear,
): Promise<SchoolPeriod[]> {
  const suffix1 = String(schoolYear.startDate.getFullYear()).slice(-2); // "26" for 2026/27
  const suffix2 = String(schoolYear.startDate.getFullYear() - 1).slice(-2); // "25" for 2026/27

  const classes = parseUntisClasses(
    await untis.getClasses(true, schoolYear.id),
    `classes for school year ${schoolYear.id}`,
  );

  const class1 = findIaClass(classes, suffix1); // IA26 a (1st year)
  const class2 = findIaClass(classes, suffix2); // IA25 a (2nd year)

  if (!class1 && !class2) return [];

  const [ranges1, ranges2] = await Promise.all([
    class1 ? extractSubjectRanges(untis, class1.id, schoolYear) : Promise.resolve([]),
    class2 ? extractSubjectRanges(untis, class2.id, schoolYear) : Promise.resolve([]),
  ]);

  // Both found 4 quarters → merge (use the later last-date per position);
  // otherwise prefer whichever has 4, then whichever has ≥ 2 (class1 first).
  const subjects =
    ranges1.length === 4 && ranges2.length === 4
      ? ranges1.map((r1, i) => ({
          first: Math.min(r1.first, ranges2[i].first),
          last: Math.max(r1.last, ranges2[i].last),
        }))
      : ([ranges1, ranges2].find((r) => r.length === 4) ??
        [ranges1, ranges2].find((r) => r.length >= 2) ??
        null);

  if (!subjects) return [];

  const yearStart = format(schoolYear.startDate, 'yyyy-MM-dd');
  const yearEnd = format(schoolYear.endDate, 'yyyy-MM-dd');

  // Q boundaries: Q1 anchors to school year start; Q2+ start Monday of the
  // next calendar week after the previous quarter's last lesson.
  const quarters: SchoolPeriod[] = subjects.map((range, i) => ({
    name: `Q${i + 1}`,
    type: 'quarter',
    startDate: i === 0 ? yearStart : nextWeekMonday(subjects[i - 1].last),
    endDate: i === subjects.length - 1 ? yearEnd : untisDateToIso(range.last),
  }));

  const semesters: SchoolPeriod[] = [
    {
      name: '1. Semester',
      type: 'semester',
      startDate: quarters[0].startDate,
      endDate: quarters[1].endDate,
    },
  ];
  if (quarters.length >= 3) {
    semesters.push({
      name: '2. Semester',
      type: 'semester',
      startDate: quarters[2].startDate,
      endDate: quarters[quarters.length - 1].endDate,
    });
  }

  return [...quarters, ...semesters];
}
