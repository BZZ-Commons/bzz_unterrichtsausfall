'use client';

import { User, Users } from 'lucide-react';

export type ViewMode = 'single' | 'all';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

const OPTIONS: Array<{ value: ViewMode; label: string; Icon: typeof User }> = [
  { value: 'single', label: 'Einzelne Klasse', Icon: User },
  { value: 'all', label: 'Alle Klassen', Icon: Users },
];

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Ansicht wählen"
      className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      {OPTIONS.map(({ value: v, label, Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
