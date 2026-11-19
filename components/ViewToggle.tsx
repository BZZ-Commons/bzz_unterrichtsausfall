'use client';

import { User, Users } from 'lucide-react';

export type ViewMode = 'single' | 'all';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

const LABEL_ID = 'view-toggle-label';

const OPTIONS: Array<{ value: ViewMode; label: string; Icon: typeof User }> = [
  { value: 'single', label: 'Einzelne Klasse', Icon: User },
  { value: 'all', label: 'Alle Klassen', Icon: Users },
];

/** BZZ segment (button group); the chosen view carries aria-pressed. */
export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div>
      <span id={LABEL_ID} className="bzz-field-label">
        Ansicht
      </span>
      <div role="group" aria-labelledby={LABEL_ID} className="bzz-segment">
        {OPTIONS.map(({ value: v, label, Icon }) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === value}
            onClick={() => onChange(v)}
            className="bzz-btn px-4"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
