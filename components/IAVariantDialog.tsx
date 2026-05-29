'use client';

import { X, GraduationCap, BookOpen, type LucideIcon } from 'lucide-react';
import type { UntisClass } from '@/src/types';

interface IAVariantDialogProps {
  iaClass: UntisClass;
  bm: UntisClass | null;
  abu: UntisClass | null;
  onPick: (companion: UntisClass) => void;
  onCancel: () => void;
}

interface VariantConfig {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  hoverClass: string;
  companion: UntisClass | null;
}

export default function IAVariantDialog({
  iaClass,
  bm,
  abu,
  onPick,
  onCancel,
}: IAVariantDialogProps) {
  const variants: VariantConfig[] = [
    {
      key: 'bm',
      label: 'Mit BM',
      description: 'Berufsmaturität',
      icon: GraduationCap,
      iconBgClass: 'bg-indigo-100',
      iconColorClass: 'text-indigo-600',
      hoverClass: 'hover:border-indigo-300 hover:bg-indigo-50',
      companion: bm,
    },
    {
      key: 'abu',
      label: 'Mit ABU',
      description: 'Allgemeinbildung',
      icon: BookOpen,
      iconBgClass: 'bg-emerald-100',
      iconColorClass: 'text-emerald-600',
      hoverClass: 'hover:border-emerald-300 hover:bg-emerald-50',
      companion: abu,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{iaClass.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">Welche Variante besuchst du?</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Schliessen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {variants.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => v.companion && onPick(v.companion)}
                disabled={!v.companion}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 ${v.hoverClass} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-transparent transition-all text-left`}
              >
                <div className={`w-10 h-10 rounded-lg ${v.iconBgClass} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${v.iconColorClass}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{v.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {v.companion ? `${v.description} — mit ${v.companion.name}` : `${v.description} — nicht verfügbar`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
