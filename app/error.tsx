'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Unerwarteter Fehler:', error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main className="bzz-container pt-10">
        <div role="alert" className="bzz-note bzz-note--fehler max-w-xl">
          <h1 className="m-0 text-[22px] leading-tight">Etwas ist schiefgelaufen</h1>
          <p className="mt-2 mb-0">
            Die Seite konnte nicht angezeigt werden. Bitte versuchen Sie es erneut.
          </p>
          {error.message && (
            <p className="mt-2 mb-0 font-mono text-[13px] break-words text-bzz-kv-ink">
              {error.message}
            </p>
          )}
          <button type="button" onClick={reset} className="bzz-btn bzz-btn--dunkel mt-4">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Erneut versuchen
          </button>
        </div>
      </main>
    </>
  );
}
