'use client';

import { useState } from 'react';
import VersionDialog from '@/components/VersionDialog';
import { APP_VERSION } from '@/src/lib/version';

/** Footer version label — click to open the changelog. */
export default function VersionBadge() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Versionsverlauf anzeigen"
        className="tabular-nums hover:text-indigo-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 rounded"
      >
        v{APP_VERSION}
      </button>
      {open && <VersionDialog onClose={() => setOpen(false)} />}
    </>
  );
}
