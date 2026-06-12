'use client';

import { memo, useMemo } from 'react';
import { buildMonthGroups, DOW_LABELS } from '@/src/lib/calendar-layout';
import { AGGREGATED_DAY_STYLES } from '@/src/lib/calendar-styles';
import { PeriodDivider, buildDividerMap } from '@/components/PeriodDivider';
import type { AggregatedDay, SchoolPeriod } from '@/src/types';

function buildTooltip(day: AggregatedDay): string | undefined {
  if (day.holidayName) return day.holidayName;
  if (day.type === 'irregular') {
    const n = day.affectedClasses?.length ?? 0;
    const noun = n === 1 ? 'Klasse betroffen' : 'Klassen betroffen';
    return `${n} ${noun} — Klick für Details`;
  }
  return undefined;
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: AggregatedDay | null;
  onSelect?: (day: AggregatedDay) => void;
}

const DayCell = memo(function DayCell({ day, onSelect }: DayCellProps) {
  if (!day) {
    return <div className="h-9 w-full rounded-lg bg-white" />;
  }

  const style = AGGREGATED_DAY_STYLES[day.type];
  const dayNum = day.date.slice(8);
  const tooltip = buildTooltip(day);

  const baseClass = `
    w-full rounded-lg flex flex-col items-center justify-center
    min-h-9 px-0.5 py-1
    text-xs font-medium select-none transition-opacity
    ${style.cell} ${style.text}
  `;

  if (day.type === 'out-of-year') {
    return <div className={baseClass} />;
  }

  if (day.type === 'irregular') {
    const count = day.affectedClasses?.length ?? 0;
    return (
      <button
        type="button"
        onClick={() => onSelect?.(day)}
        title={tooltip}
        className={`${baseClass} cursor-pointer hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400`}
      >
        <span>{dayNum}</span>
        <span className="text-[9px] font-normal leading-tight">
          {count} {count === 1 ? 'Klasse' : 'Klassen'}
        </span>
      </button>
    );
  }

  return (
    <div className={baseClass} title={tooltip}>
      <span>{dayNum}</span>
      {day.holidayName && (
        <span className="text-[9px] font-normal leading-tight text-center w-full truncate">
          {day.holidayName}
        </span>
      )}
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

interface AggregatedCalendarProps {
  days: AggregatedDay[];
  schoolYearName: string;
  onDaySelect: (day: AggregatedDay) => void;
  periods?: SchoolPeriod[];
}

export default function AggregatedCalendar({
  days,
  schoolYearName,
  onDaySelect,
  periods,
}: AggregatedCalendarProps) {
  const monthGroups = useMemo(() => buildMonthGroups(days), [days]);
  const dividerMap = useMemo(
    () => (periods?.length ? buildDividerMap(periods) : new Map()),
    [periods],
  );

  if (monthGroups.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-12">Keine Kalenderdaten verfügbar.</p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sticky weekday header — `--sticky-stack-top` (set by the page) offsets
          it below the sticky card header so the two don't overlap. */}
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
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">
            {group.label}
          </h2>

          <div className="space-y-1">
            {group.weeks.map((week) => {
              const divider = dividerMap.get(week.monday);
              return (
                <div key={week.isoWeek}>
                  {divider && (
                    <PeriodDivider quarter={divider.quarter} semester={divider.semester} />
                  )}
                  <div className="grid grid-cols-[3rem_1fr] gap-2 items-center">
                    <div className="text-xs text-slate-400 text-right pr-1 tabular-nums">
                      {week.isoWeek}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {week.days.map((day, i) => (
                        <DayCell
                          key={day?.date ?? `empty-${week.isoWeek}-${i}`}
                          day={day}
                          onSelect={onDaySelect}
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

      <p className="text-xs text-slate-400 text-center pt-2">Schuljahr {schoolYearName}</p>
    </div>
  );
}
