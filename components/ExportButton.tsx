'use client';

import { Download } from 'lucide-react';
import { exportCalendarToExcel } from '@/src/lib/exportExcel';
import type { CalendarDay } from '@/src/types';

interface ExportButtonProps {
  days: CalendarDay[];
  className: string;
  schoolYearName: string;
}

export default function ExportButton({ days, className, schoolYearName }: ExportButtonProps) {
  return (
    <button
      onClick={() => exportCalendarToExcel(days, className, schoolYearName)}
      title="Als Excel exportieren"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
    >
      <Download className="w-4 h-4" />
      Excel
    </button>
  );
}
