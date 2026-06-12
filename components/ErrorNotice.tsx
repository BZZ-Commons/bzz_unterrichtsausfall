import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorNoticeProps {
  message: string;
  /** When set, renders an "Erneut versuchen" button below the message. */
  onRetry?: () => void;
}

/** Red error box for failed data loads, with an optional in-place retry. */
export default function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <div className="max-w-lg mx-auto mt-8 p-5 bg-red-50 border border-red-200 rounded-xl flex gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-red-800">Fehler beim Laden</p>
        <p className="text-sm text-red-600 mt-0.5 break-words">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Erneut versuchen
          </button>
        )}
      </div>
    </div>
  );
}
