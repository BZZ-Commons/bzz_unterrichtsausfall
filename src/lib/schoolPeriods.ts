import { format } from 'date-fns';
import type { WebUntis } from 'webuntis';
import type { SchoolPeriod, UntisLesson, UntisSchoolYear } from '@/src/types';

type RawLesson = UntisLesson & { startTime?: number };

function untisDateToIso(date: number): string {
  const s = date.toString();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * Fetch Q1–Q4 and Semester 1/2 boundaries for a school year.
 *
 * Strategy: find the IA 1st-year class (IA{YY} a) for this school year
 * and read its morning timetable. The morning subject changes 4× per year —
 * each subject run corresponds to a quarter.
 *
 * Returns [] when data is unavailable (no IA class, < 4 subjects).
 */
export async function fetchSchoolPeriods(
  untis: WebUntis,
  schoolYear: UntisSchoolYear,
): Promise<SchoolPeriod[]> {
  const yearSuffix = String(schoolYear.startDate.getFullYear()).slice(-2);
  const classes = (await untis.getClasses(true, schoolYear.id)) as Array<{
    id: number;
    name: string;
    active: boolean;
  }>;

  // "IA{YY} a" — the 1st-year IA section that has the quarterly morning subject
  const iaClass = classes.find(
    (c) =>
      c.active &&
      new RegExp(`^IA${yearSuffix}\\b`, 'i').test(c.name) &&
      /\ba\b/i.test(c.name),
  );

  if (!iaClass) return [];

  const lessons = (await untis.getTimetableForRange(
    schoolYear.startDate,
    schoolYear.endDate,
    iaClass.id,
    1, // WebUntis.TYPES.CLASS
  )) as RawLesson[];

  // Non-cancelled morning lessons (≤ 09:00) that carry a subject
  const morning = lessons.filter(
    (l) =>
      l.code !== 'cancelled' &&
      l.startTime != null &&
      l.startTime >= 700 &&
      l.startTime <= 900 &&
      (l.su?.length ?? 0) > 0,
  );

  // Group by subject → date range [first, last]
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

  // Sort subjects by first occurrence → Q1 … Q4
  const subjects = [...subjectMap.values()]
    .sort((a, b) => a.first - b.first)
    .slice(0, 4);

  if (subjects.length < 2) return [];

  const yearStart = format(schoolYear.startDate, 'yyyy-MM-dd');
  const yearEnd = format(schoolYear.endDate, 'yyyy-MM-dd');

  const quarters: SchoolPeriod[] = subjects.map((range, i) => ({
    name: `Q${i + 1}`,
    type: 'quarter',
    // Q1 anchors to school year start; Q4 anchors to school year end
    startDate: i === 0 ? yearStart : untisDateToIso(range.first),
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
