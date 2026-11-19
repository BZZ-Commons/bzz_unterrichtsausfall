'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportCalendarToExcel } from '@/src/lib/exportExcel';
import type { CalendarDay } from '@/src/types';

interface ExportButtonProps {
  days: CalendarDay[];
  className: string;
  schoolYearName: string;
  detailsMode?: boolean;
}

export default function ExportButton({
  days,
  className,
  schoolYearName,
  detailsMode,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(false);
    try {
      await exportCalendarToExcel(days, className, schoolYearName, detailsMode);
    } catch (err) {
      console.error('Excel-Export fehlgeschlagen:', err);
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isExporting}
        title="Kalender als Excel-Datei herunterladen"
        className="bzz-btn bzz-btn--klein"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        Excel (XLSX)
      </button>
      {exportError && (
        <p role="alert" className="bzz-error m-0">
          Export fehlgeschlagen — bitte erneut versuchen.
        </p>
      )}
    </div>
  );
}
