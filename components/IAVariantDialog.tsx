'use client';

import { GraduationCap, BookOpen, type LucideIcon } from 'lucide-react';
import DialogShell from '@/components/DialogShell';
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
      companion: bm,
    },
    {
      key: 'abu',
      label: 'Mit ABU',
      description: 'Allgemeinbildung',
      icon: BookOpen,
      companion: abu,
    },
  ];

  return (
    <DialogShell title={iaClass.name} subtitle="Welche Variante besuchen Sie?" onClose={onCancel}>
      <div className="bzz-rows">
        {variants.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => v.companion && onPick(v.companion)}
              disabled={!v.companion}
              className="bzz-row w-full cursor-pointer justify-start text-left transition-colors hover:bg-bzz-softblau hover:text-bzz-blau-text disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-bzz-grau disabled:hover:text-bzz-ink"
            >
              <Icon className="h-6 w-6 shrink-0 text-bzz-blau-text" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-bold">{v.label}</span>
                <span className="bzz-muted block">
                  {v.companion
                    ? `${v.description} — mit ${v.companion.name}`
                    : `${v.description} — nicht verfügbar`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </DialogShell>
  );
}
