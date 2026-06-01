'use client';

import { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { AggregatedDay } from '@/src/types';

interface DayDetailsDialogProps {
  day: AggregatedDay;
  /** 2-digit short form of the school year start, e.g. '25' for 2025/26. */
  schoolYearShort: string;
  onClose: () => void;
}

function formatDateLong(iso: string): string {
  return format(parseISO(iso), 'EEEE, d. MMMM yyyy', { locale: de });
}

function classHref(className: string, schoolYearShort: string): string {
  const params = new URLSearchParams({
    class: className,
    schoolyear: schoolYearShort,
  });
  return `/?${params.toString()}`;
}

export default function DayDetailsDialog({ day, schoolYearShort, onClose }: DayDetailsDialogProps) {
  // Hold a ref to the latest onClose so the listener attaches once for the
  // dialog's lifetime instead of churning on every parent re-render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const affected = day.affectedClasses ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-details-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h2 id="day-details-title" className="text-lg font-semibold text-slate-900 capitalize">
              {formatDateLong(day.date)}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {affected.length === 1
                ? '1 Klasse betroffen'
                : `${affected.length} Klassen betroffen`}
              {day.holidayName ? ` — ${day.holidayName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            aria-label="Schliessen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto -mx-2 px-2">
          {affected.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Keine Details verfügbar.</p>
          ) : (
            <ul className="space-y-1.5">
              {affected.map((c) => {
                const cancelled = c.cancelledCount;
                const total = c.lessonCount + c.cancelledCount;
                const detail =
                  total > 0
                    ? `${cancelled} von ${total} Lektionen abgesagt`
                    : 'Kein Unterricht';
                return (
                  <li key={c.classId}>
                    <a
                      href={classHref(c.className, schoolYearShort)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{c.className}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
                      </div>
                      <ExternalLink
                        className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
