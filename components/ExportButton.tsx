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
        onClick={() => void handleExport()}
        disabled={isExporting}
        title="Als Excel exportieren"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="w-4 h-4" aria-hidden="true" />
        )}
        Excel
      </button>
      {exportError && (
        <p role="alert" className="text-xs text-red-600">
          Export fehlgeschlagen — bitte erneut versuchen.
        </p>
      )}
    </div>
  );
}
