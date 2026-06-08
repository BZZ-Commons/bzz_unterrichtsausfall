'use client';

interface DetailsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function DetailsToggle({ checked, onChange }: DetailsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`}
        />
      </span>
      <span>Details</span>
    </button>
  );
}
