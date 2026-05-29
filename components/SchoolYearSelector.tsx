'use client';

import type { SchoolYearSummary } from '@/src/types';

interface SchoolYearSelectorProps {
  schoolYears: SchoolYearSummary[];
  selectedId: number | null;
  onChange: (id: number) => void;
}

export default function SchoolYearSelector({
  schoolYears,
  selectedId,
  onChange,
}: SchoolYearSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="schoolyear-select" className="text-sm font-medium text-slate-700 shrink-0">
        Schuljahr
      </label>
      <select
        id="schoolyear-select"
        value={selectedId ?? ''}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm
                   focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-colors"
      >
        {schoolYears.map((y) => (
          <option key={y.id} value={y.id}>{y.name}</option>
        ))}
      </select>
    </div>
  );
}
