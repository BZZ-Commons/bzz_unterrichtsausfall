'use client';

import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { buildDayTooltip, halfStatusLabel } from '@/src/lib/calendar';
import { untisWeekHref } from '@/src/lib/untisLinks';
import { HALF_DAY_COLORS } from '@/src/lib/calendar-styles';
import DayTimetablePreview from '@/components/DayTimetablePreview';
import DialogShell from '@/components/DialogShell';
import type { CalendarDay, DayHalf, DayType } from '@/src/types';

/** Day types that can carry lessons → worth an inline timetable preview. */
const PREVIEW_DAY_TYPES = new Set<DayType>(['normal', 'unterrichtsausfall', 'veranstaltung']);

const DAY_TYPE_LABELS: Record<DayType, string> = {
  normal: 'Normaler Schultag',
  unterrichtsausfall: 'Unterrichtsausfall',
  veranstaltung: 'Veranstaltung',
  ferien: 'Schulferien',
  'no-lessons': 'Kein Unterricht',
  weekend: 'Wochenende',
  'out-of-year': '',
};

interface SingleDayDialogProps {
  day: CalendarDay;
  /** Monday of the day's week — target week for the WebUntis links. */
  monday: string;
  /** Selected class — link target for days/halves without a class of their own. */
  fallbackClassId: number;
  /** Merged class IDs (self + companions) — source for the day-timetable preview. */
  classIds: number[];
  /** Gate for the preview: hidden until the school year has started (dev: always on). */
  previewAllowed: boolean;
  classNamesById?: Map<number, string>;
  onClose: () => void;
}

function formatDateLong(iso: string): string {
  return format(parseISO(iso), 'EEEE, d. MMMM yyyy', { locale: de });
}

function formatWeekStart(iso: string): string {
  return format(parseISO(iso), 'd. MMMM yyyy', { locale: de });
}

/**
 * Details for one day of the single-class calendar: status, reason and explicit
 * WebUntis links. Opened by tapping/clicking a day cell — replaces the cells'
 * former direct external links, so the information is reachable on touch
 * devices and the WebUntis navigation is announced instead of surprising.
 */
export default function SingleDayDialog({
  day,
  monday,
  fallbackClassId,
  classIds,
  previewAllowed,
  classNamesById,
  onClose,
}: SingleDayDialogProps) {
  const classNameOf = (id?: number) => (id != null ? classNamesById?.get(id) : undefined);

  // Same fallback chain as the day cell: an empty half belongs to the day's
  // active class; days without any class link to the selected class.
  const morningId = day.halfDay
    ? (day.halfDay.morning.classId ?? day.halfDay.afternoon.classId ?? fallbackClassId)
    : null;
  const afternoonId = day.halfDay
    ? (day.halfDay.afternoon.classId ?? day.halfDay.morning.classId ?? fallbackClassId)
    : null;

  const linkIds = day.halfDay
    ? [...new Set([morningId!, afternoonId!])]
    : [day.linkClassId ?? fallbackClassId];

  const subtitle = day.halfDay
    ? 'Geteilter Tag (Vormittag / Nachmittag)'
    : DAY_TYPE_LABELS[day.type];
  const detail = buildDayTooltip(day);
  const showPreview = previewAllowed && PREVIEW_DAY_TYPES.has(day.type) && classIds.length > 0;

  const halfRow = (period: string, h: DayHalf) => (
    <li className="bzz-row justify-start gap-3 text-[15px]">
      <span
        className="inline-block h-3.5 w-3.5 shrink-0 rounded-bzz ring-1 ring-bzz-line ring-inset"
        style={{ background: HALF_DAY_COLORS[h.status] }}
        aria-hidden="true"
      />
      <span className="w-24 shrink-0 text-bzz-muted">{period}</span>
      <span className="min-w-0">
        {halfStatusLabel(h.status)}
        {h.reason && <span className="text-bzz-ink-2"> ({h.reason})</span>}
        {classNameOf(h.classId) && (
          <span className="text-bzz-muted"> — {classNameOf(h.classId)}</span>
        )}
      </span>
    </li>
  );

  return (
    <DialogShell
      title={formatDateLong(day.date)}
      subtitle={`${subtitle}${detail && !day.halfDay ? ` — ${detail}` : ''}`}
      onClose={onClose}
      widthClass="max-w-lg"
      capitalizeTitle
    >
      <div className="space-y-4">
        {day.halfDay && (
          <ul className="bzz-rows">
            {halfRow('Vormittag', day.halfDay.morning)}
            {halfRow('Nachmittag', day.halfDay.afternoon)}
          </ul>
        )}

        {showPreview && <DayTimetablePreview classIds={classIds} date={day.date} />}

        <ul className="bzz-rows">
          {linkIds.map((id) => {
            const name = classNameOf(id);
            return (
              <li key={id}>
                <a
                  href={untisWeekHref(monday, id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bzz-row"
                >
                  <span className="min-w-0">
                    <span className="block">
                      {name ? `Stundenplan ${name}` : 'Stundenplan'} in WebUntis öffnen
                    </span>
                    <span className="bzz-muted block font-normal">
                      Woche vom {formatWeekStart(monday)}
                    </span>
                    <span className="bzz-sr-only">(öffnet in neuem Tab)</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </DialogShell>
  );
}
