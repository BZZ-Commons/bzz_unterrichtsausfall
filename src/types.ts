export type DayType =
  | 'ferien' // school vacation period (Schulferien)
  | 'normal' // school day with at least one non-cancelled lesson
  | 'unterrichtsausfall' // no effective lessons: day cancelled, all lessons cancelled, or "Unterrichtsausfall" event
  | 'veranstaltung' // special school event (Veranstaltung) without "Unterrichtsausfall" prefix
  | 'no-lessons' // weekday that is simply not a school day for this class
  | 'weekend'
  | 'out-of-year';

/**
 * Status of one half (Vormittag / Nachmittag) of a split day cell:
 *  - 'lessons'   at least one lesson is held in this half  → green
 *  - 'cancelled' lessons were planned here but all cancelled → orange
 *  - 'none'      nothing was scheduled in this half          → gray
 */
export type HalfStatus = 'lessons' | 'cancelled' | 'none';

/** One half (Vormittag/Nachmittag) of a day: its status and the class whose lessons fill it. */
export interface DayHalf {
  status: HalfStatus;
  /** Class owning this half's lessons — links the half to that class's WebUntis week. */
  classId?: number;
  /** Schulausfall reason for a 'cancelled' half (e.g. "QV BM & KV"), from an event period. */
  reason?: string;
}

export interface HalfDayInfo {
  morning: DayHalf; // lessons starting before 12:00 — left side of the cell
  afternoon: DayHalf; // lessons starting at/after 12:00 — right side of the cell
}

export interface CalendarDay {
  date: string; // 'YYYY-MM-DD'
  type: DayType;
  holidayName?: string;
  /**
   * Reason label for a Schulausfall caused by a special event ("Veranstaltung"),
   * e.g. "Lehrpersonenweiterbildung …". Sourced from the event period's lstext.
   */
  eventName?: string;
  /** Effective lessons that actually take place (excludes cancelled). */
  lessonCount?: number;
  /** Lessons that were scheduled but cancelled. */
  cancelledCount?: number;
  /**
   * True wenn dies ein Schultag NACH der letzten Lektion der Klasse ist
   * (Abschlussklasse hat das Schuljahr beendet — keine Lektionen mehr bis Jahresende).
   * Nur in der Gesamtübersicht ausgewertet; die Einzelansicht ignoriert das Feld.
   */
  ended?: boolean;
  /**
   * Present when the day cell should be split left/right (Vormittag | Nachmittag) —
   * because the two halves differ in status (lessons/cancelled/none) or belong to
   * different classes (e.g. IA in the morning, BM in the afternoon). Each half links
   * to its own class. Undefined when the whole day is a single cell (see linkClassId).
   */
  halfDay?: HalfDayInfo;
  /**
   * Class to link an un-split day cell to — the class whose lessons dominate the day.
   * For merged views this can be a companion class, not the selected one. Undefined
   * for days without lessons (the cell then links to the selected class).
   */
  linkClassId?: number;
}

export interface UntisHoliday {
  id: number;
  name: string;
  longName: string;
  startDate: number; // YYYYMMDD
  endDate: number; // YYYYMMDD
}

export interface UntisSchoolYear {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface UntisClass {
  id: number;
  name: string;
  longName: string;
  active: boolean;
  /** Names of companion classes shown in the dropdown (display only). */
  companionNames?: string[];
  /** All class IDs whose timetable is merged in this calendar view (self + companions). Pre-resolved by /api/classes. */
  fetchIds?: number[];
}

/**
 * Subset of WebUntis lesson fields we actually consume.
 * The library returns many more fields (startTime, endTime, te/kl/ro, lsnumber,
 * activityType, …); they're not needed for this app.
 *
 * Note: `info` is intentionally NOT consumed — it's unreliable for our purposes.
 */
export interface UntisLesson {
  id: number;
  date: number; // YYYYMMDD
  /** Lesson start as an HHMM number (e.g. 800, 1150, 1335). Splits a day into Vormittag/Nachmittag. */
  startTime?: number;
  /** Class this lesson was fetched under — set server-side before dedup; identifies the owning class for links. */
  sourceClassId?: number;
  code?: 'cancelled' | 'irregular' | string;
  /** Subjects. Empty for special-event periods ("Veranstaltung"). */
  su?: { name: string }[];
  /** Free-text lesson note — carries the event name on irregular event periods. */
  lstext?: string;
  /** Substitution text — weak signal; used only as an eventName fallback. */
  substText?: string;
}

/** Serializable school year shape used over the JSON API. */
export interface SchoolYearSummary {
  id: number;
  name: string;
  startDate: string; // ISO string
  endDate: string;
}

export interface SchoolPeriod {
  name: string; // "Q1", "Q2", "Q3", "Q4", "1. Semester", "2. Semester"
  type: 'quarter' | 'semester';
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
}

export interface CalendarData {
  schoolYear: SchoolYearSummary;
  days: CalendarDay[];
}

// ─── Aggregated view (all classes at once) ───────────────────────────────────

export type AggregatedDayType =
  | 'normal' // every class with school has a normal day
  | 'irregular' // at least one class has Unterrichtsausfall (cancelled / no effective lessons)
  | 'ferien' // global school vacation
  | 'weekend'
  | 'no-school' // weekday outside the school calendar for everyone
  | 'out-of-year';

/** Per-class status for a single day in the aggregated view. */
export interface ClassDayStatus {
  className: string;
  classId: number;
  type: DayType;
  lessonCount: number;
  cancelledCount: number;
}

export interface AggregatedDay {
  date: string; // 'YYYY-MM-DD'
  type: AggregatedDayType;
  holidayName?: string;
  /** Populated only when `type === 'irregular'` — classes with Unterrichtsausfall on this day. */
  affectedClasses?: ClassDayStatus[];
}

export interface AggregatedCalendarData {
  schoolYear: SchoolYearSummary;
  days: AggregatedDay[];
}
