export type DayType =
  | 'ferien'          // school vacation period (Schulferien)
  | 'normal'          // school day with at least one non-cancelled lesson
  | 'unterrichtsausfall' // no effective lessons: day cancelled, all lessons cancelled, or "Unterrichtsausfall" event
  | 'veranstaltung'   // special school event (Veranstaltung) without "Unterrichtsausfall" prefix
  | 'no-lessons'      // weekday that is simply not a school day for this class
  | 'weekend'
  | 'out-of-year';

export interface CalendarDay {
  date: string;        // 'YYYY-MM-DD'
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
}

export interface UntisHoliday {
  id: number;
  name: string;
  longName: string;
  startDate: number; // YYYYMMDD
  endDate: number;   // YYYYMMDD
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

export interface CalendarData {
  schoolYear: SchoolYearSummary;
  days: CalendarDay[];
}

// ─── Aggregated view (all classes at once) ───────────────────────────────────

export type AggregatedDayType =
  | 'normal'      // every class with school has a normal day
  | 'irregular'   // at least one class has Unterrichtsausfall (cancelled / no effective lessons)
  | 'ferien'      // global school vacation
  | 'weekend'
  | 'no-school'   // weekday outside the school calendar for everyone
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
  date: string;              // 'YYYY-MM-DD'
  type: AggregatedDayType;
  holidayName?: string;
  /** Populated only when `type === 'irregular'` — classes with Unterrichtsausfall on this day. */
  affectedClasses?: ClassDayStatus[];
}

export interface AggregatedCalendarData {
  schoolYear: SchoolYearSummary;
  days: AggregatedDay[];
}
