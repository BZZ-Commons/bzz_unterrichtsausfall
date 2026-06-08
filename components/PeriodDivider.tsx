'use client';

import { parseISO, startOfISOWeek, format } from 'date-fns';
import type { SchoolPeriod } from '@/src/types';

export interface DividerInfo {
  quarter?: string;
  semester?: string;
}

export function buildDividerMap(periods: SchoolPeriod[]): Map<string, DividerInfo> {
  const map = new Map<string, DividerInfo>();
  for (const q of periods.filter((p) => p.type === 'quarter').slice(1)) {
    const monday = format(startOfISOWeek(parseISO(q.startDate)), 'yyyy-MM-dd');
    map.set(monday, { ...map.get(monday), quarter: q.name });
  }
  for (const s of periods.filter((p) => p.type === 'semester').slice(1)) {
    const monday = format(startOfISOWeek(parseISO(s.startDate)), 'yyyy-MM-dd');
    map.set(monday, { ...map.get(monday), semester: s.name });
  }
  return map;
}

export function PeriodDivider({ quarter, semester }: DividerInfo) {
  const label = semester ? `${quarter} · ${semester}` : quarter;
  if (semester) {
    return (
      <div className="flex items-center gap-2 py-2 my-1">
        <div className="flex-1 h-0.5 bg-violet-300" />
        <span className="text-xs font-bold text-violet-700 px-3 py-0.5 bg-violet-50 rounded-full border border-violet-300 whitespace-nowrap">
          {label}
        </span>
        <div className="flex-1 h-0.5 bg-violet-300" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 py-1 my-0.5">
      <div className="flex-1 h-px bg-indigo-200" />
      <span className="text-xs font-semibold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-full border border-indigo-200 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-indigo-200" />
    </div>
  );
}
