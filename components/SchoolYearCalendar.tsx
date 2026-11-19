'use client';

import { memo, useMemo } from 'react';
import { buildDayTooltip, halfStatusLabel } from '@/src/lib/calendar';
import { buildMonthGroups } from '@/src/lib/calendar-layout';
import { untisWeekHref } from '@/src/lib/untisLinks';
import { DAY_STYLES, PARTIAL_CANCEL_STYLE, HALF_DAY_COLORS } from '@/src/lib/calendar-styles';
import { PeriodDivider, buildDividerMap } from '@/components/PeriodDivider';
import {
  DAYS_GRID_CLASS,
  EmptyCalendar,
  MonthHeading,
  SchoolYearFootnote,
  WEEK_ROW_CLASS,
  WeekdayHeader,
} from '@/components/CalendarGridParts';
import type { CalendarDay, DayHalf, SchoolPeriod } from '@/src/types';

// ─── Day cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: CalendarDay | null;
  /** Monday of this cell's week — passed along to the day-details dialog. */
  monday: string;
  classNamesById?: Map<number, string>;
  detailsMode?: boolean;
  /** Opens the day-details dialog (status, reason, WebUntis links). */
  onSelect?: (day: CalendarDay, monday: string) => void;
}

const DayCell = memo(function DayCell({
  day,
  monday,
  classNamesById,
  detailsMode,
  onSelect,
}: DayCellProps) {
  if (!day) {
    return <div className="h-9 w-full" />;
  }

  const dayNum = day.date.slice(8); // last 2 chars = day number
  const classNameOf = (id?: number) => (id != null ? classNamesById?.get(id) : undefined);
  const select = () => onSelect?.(day, monday);

  // Split day: two side-by-side halves (Vormittag | Nachmittag) — one button,
  // details (incl. per-class WebUntis links) live in the dialog.
  if (day.halfDay) {
    const { morning, afternoon } = day.halfDay;
    // An empty half ('none') looks like a non-school day — no tooltip (kein "frei").
    const halfTip = (period: string, h: DayHalf): string | undefined => {
      if (h.status === 'none') return undefined;
      const cls = classNameOf(h.classId);
      const reason = h.reason ? ` (${h.reason})` : '';
      return `${cls ? `${cls} · ` : ''}${period}: ${halfStatusLabel(h.status)}${reason}`;
    };
    const cellTip =
      [halfTip('Vormittag', morning), halfTip('Nachmittag', afternoon)]
        .filter(Boolean)
        .join('\n') || undefined;
    const bothCancelled = morning.status === 'cancelled' && afternoon.status === 'cancelled';
    // Exactly one half cancelled → its reason sits centred on that half (full text in the dialog).
    const onlyOneCancelled =
      (morning.status === 'cancelled') !== (afternoon.status === 'cancelled');
    // A fully-cancelled day (both halves cancelled) gets the cancellation text colour + a combined reason under the number.
    const overlayText = bothCancelled ? DAY_STYLES.unterrichtsausfall.text : 'text-bzz-ink-2';
    const combinedReason = bothCancelled
      ? morning.reason && afternoon.reason && morning.reason !== afternoon.reason
        ? `${morning.reason} / ${afternoon.reason}`
        : (morning.reason ?? afternoon.reason)
      : undefined;
    const renderHalf = (h: DayHalf) => (
      <span className="relative flex-1" style={{ background: HALF_DAY_COLORS[h.status] }}>
        {onlyOneCancelled && h.reason && (
          <span className="absolute inset-0 flex items-center justify-center px-0.5 text-bzz-ink">
            <span className="w-full truncate text-center text-[8px] leading-tight font-medium">
              {h.reason}
            </span>
          </span>
        )}
      </span>
    );
    return (
      <button
        type="button"
        onClick={select}
        title={cellTip}
        aria-label={cellTip}
        className="relative flex min-h-9 w-full cursor-pointer overflow-hidden rounded-bzz select-none transition-opacity hover:opacity-70"
      >
        {renderHalf(morning)}
        <span className="w-px shrink-0 bg-bzz-weiss" aria-hidden="true" />
        {renderHalf(afternoon)}
        <span
          className={`absolute inset-0 flex flex-col items-center justify-center px-0.5 pointer-events-none ${overlayText}`}
        >
          <span className="text-xs leading-none font-semibold tabular-nums">{dayNum}</span>
          {combinedReason && (
            <span className="mt-0.5 w-full truncate text-center text-[8px] leading-tight font-normal">
              {combinedReason}
            </span>
          )}
        </span>
      </button>
    );
  }

  const isPartialCancel = detailsMode && day.type === 'normal' && (day.cancelledCount ?? 0) > 0;
  const style = isPartialCancel ? PARTIAL_CANCEL_STYLE : DAY_STYLES[day.type];

  const baseClass = `
    w-full rounded-bzz flex flex-col items-center justify-center
    min-h-9 px-0.5 py-1
    text-xs font-semibold tabular-nums select-none transition-opacity hover:opacity-70
    ${style.cell} ${style.text}
  `;

  if (day.type === 'out-of-year') {
    return <div className={baseClass} />;
  }

  const tooltip =
    [classNameOf(day.linkClassId), buildDayTooltip(day)].filter(Boolean).join(' · ') || undefined;

  return (
    <button
      type="button"
      onClick={select}
      title={tooltip}
      className={`${baseClass} cursor-pointer`}
    >
      <span>{dayNum}</span>
      {(day.holidayName || day.type === 'unterrichtsausfall' || day.type === 'veranstaltung') && (
        <span className="w-full truncate text-center text-[9px] leading-tight font-normal">
          {day.holidayName ?? day.eventName ?? 'kein Unterricht'}
        </span>
      )}
    </button>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

interface SchoolYearCalendarProps {
  days: CalendarDay[];
  schoolYearName: string;
  /** Selected class — the KW week-link target. */
  classId: number;
  /** id → class name, for naming the link target in day tooltips. */
  classNamesById?: Map<number, string>;
  detailsMode?: boolean;
  periods?: SchoolPeriod[];
  showQuarterDividers?: boolean;
  /** Called when a day cell is clicked/tapped — opens the day-details dialog. */
  onDaySelect?: (day: CalendarDay, monday: string) => void;
}

export default function SchoolYearCalendar({
  days,
  schoolYearName,
  classId,
  classNamesById,
  detailsMode,
  periods,
  showQuarterDividers = false,
  onDaySelect,
}: SchoolYearCalendarProps) {
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
                  <div className={WEEK_ROW_CLASS}>
                    {/* ISO week number — also links to that week */}
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pr-1 text-right text-xs text-bzz-muted tabular-nums no-underline transition-colors hover:text-bzz-blau-text hover:underline"
                    >
                      {week.isoWeek}
                    </a>
                    {/* 7 day cells */}
                    <div className={DAYS_GRID_CLASS}>
                      {week.days.map((day, i) => (
                        <DayCell
                          key={day?.date ?? `empty-${week.isoWeek}-${i}`}
                          day={day}
                          monday={week.monday}
                          classNamesById={classNamesById}
                          detailsMode={detailsMode}
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
