'use client';

import { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { buildDayTooltip, halfStatusLabel } from '@/src/lib/calendar';
import { untisWeekHref } from '@/src/lib/untisLinks';
import { HALF_DAY_COLORS } from '@/src/lib/calendar-styles';
import type { CalendarDay, DayHalf, DayType } from '@/src/types';

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
  classNamesById,
  onClose,
}: SingleDayDialogProps) {
  // Latest-onClose ref so the key listener attaches once for the dialog's lifetime.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const halfRow = (period: string, h: DayHalf) => (
    <li className="flex items-baseline gap-2.5 text-sm">
      <span
        className="inline-block w-3.5 h-3.5 rounded shrink-0 self-center border border-slate-200"
        style={{ background: HALF_DAY_COLORS[h.status] }}
        aria-hidden="true"
      />
      <span className="w-24 shrink-0 text-slate-500">{period}</span>
      <span className="text-slate-900 min-w-0">
        {halfStatusLabel(h.status)}
        {h.reason && <span className="text-slate-600"> ({h.reason})</span>}
        {classNameOf(h.classId) && (
          <span className="text-slate-400"> — {classNameOf(h.classId)}</span>
        )}
      </span>
    </li>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="single-day-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <h2 id="single-day-title" className="text-lg font-semibold text-slate-900 capitalize">
              {formatDateLong(day.date)}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {subtitle}
              {detail && !day.halfDay ? ` — ${detail}` : ''}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            aria-label="Schliessen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {day.halfDay && (
          <ul className="space-y-2 mb-4">
            {halfRow('Vormittag', day.halfDay.morning)}
            {halfRow('Nachmittag', day.halfDay.afternoon)}
          </ul>
        )}

        <ul className="space-y-1.5">
          {linkIds.map((id) => {
            const name = classNameOf(id);
            return (
              <li key={id}>
                <a
                  href={untisWeekHref(monday, id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {name ? `Stundenplan ${name}` : 'Stundenplan'} in WebUntis öffnen
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Woche vom {formatWeekStart(monday)}
                    </p>
                  </div>
                  <ExternalLink
                    className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0"
                    aria-hidden="true"
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
