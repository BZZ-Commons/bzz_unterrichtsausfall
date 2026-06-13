'use client';

import { useEffect, useRef } from 'react';
import { X, Tag } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { CHANGELOG, APP_VERSION } from '@/src/lib/version';

interface VersionDialogProps {
  onClose: () => void;
}

function formatDate(iso: string): string {
  return format(parseISO(iso), 'd. MMMM yyyy', { locale: de });
}

/** Modal listing the changelog (newest first). Opened from the footer version. */
export default function VersionDialog({ onClose }: VersionDialogProps) {
  // Latest-onClose ref so the key listener attaches once for the dialog's lifetime.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-dialog-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h2 id="version-dialog-title" className="text-lg font-semibold text-slate-900">
              Versionsverlauf
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Aktuelle Version {APP_VERSION}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            aria-label="Schliessen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ol className="overflow-y-auto -mx-2 px-2 space-y-5">
          {CHANGELOG.map((entry) => (
            <li key={entry.version}>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden="true" />
                <span className="text-sm font-semibold text-slate-900">
                  Version {entry.version}
                </span>
                <span className="text-xs text-slate-400">{formatDate(entry.date)}</span>
              </div>
              <ul className="mt-1.5 ml-6 list-disc space-y-1 text-sm text-slate-600 marker:text-slate-300">
                {entry.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
