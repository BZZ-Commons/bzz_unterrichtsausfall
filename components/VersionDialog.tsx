'use client';

import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import DialogShell from '@/components/DialogShell';
import { CHANGELOG, APP_VERSION } from '@/src/lib/version';

interface VersionDialogProps {
  onClose: () => void;
}

function formatDate(iso: string): string {
  return format(parseISO(iso), 'd. MMMM yyyy', { locale: de });
}

/** Modal listing the changelog (newest first). Opened from the footer version. */
export default function VersionDialog({ onClose }: VersionDialogProps) {
  return (
    <DialogShell
      title="Versionsverlauf"
      subtitle={`Aktuelle Version ${APP_VERSION}`}
      onClose={onClose}
      widthClass="max-w-lg"
    >
      <ol className="m-0 list-none space-y-6 p-0">
        {CHANGELOG.map((entry) => (
          <li key={entry.version}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold">Version {entry.version}</span>
              <span className="bzz-tag bzz-tag--plain">{formatDate(entry.date)}</span>
            </div>
            <ul className="mt-2 mb-0 space-y-1 pl-5 text-[15px] leading-normal text-bzz-ink-2">
              {entry.changes.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </DialogShell>
  );
}
