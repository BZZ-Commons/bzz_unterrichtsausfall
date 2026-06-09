import type { AggregatedDayType, DayType } from '@/src/types';

interface DayStyle {
  cell: string;
  text: string;
}

export const PARTIAL_CANCEL_STYLE: DayStyle = {
  cell: 'bg-pink-200',
  text: 'text-pink-800',
};

export const DAY_STYLES: Record<DayType, DayStyle> = {
  normal:         { cell: 'bg-emerald-100', text: 'text-emerald-800' },
  unterrichtsausfall:   { cell: 'bg-orange-200',  text: 'text-orange-800' },
  veranstaltung:  { cell: 'bg-emerald-200',  text: 'text-emerald-800' },
  'no-lessons':   { cell: 'bg-slate-50',    text: 'text-slate-300' },
  ferien:         { cell: 'bg-violet-200',  text: 'text-violet-800' },
  weekend:        { cell: 'bg-slate-50',    text: 'text-slate-300' },
  'out-of-year':  { cell: 'bg-white',       text: 'text-transparent' },
};

export const AGGREGATED_DAY_STYLES: Record<AggregatedDayType, DayStyle> = {
  normal:        { cell: 'bg-emerald-100', text: 'text-emerald-800' },
  irregular:     { cell: 'bg-orange-200',  text: 'text-orange-800' },
  ferien:        { cell: 'bg-violet-200',  text: 'text-violet-800' },
  weekend:       { cell: 'bg-slate-50',    text: 'text-slate-300' },
  'no-school':   { cell: 'bg-slate-50',    text: 'text-slate-300' },
  'out-of-year': { cell: 'bg-white',       text: 'text-transparent' },
};
