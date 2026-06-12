'use client';

import { memo, useMemo } from 'react';
import { buildDayTooltip, halfStatusLabel } from '@/src/lib/calendar';
import { buildMonthGroups, DOW_LABELS } from '@/src/lib/calendar-layout';
import { DAY_STYLES, PARTIAL_CANCEL_STYLE, HALF_DAY_COLORS } from '@/src/lib/calendar-styles';
import { PeriodDivider, buildDividerMap } from '@/components/PeriodDivider';
import type { CalendarDay, DayHalf, SchoolPeriod } from '@/src/types';

function untisWeekHref(monday: string, classId: number): string {
  return `https://bzz.webuntis.com/WebUntis?school=bzz#/basic/timetablePublic/class?date=${monday}&entityId=${classId}`;
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: CalendarDay | null;
  /** Monday of this cell's week — used to build links to any class's week view. */
  monday: string;
  /** Selected class — link target for days/halves that have no class of their own. */
  fallbackClassId: number;
  classNamesById?: Map<number, string>;
  detailsMode?: boolean;
}

const DayCell = memo(function DayCell({ day, monday, fallbackClassId, classNamesById, detailsMode }: DayCellProps) {
  if (!day) {
    return <div className="h-9 w-full rounded-lg bg-white" />;
  }

  const dayNum = day.date.slice(8); // last 2 chars = day number
  const hrefFor = (id?: number) => untisWeekHref(monday, id ?? fallbackClassId);
  const classNameOf = (id?: number) => (id != null ? classNamesById?.get(id) : undefined);

  // Split day: two side-by-side links (Vormittag | Nachmittag), each to its own class.
  if (day.halfDay) {
    const { morning, afternoon } = day.halfDay;
    // An empty half ('none') looks like a non-school day — no tooltip (kein "frei").
    const halfTip = (period: string, h: DayHalf): string | undefined => {
      if (h.status === 'none') return undefined;
      const cls = classNameOf(h.classId);
      const reason = h.reason ? ` (${h.reason})` : '';
      return `${cls ? `${cls} · ` : ''}${period}: ${halfStatusLabel(h.status)}${reason}`;
    };
    // A 'none' (empty) half has no class of its own → link it to the day's active class.
    const leftId = morning.classId ?? afternoon.classId;
    const rightId = afternoon.classId ?? morning.classId;
    const leftTip = halfTip('Vormittag', morning);
    const rightTip = halfTip('Nachmittag', afternoon);
    const bothCancelled = morning.status === 'cancelled' && afternoon.status === 'cancelled';
    // Exactly one half cancelled → its reason sits centred on that half (full text in its tooltip).
    const onlyOneCancelled = (morning.status === 'cancelled') !== (afternoon.status === 'cancelled');
    // A fully-cancelled day (both halves orange) gets orange text + a combined reason under the number.
    const overlayText = bothCancelled ? DAY_STYLES.unterrichtsausfall.text : 'text-slate-700';
    const combinedReason = bothCancelled
      ? (morning.reason && afternoon.reason && morning.reason !== afternoon.reason
          ? `${morning.reason} / ${afternoon.reason}`
          : (morning.reason ?? afternoon.reason))
      : undefined;
    // Both halves are identical links apart from their data — render via one helper.
    const renderHalf = (h: DayHalf, id: number | undefined, tip: string | undefined) => (
      <a
        href={hrefFor(id)}
        target="_blank"
        rel="noopener noreferrer"
        title={tip}
        aria-label={tip}
        className="relative flex-1 transition-opacity hover:opacity-70 cursor-pointer"
        style={{ background: HALF_DAY_COLORS[h.status] }}
      >
        {onlyOneCancelled && h.reason && (
          <span className="absolute inset-0 flex items-center justify-center px-0.5 text-orange-800">
            <span className="text-[8px] font-medium leading-tight text-center w-full truncate">{h.reason}</span>
          </span>
        )}
      </a>
    );
    return (
      <div className="relative w-full rounded-lg overflow-hidden flex min-h-9 select-none">
        {renderHalf(morning, leftId, leftTip)}
        <span className="w-px shrink-0 bg-slate-400/60" aria-hidden="true" />
        {renderHalf(afternoon, rightId, rightTip)}
        <span className={`absolute inset-0 flex flex-col items-center justify-center px-0.5 pointer-events-none ${overlayText}`}>
          <span className="text-xs font-medium leading-none">{dayNum}</span>
          {combinedReason && (
            <span className="mt-0.5 text-[8px] font-normal leading-tight text-center w-full truncate">
              {combinedReason}
            </span>
          )}
        </span>
      </div>
    );
  }

  const isPartialCancel = detailsMode && day.type === 'normal' && (day.cancelledCount ?? 0) > 0;
  const style = isPartialCancel ? PARTIAL_CANCEL_STYLE : DAY_STYLES[day.type];

  const baseClass = `
    w-full rounded-lg flex flex-col items-center justify-center
    min-h-9 px-0.5 py-1
    text-xs font-medium select-none transition-opacity hover:opacity-70
    ${style.cell} ${style.text}
  `;

  if (day.type === 'out-of-year') {
    return <div className={baseClass} />;
  }

  const tooltip = [classNameOf(day.linkClassId), buildDayTooltip(day)].filter(Boolean).join(' · ') || undefined;

  return (
    <a
      href={hrefFor(day.linkClassId)}
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
  /** Selected class — the link fallback and the KW week-link target. */
  classId: number;
  /** id → class name, for naming the link target in day tooltips. */
  classNamesById?: Map<number, string>;
  detailsMode?: boolean;
  periods?: SchoolPeriod[];
  showQuarterDividers?: boolean;
}

export default function SchoolYearCalendar({ days, schoolYearName, classId, classNamesById, detailsMode, periods, showQuarterDividers = false }: SchoolYearCalendarProps) {
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
                          monday={week.monday}
                          fallbackClassId={classId}
                          classNamesById={classNamesById}
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
