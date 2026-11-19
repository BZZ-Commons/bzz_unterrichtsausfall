interface DraftNoticeProps {
  schoolYearName: string;
}

/**
 * Banner shown while a future school year's plan is still a draft (see
 * `isDraftSchoolYear`). Warns that the displayed cancellations may still change.
 */
export default function DraftNotice({ schoolYearName }: DraftNoticeProps) {
  return (
    <div className="bzz-note bzz-note--warnung mb-6">
      <strong>Vorläufige Planung (Entwurf)</strong>
      <p className="mt-1 mb-0">
        Die angezeigten Ausfälle für das Schuljahr {schoolYearName} sind noch nicht definitiv.
        Änderungen sind weiterhin möglich.
      </p>
    </div>
  );
}
