import { RotateCcw } from 'lucide-react';

interface ErrorNoticeProps {
  message: string;
  /** When set, renders an "Erneut versuchen" button below the message. */
  onRetry?: () => void;
}

/** BZZ error note for failed data loads, with an optional in-place retry. */
export default function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <div role="alert" className="bzz-note bzz-note--fehler mx-auto mt-8 max-w-xl">
      <strong>Fehler beim Laden</strong>
      <p className="mt-1 mb-0 break-words">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="bzz-btn bzz-btn--dunkel mt-4">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
