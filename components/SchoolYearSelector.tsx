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
    <div>
      <label htmlFor="schoolyear-select" className="bzz-field-label">
        Schuljahr
      </label>
      <select
        id="schoolyear-select"
        value={selectedId ?? ''}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="bzz-field w-auto min-w-36 font-bold"
      >
        {schoolYears.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name}
          </option>
        ))}
      </select>
    </div>
  );
}
