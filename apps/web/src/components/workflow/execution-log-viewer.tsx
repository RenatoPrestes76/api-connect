'use client';
import type { WorkflowExecution, ExecutionStep, StepStatus } from '@/types/workflow';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const STATUS_STYLES: Record<StepStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-500 dark:bg-slate-800',
  RUNNING: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  SKIPPED: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
  RETRYING: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

const STATUS_ICONS: Record<StepStatus, string> = {
  PENDING: '○',
  RUNNING: '⟳',
  COMPLETED: '✓',
  FAILED: '✕',
  SKIPPED: '–',
  RETRYING: '↺',
};

interface ExecutionLogViewerProps {
  execution: WorkflowExecution;
}

export function ExecutionLogViewer({ execution }: ExecutionLogViewerProps) {
  const totalMs = execution.durationMs;
  const barMax = Math.max(...execution.steps.map((s) => s.durationMs ?? 0), 1);

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900">
        <div>
          <p className="text-xs font-semibold text-slate-500">Execution</p>
          <p className="font-mono text-xs text-slate-700 dark:text-slate-300">
            {execution.id.slice(0, 12)}…
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
          </span>
          {totalMs !== undefined && (
            <span className="text-slate-500 font-mono">{totalMs}ms total</span>
          )}
        </div>
      </div>

      {/* Steps */}
      <ol className="divide-y divide-slate-100 dark:divide-slate-800">
        {execution.steps.map((step, i) => (
          <StepRow key={step.id} step={step} index={i} barMax={barMax} />
        ))}
      </ol>

      {/* Error */}
      {execution.error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-950">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">
            Execution Error
          </p>
          <pre className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap font-mono">
            {execution.error}
          </pre>
        </div>
      )}
    </div>
  );
}

function StepRow({ step, index, barMax }: { step: ExecutionStep; index: number; barMax: number }) {
  const barWidth = step.durationMs ? Math.round((step.durationMs / barMax) * 100) : 0;

  return (
    <li className="px-4 py-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                STATUS_STYLES[step.status]
              )}
            >
              {STATUS_ICONS[step.status]} {step.status}
            </span>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
              {step.label}
            </p>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">
              {step.durationMs !== undefined ? `${step.durationMs}ms` : '—'}
            </span>
          </div>

          {/* Duration bar */}
          {step.durationMs !== undefined && (
            <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  step.status === 'FAILED' ? 'bg-red-400' : 'bg-indigo-400'
                )}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          )}

          {/* Error */}
          {step.error && (
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 font-mono">
              {step.error}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
