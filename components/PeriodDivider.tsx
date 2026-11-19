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
  const label = semester ? (quarter ? `${quarter} · ${semester}` : semester) : quarter;
  // Semester boundaries stand out (blue line + blue tag); quarters stay quiet.
  const s = semester
    ? { wrap: 'py-2 my-1', line: 'h-0.5 bg-bzz-blau', tag: 'bzz-tag bzz-tag--blau' }
    : { wrap: 'py-1 my-0.5', line: 'h-px bg-bzz-line', tag: 'bzz-tag bzz-tag--plain' };
  return (
    <div className={`flex items-center gap-2 ${s.wrap}`}>
      <div className={`flex-1 ${s.line}`} />
      <span className={s.tag}>{label}</span>
      <div className={`flex-1 ${s.line}`} />
    </div>
  );
}
