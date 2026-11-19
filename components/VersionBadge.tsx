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
        className="cursor-pointer tabular-nums underline decoration-1 underline-offset-4 transition-colors hover:text-bzz-blau-text"
      >
        v{APP_VERSION}
      </button>
      {open && <VersionDialog onClose={() => setOpen(false)} />}
    </>
  );
}
