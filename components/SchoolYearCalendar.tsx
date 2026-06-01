'use client';

import { memo, useMemo } from 'react';
import { buildDayTooltip } from '@/src/lib/calendar';
import { buildMonthGroups, DOW_LABELS } from '@/src/lib/calendar-layout';
import { DAY_STYLES } from '@/src/lib/calendar-styles';
import type { CalendarDay } from '@/src/types';

function untisWeekHref(monday: string, classId: number): string {
  return `https://bzz.webuntis.com/WebUntis?school=bzz#/basic/timetablePublic/class?date=${monday}&entityId=${classId}`;
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
          {day.holidayName ?? day.eventName ?? 'kein Unterricht'}
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
