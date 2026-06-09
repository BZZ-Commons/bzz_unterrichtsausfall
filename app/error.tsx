'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Unerwarteter Fehler:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full p-6 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
        <div className="flex gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-red-800">Etwas ist schiefgelaufen</h1>
            <p className="text-sm text-red-600 mt-1">
              Die Seite konnte nicht angezeigt werden. Bitte versuchen Sie es erneut.
            </p>
            {error.message && (
              <p className="text-xs text-red-500/80 mt-2 break-words font-mono">{error.message}</p>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Erneut versuchen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
