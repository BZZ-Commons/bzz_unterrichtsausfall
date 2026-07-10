import { describe, it, expect } from 'vitest';
import {
  buildDayTimetable,
  formatUntisTime,
  type DayTimetableLesson,
} from '@/src/lib/dayTimetable';

describe('formatUntisTime', () => {
  it('zero-pads hours and minutes', () => {
    expect(formatUntisTime(800)).toBe('08:00');
    expect(formatUntisTime(1150)).toBe('11:50');
    expect(formatUntisTime(1335)).toBe('13:35');
  });
});

describe('buildDayTimetable', () => {
  it('sorts lessons chronologically', () => {
    const lessons: DayTimetableLesson[] = [
      { startTime: 1335, endTime: 1420, su: [{ name: 'E' }] },
      { startTime: 800, endTime: 845, su: [{ name: 'M' }] },
    ];
    expect(buildDayTimetable(lessons).map((l) => l.subject)).toEqual(['M', 'E']);
  });

  it('merges contiguous same-subject periods into one block', () => {
    const lessons: DayTimetableLesson[] = [
      { startTime: 800, endTime: 845, su: [{ name: 'M' }], ro: [{ name: '204' }] },
      { startTime: 850, endTime: 935, su: [{ name: 'M' }], ro: [{ name: '204' }] },
    ];
    const result = buildDayTimetable(lessons);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ subject: 'M', startTime: 800, endTime: 935 });
  });

  it('keeps a different subject in an adjacent slot separate', () => {
    const lessons: DayTimetableLesson[] = [
      { startTime: 800, endTime: 845, su: [{ name: 'M' }] },
      { startTime: 850, endTime: 935, su: [{ name: 'E' }] },
    ];
    expect(buildDayTimetable(lessons)).toHaveLength(2);
  });

  it('does not merge across a cancelled boundary', () => {
    const lessons: DayTimetableLesson[] = [
      { startTime: 800, endTime: 845, su: [{ name: 'M' }] },
      { startTime: 850, endTime: 935, su: [{ name: 'M' }], code: 'cancelled' },
    ];
    const result = buildDayTimetable(lessons);
    expect(result).toHaveLength(2);
    expect(result[1].cancelled).toBe(true);
  });

  it('flags cancelled periods and reads subject/room/teacher', () => {
    const lessons: DayTimetableLesson[] = [
      {
        startTime: 800,
        endTime: 845,
        su: [{ name: 'M' }],
        ro: [{ name: '204' }],
        te: [{ name: 'MÜL' }],
        code: 'cancelled',
      },
    ];
    expect(buildDayTimetable(lessons)[0]).toMatchObject({
      subject: 'M',
      room: '204',
      teacher: 'MÜL',
      cancelled: true,
    });
  });

  it('treats an irregular subject-less period as an event with its text', () => {
    const lessons: DayTimetableLesson[] = [
      {
        startTime: 800,
        endTime: 1200,
        code: 'irregular',
        su: [],
        lstext: 'Lehrpersonenweiterbildung',
      },
    ];
    const [event] = buildDayTimetable(lessons);
    expect(event).toMatchObject({ isEvent: true, text: 'Lehrpersonenweiterbildung', subject: '' });
  });

  it('drops lessons without a start time', () => {
    const lessons: DayTimetableLesson[] = [
      { su: [{ name: 'M' }] },
      { startTime: 800, su: [{ name: 'E' }] },
    ];
    const result = buildDayTimetable(lessons);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('E');
  });

  it('attaches the resolved reason only to cancelled lessons', () => {
    const lessons: DayTimetableLesson[] = [
      {
        startTime: 800,
        endTime: 845,
        su: [{ name: '279' }],
        te: [{ name: 'ÖzBe' }],
        code: 'cancelled',
      },
      { startTime: 850, endTime: 935, su: [{ name: 'M' }], te: [{ name: 'ÖzBe' }] },
    ];
    const reasonOf = (l: DayTimetableLesson) =>
      l.te?.[0]?.name === 'ÖzBe' ? 'QV BM & KV' : undefined;
    const result = buildDayTimetable(lessons, reasonOf);
    expect(result[0]).toMatchObject({ cancelled: true, reason: 'QV BM & KV' });
    // A held lesson never carries a reason, even when the resolver would return one.
    expect(result[1].reason).toBeUndefined();
  });

  it('drops "Unterrichtsausfall" blanket event periods from the preview', () => {
    const lessons: DayTimetableLesson[] = [
      {
        startTime: 745,
        endTime: 2359,
        code: 'irregular',
        su: [],
        lstext: 'Unterrichtsausfall: QV BM & KV',
      },
      {
        startTime: 835,
        endTime: 920,
        su: [{ name: '279' }],
        te: [{ name: 'ÖzBe' }],
        code: 'cancelled',
      },
    ];
    const result = buildDayTimetable(lessons);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('279');
  });

  it('keeps a genuine Veranstaltung event (no Unterrichtsausfall prefix)', () => {
    const lessons: DayTimetableLesson[] = [
      { startTime: 800, endTime: 1200, code: 'irregular', su: [], lstext: 'Sprachaufenthalt' },
    ];
    expect(buildDayTimetable(lessons)).toHaveLength(1);
  });

  it('does not merge adjacent cancelled periods with different reasons', () => {
    const lessons: DayTimetableLesson[] = [
      { startTime: 800, endTime: 845, su: [{ name: 'M' }], te: [{ name: 'A' }], code: 'cancelled' },
      { startTime: 850, endTime: 935, su: [{ name: 'M' }], te: [{ name: 'A' }], code: 'cancelled' },
    ];
    let n = 0;
    const reasonOf = () => (n++ === 0 ? 'QV BM & KV' : 'QV Allgemeinbildender Unterricht');
    expect(buildDayTimetable(lessons, reasonOf)).toHaveLength(2);
  });
});
