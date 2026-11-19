'use client';

import { useEffect, useEffectEvent, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface DialogShellProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** Tailwind max-width class of the dialog card. */
  widthClass?: string;
  /** Capitalise the title (German long dates start lower-case: "montag, …"). */
  capitalizeTitle?: boolean;
  children: React.ReactNode;
}

/**
 * Shared modal frame in the BZZ look: dark-blue backdrop (--bzz-dunkelblau),
 * white card with square corners, title + optional subtitle, close button.
 * Closes on Escape and backdrop click; focuses the close button on open.
 */
export default function DialogShell({
  title,
  subtitle,
  onClose,
  widthClass = 'max-w-md',
  capitalizeTitle = false,
  children,
}: DialogShellProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onEscape = useEffectEvent(() => onClose());

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bzz-dunkelblau/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bzz-card flex max-h-[85vh] w-full flex-col p-0 ${widthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-6 pb-4 sm:px-8 sm:pt-8">
          <div className="min-w-0">
            <h2
              id={titleId}
              className={`m-0 text-[22px] leading-tight ${capitalizeTitle ? 'capitalize' : ''}`}
            >
              {title}
            </h2>
            {subtitle && <p className="bzz-muted mt-1 mb-0">{subtitle}</p>}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="bzz-btn bzz-btn--klein w-9 shrink-0 px-0"
            aria-label="Schliessen"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6 sm:px-8 sm:pb-8">{children}</div>
      </div>
    </div>
  );
}
