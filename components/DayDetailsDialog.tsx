'use client';

import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import DialogShell from '@/components/DialogShell';
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
  const affected = day.affectedClasses ?? [];
  const subtitle =
    (affected.length === 1 ? '1 Klasse betroffen' : `${affected.length} Klassen betroffen`) +
    (day.holidayName ? ` — ${day.holidayName}` : '');

  return (
    <DialogShell
      title={formatDateLong(day.date)}
      subtitle={subtitle}
      onClose={onClose}
      capitalizeTitle
    >
      {affected.length === 0 ? (
        <p className="bzz-muted m-0">Keine Details verfügbar.</p>
      ) : (
        <ul className="bzz-rows">
          {affected.map((c) => {
            const cancelled = c.cancelledCount;
            const total = c.lessonCount + c.cancelledCount;
            const detail =
              total > 0 ? `${cancelled} von ${total} Lektionen abgesagt` : 'Kein Unterricht';
            return (
              <li key={c.classId}>
                <a
                  href={classHref(c.className, schoolYearShort)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bzz-row"
                >
                  <span className="min-w-0">
                    <span className="block">{c.className}</span>
                    <span className="bzz-muted block font-normal">{detail}</span>
                    <span className="bzz-sr-only">(öffnet in neuem Tab)</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </DialogShell>
  );
}
