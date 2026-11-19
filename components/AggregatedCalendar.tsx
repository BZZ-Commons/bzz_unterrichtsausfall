'use client';

import { memo, useMemo } from 'react';
import { buildMonthGroups } from '@/src/lib/calendar-layout';
import { AGGREGATED_DAY_STYLES } from '@/src/lib/calendar-styles';
import { PeriodDivider, buildDividerMap } from '@/components/PeriodDivider';
import {
  DAYS_GRID_CLASS,
  EmptyCalendar,
  MonthHeading,
  SchoolYearFootnote,
  WEEK_ROW_CLASS,
  WeekdayHeader,
} from '@/components/CalendarGridParts';
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
    return <div className="h-9 w-full" />;
  }

  const style = AGGREGATED_DAY_STYLES[day.type];
  const dayNum = day.date.slice(8);
  const tooltip = buildTooltip(day);

  const baseClass = `
    w-full rounded-bzz flex flex-col items-center justify-center
    min-h-9 px-0.5 py-1
    text-xs font-semibold tabular-nums select-none transition-opacity
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
        className={`${baseClass} cursor-pointer hover:opacity-70`}
      >
        <span>{dayNum}</span>
        <span className="text-[9px] leading-tight font-normal">
          {count} {count === 1 ? 'Klasse' : 'Klassen'}
        </span>
      </button>
    );
  }

  return (
    <div className={baseClass} title={tooltip}>
      <span>{dayNum}</span>
      {day.holidayName && (
        <span className="w-full truncate text-center text-[9px] leading-tight font-normal">
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
    return <EmptyCalendar />;
  }

  return (
    <div className="space-y-8">
      <WeekdayHeader />

      {monthGroups.map((group) => (
        <section key={`${group.year}-${group.month}`}>
          <MonthHeading label={group.label} />

          <div className="space-y-1">
            {group.weeks.map((week) => {
              const divider = dividerMap.get(week.monday);
              return (
                <div key={week.isoWeek}>
                  {divider && (
                    <PeriodDivider quarter={divider.quarter} semester={divider.semester} />
                  )}
                  <div className={WEEK_ROW_CLASS}>
                    <div className="pr-1 text-right text-xs text-bzz-muted tabular-nums">
                      {week.isoWeek}
                    </div>
                    <div className={DAYS_GRID_CLASS}>
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

      <SchoolYearFootnote name={schoolYearName} />
    </div>
  );
}
