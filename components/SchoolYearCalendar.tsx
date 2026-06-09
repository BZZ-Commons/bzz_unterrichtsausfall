'use client';

import { memo, useMemo } from 'react';
import { buildDayTooltip } from '@/src/lib/calendar';
import { buildMonthGroups, DOW_LABELS } from '@/src/lib/calendar-layout';
import { DAY_STYLES, PARTIAL_CANCEL_STYLE } from '@/src/lib/calendar-styles';
import { PeriodDivider, buildDividerMap } from '@/components/PeriodDivider';
import type { CalendarDay, SchoolPeriod } from '@/src/types';

function untisWeekHref(monday: string, classId: number): string {
  return `https://bzz.webuntis.com/WebUntis?school=bzz#/basic/timetablePublic/class?date=${monday}&entityId=${classId}`;
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: CalendarDay | null;
  href: string;
  detailsMode?: boolean;
}

const DayCell = memo(function DayCell({ day, href, detailsMode }: DayCellProps) {
  if (!day) {
    return <div className="h-9 w-full rounded-lg bg-white" />;
  }

  const isPartialCancel = detailsMode && day.type === 'normal' && (day.cancelledCount ?? 0) > 0;
  const style = isPartialCancel ? PARTIAL_CANCEL_STYLE : DAY_STYLES[day.type];
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
      {(day.holidayName || day.type === 'unterrichtsausfall' || day.type === 'veranstaltung') && (
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
  detailsMode?: boolean;
  periods?: SchoolPeriod[];
  showQuarterDividers?: boolean;
}

export default function SchoolYearCalendar({ days, schoolYearName, classId, detailsMode, periods, showQuarterDividers = false }: SchoolYearCalendarProps) {
  const monthGroups = useMemo(() => buildMonthGroups(days), [days]);
  const dividerMap = useMemo(
    () => (periods?.length ? buildDividerMap(periods) : new Map()),
    [periods],
  );

  if (monthGroups.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-12">
        Keine Kalenderdaten verfügbar.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Week number + day-of-week header — shown once, sticky.
          `--sticky-stack-top` is set by the page so this stacks below the
          sticky card header (title + legend) instead of overlapping it. */}
      <div
        className="sticky z-10 bg-white/90 backdrop-blur-sm py-2 border-b border-slate-100"
        style={{ top: 'var(--sticky-stack-top, 0px)' }}
      >
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
              const divider = dividerMap.get(week.monday);
              return (
                <div key={week.isoWeek}>
                  {divider && (showQuarterDividers || divider.semester) && (
                    <PeriodDivider
                      quarter={showQuarterDividers ? divider.quarter : undefined}
                      semester={divider.semester}
                    />
                  )}
                  <div className="grid grid-cols-[3rem_1fr] gap-2 items-center">
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
                          detailsMode={detailsMode}
                        />
                      ))}
                    </div>
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
