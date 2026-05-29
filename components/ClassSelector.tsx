'use client';

import type { UntisClass } from '@/src/types';

interface ClassSelectorProps {
  classes: UntisClass[];
  selectedId: number | null;
  onChange: (id: number) => void;
  loading?: boolean;
}

export default function ClassSelector({
  classes,
  selectedId,
  onChange,
  loading = false,
}: ClassSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <label
        htmlFor="class-select"
        className="text-sm font-medium text-slate-700 shrink-0"
      >
        Klasse auswählen
      </label>
      <select
        id="class-select"
        value={selectedId ?? ''}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        disabled={loading || classes.length === 0}
        className="w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm
                   focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200
                   disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        <option value="" disabled>
          {loading ? 'Lade Klassen …' : '— Klasse wählen —'}
        </option>
        {classes.map((c) => {
          const companions = c.companionNames?.length
            ? ` (+${c.companionNames.join(', ')})`
            : '';
          return (
            <option key={c.id} value={c.id}>
              {c.name}{companions}
            </option>
          );
        })}
      </select>
    </div>
  );
}
