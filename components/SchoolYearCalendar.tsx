'use client';

import { memo, useMemo } from 'react';
import { format, parseISO, getISOWeek, getMonth, startOfISOWeek, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { buildDayTooltip } from '@/src/lib/calendar';
import type { CalendarDay, DayType } from '@/src/types';

// ─── Style map ────────────────────────────────────────────────────────────────

export const DAY_STYLES: Record<DayType, { cell: string; text: string }> = {
  normal:        { cell: 'bg-emerald-100', text: 'text-emerald-800' },
  schulausfall:  { cell: 'bg-orange-200',  text: 'text-orange-800' },
  'no-lessons':  { cell: 'bg-slate-50',    text: 'text-slate-300' },
  ferien:        { cell: 'bg-violet-200',  text: 'text-violet-800' },
  weekend:       { cell: 'bg-slate-50',    text: 'text-slate-300' },
  'out-of-year': { cell: 'bg-white',       text: 'text-transparent' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekRow {
  isoWeek: number;
  monday: string;                // 'YYYY-MM-DD' — used for the WebUntis link
  days: (CalendarDay | null)[]; // 7 slots: Mon(0)…Sun(6), null = outside school year
}

interface MonthGroup {
  month: number;       // 0-based
  year: number;
  label: string;       // e.g. "August 2025"
  weeks: WeekRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DOW_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function untisWeekHref(monday: string, classId: number): string {
  return `https://bzz.webuntis.com/WebUntis?school=bzz#/basic/timetablePublic/class?date=${monday}&entityId=${classId}`;
}

function buildMonthGroups(days: CalendarDay[]): MonthGroup[] {
  if (days.length === 0) return [];

  const dayMap = new Map<string, CalendarDay>();
  for (const d of days) dayMap.set(d.date, d);

  // Determine date range
  const first = parseISO(days[0].date);
  const last = parseISO(days[days.length - 1].date);

  // Build week rows from the Monday of the first week through the Sunday of the last week
  const weekStart = startOfISOWeek(first);
  const weekEnd = addDays(startOfISOWeek(last), 6);

  // Group weeks by the month that contains the majority (Thursday rule: use Thursday's month)
  const groups = new Map<string, MonthGroup>();
  const orderedKeys: string[] = [];

  let cursor = new Date(weekStart);
  while (cursor <= weekEnd) {
    const thursday = addDays(cursor, 3); // ISO week's Thursday determines the month
    const monthKey = format(thursday, 'yyyy-MM');

    if (!groups.has(monthKey)) {
      groups.set(monthKey, {
        month: getMonth(thursday),
        year: thursday.getFullYear(),
        label: format(thursday, 'MMMM yyyy', { locale: de }),
        weeks: [],
      });
      orderedKeys.push(monthKey);
    }

    const week: WeekRow = {
      isoWeek: getISOWeek(cursor),
      monday: format(cursor, 'yyyy-MM-dd'),
      days: Array(7).fill(null) as null[],
    };

    for (let i = 0; i < 7; i++) {
      const d = addDays(cursor, i);
      const iso = format(d, 'yyyy-MM-dd');
      week.days[i] = dayMap.get(iso) ?? null;
    }

    groups.get(monthKey)!.weeks.push(week);
    cursor = addDays(cursor, 7);
  }

  return orderedKeys.map((k) => groups.get(k)!);
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: CalendarDay | null;
  href: string;
}

const DayCell = memo(function DayCell({ day, href }: DayCellProps) {
  if (!day) {
    return <div className="h-9 w-full rounded-lg bg-white" />;
  }

  const style = DAY_STYLES[day.type];
  const dayNum = day.date.slice(8); // last 2 chars = day number

  const tooltip = buildDayTooltip(day);

  const baseClass = `
    w-full rounded-lg flex flex-col items-center justify-center
    min-h-9 px-0.5 py-1
    text-xs font-medium select-none transition-opacity hover:opacity-70
    ${style.cell} ${style.text}
  `;

  if (day.type === 'out-of-year') {
    return <div className={baseClass} />;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltip}
      className={`${baseClass} cursor-pointer`}
    >
      <span>{dayNum}</span>
      {(day.holidayName || day.type === 'schulausfall') && (
        <span className="text-[9px] font-normal leading-tight text-center w-full truncate">
          {day.holidayName ?? 'kein Unterricht'}
        </span>
      )}
    </a>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

interface SchoolYearCalendarProps {
  days: CalendarDay[];
  schoolYearName: string;
  classId: number;
}

export default function SchoolYearCalendar({ days, schoolYearName, classId }: SchoolYearCalendarProps) {
  const monthGroups = useMemo(() => buildMonthGroups(days), [days]);

  if (monthGroups.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-12">
        Keine Kalenderdaten verfügbar.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Week number + day-of-week header — shown once, sticky */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm py-2 border-b border-slate-100">
        <div className="grid grid-cols-[3rem_1fr] gap-2">
          <div className="text-xs text-slate-400 text-right pr-1 pt-1">KW</div>
          <div className="grid grid-cols-7 gap-1">
            {DOW_LABELS.map((d) => (
              <div key={d} className="text-xs font-medium text-slate-400 text-center">
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>

      {monthGroups.map((group) => (
        <section key={`${group.year}-${group.month}`}>
          {/* Month label */}
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
            {group.label}
          </h2>

          <div className="space-y-1">
            {group.weeks.map((week) => {
              const href = untisWeekHref(week.monday, classId);
              return (
                <div key={week.isoWeek} className="grid grid-cols-[3rem_1fr] gap-2 items-center">
                  {/* ISO week number — also links to that week */}
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 text-right pr-1 tabular-nums hover:text-indigo-500 transition-colors"
                  >
                    {week.isoWeek}
                  </a>
                  {/* 7 day cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {week.days.map((day, i) => (
                      <DayCell
                        key={day?.date ?? `empty-${week.isoWeek}-${i}`}
                        day={day}
                        href={href}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-xs text-slate-400 text-center pt-2">
        Schuljahr {schoolYearName}
      </p>
    </div>
  );
}
