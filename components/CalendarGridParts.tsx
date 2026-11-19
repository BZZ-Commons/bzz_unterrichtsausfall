import { DOW_LABELS } from '@/src/lib/calendar-layout';

/** Shared grid template: KW column + 7 day columns. */
export const WEEK_ROW_CLASS = 'grid grid-cols-[3rem_1fr] items-center gap-2';
export const DAYS_GRID_CLASS = 'grid grid-cols-7 gap-1';

/**
 * Week number + weekday header — shown once above the months, sticky.
 * From `lg` up it stacks below the sticky card header via `--sticky-stack-top`
 * (set by the page); below `lg` the card header scrolls away, so it sticks at 0.
 */
export function WeekdayHeader() {
  return (
    <div className="sticky top-0 z-10 bg-bzz-weiss py-2 lg:top-[var(--sticky-stack-top,0px)]">
      <div className={WEEK_ROW_CLASS}>
        <div className="pr-1 text-right text-xs font-bold text-bzz-muted">KW</div>
        <div className={DAYS_GRID_CLASS}>
          {DOW_LABELS.map((d) => (
            <div key={d} className="text-center text-xs font-bold text-bzz-muted">
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MonthHeading({ label }: { label: string }) {
  return <h3 className="mt-0 mb-2 text-lg leading-tight">{label}</h3>;
}

export function EmptyCalendar() {
  return <p className="bzz-muted py-12 text-center">Keine Kalenderdaten verfügbar.</p>;
}

export function SchoolYearFootnote({ name }: { name: string }) {
  return <p className="bzz-muted mb-0 pt-2 text-center">Schuljahr {name}</p>;
}
