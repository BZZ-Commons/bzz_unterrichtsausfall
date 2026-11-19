import type { AggregatedDayType, DayType, HalfStatus } from '@/src/types';

interface DayStyle {
  cell: string;
  text: string;
}

/*
 * Day-cell colours come from the --cal-* tokens in src/index.css (derived from the
 * BZZ design system). Coloured cells keep dark text; free days fade to grey.
 */

const FREE_DAY_TEXT = 'text-bzz-line-stark';

export const PARTIAL_CANCEL_STYLE: DayStyle = {
  cell: 'bg-cal-teilausfall',
  text: 'text-bzz-ink-2',
};

/**
 * Fill colours for one half of a split day cell — same tokens as DAY_STYLES
 * ('none' looks like a non-school day). Used as inline backgrounds because the
 * two halves are independent, side-by-side elements.
 */
export const HALF_DAY_COLORS: Record<HalfStatus, string> = {
  lessons: 'var(--cal-unterricht)',
  cancelled: 'var(--cal-ausfall)',
  none: 'var(--cal-frei)',
};

/** CSS gradient for a split-day swatch (left | right halves) — used for the legend. */
export function halfDayBackground(left: HalfStatus, right: HalfStatus): string {
  return `linear-gradient(to right, ${HALF_DAY_COLORS[left]} 0 50%, ${HALF_DAY_COLORS[right]} 50% 100%)`;
}

export const DAY_STYLES: Record<DayType, DayStyle> = {
  normal: { cell: 'bg-cal-unterricht', text: 'text-bzz-ink-2' },
  unterrichtsausfall: { cell: 'bg-cal-ausfall', text: 'text-bzz-ink' },
  veranstaltung: { cell: 'bg-cal-veranstaltung', text: 'text-bzz-ink-2' },
  'no-lessons': { cell: 'bg-cal-frei', text: FREE_DAY_TEXT },
  ferien: { cell: 'bg-cal-ferien', text: 'text-bzz-ink-2' },
  weekend: { cell: 'bg-cal-frei', text: FREE_DAY_TEXT },
  'out-of-year': { cell: 'bg-transparent', text: 'text-transparent' },
};

export const AGGREGATED_DAY_STYLES: Record<AggregatedDayType, DayStyle> = {
  normal: { cell: 'bg-cal-unterricht', text: 'text-bzz-ink-2' },
  irregular: { cell: 'bg-cal-ausfall', text: 'text-bzz-ink' },
  ferien: { cell: 'bg-cal-ferien', text: 'text-bzz-ink-2' },
  weekend: { cell: 'bg-cal-frei', text: FREE_DAY_TEXT },
  'no-school': { cell: 'bg-cal-frei', text: FREE_DAY_TEXT },
  'out-of-year': { cell: 'bg-transparent', text: 'text-transparent' },
};
