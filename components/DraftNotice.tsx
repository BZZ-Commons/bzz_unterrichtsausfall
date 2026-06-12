import { AlertTriangle } from 'lucide-react';

interface DraftNoticeProps {
  schoolYearName: string;
}

/**
 * Banner shown while a future school year's plan is still a draft (see
 * `isDraftSchoolYear`). Warns that the displayed cancellations may still change.
 */
export default function DraftNotice({ schoolYearName }: DraftNoticeProps) {
  return (
    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Vorläufige Planung (Entwurf)</p>
        <p className="text-sm text-amber-700 mt-0.5">
          Die angezeigten Ausfälle für das Schuljahr {schoolYearName} sind noch nicht definitiv.
          Änderungen sind weiterhin möglich.
        </p>
      </div>
    </div>
  );
}
