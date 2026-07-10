'use client';
import type { IncidentStatus, IncidentSeverity } from '@/types/observatory';

const STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: 'bg-red-100    text-red-700    dark:bg-red-950    dark:text-red-300',
  INVESTIGATING: 'bg-amber-100  text-amber-700  dark:bg-amber-950  dark:text-amber-300',
  FIXED: 'bg-blue-100   text-blue-700   dark:bg-blue-950   dark:text-blue-300',
  RESOLVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CLOSED: 'bg-slate-100  text-slate-600  dark:bg-slate-800  dark:text-slate-400',
};

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  CRITICAL: 'bg-red-600    text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-amber-400  text-white',
  LOW: 'bg-slate-400  text-white',
};

interface StatusBadgeProps {
  status: IncidentStatus;
}
interface SeverityBadgeProps {
  severity: IncidentSeverity;
}

export function IncidentStatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function IncidentSeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}
