'use client';

import type { Runbook } from '@/types/prometheus';

const MODE_COLOR: Record<string, string> = {
  automatic: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  assisted: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  manual: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
};

const STEP_TYPE_COLOR: Record<string, string> = {
  check: 'bg-blue-500',
  action: 'bg-indigo-500',
  decision: 'bg-amber-500',
  notify: 'bg-purple-500',
};

interface Props {
  runbooks: Runbook[];
  onExecute?: (id: string) => void;
  isPending?: boolean;
}

export function RunbookEngine({ runbooks, onExecute, isPending }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Intelligent Runbooks</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{runbooks.length} playbooks configured</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {runbooks.map((rb) => (
          <div key={rb.id} className="p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {rb.title}
                  </p>
                  <span
                    className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${MODE_COLOR[rb.mode]}`}
                  >
                    {rb.mode}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">Trigger: {rb.trigger}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  {rb.steps.slice(0, 6).map((s, i) => (
                    <div
                      key={i}
                      title={s.title}
                      className={`w-2 h-2 rounded-full ${STEP_TYPE_COLOR[s.type]} ${!s.automated ? 'ring-1 ring-white dark:ring-zinc-900' : ''}`}
                    />
                  ))}
                  {rb.steps.length > 6 && (
                    <span className="text-[10px] text-zinc-400">+{rb.steps.length - 6}</span>
                  )}
                  <span className="text-[10px] text-zinc-400 ml-1">{rb.steps.length} steps</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-400">
                  <span>Runs: {rb.executionCount}</span>
                  <span>Avg: {rb.avgResolutionMinutes}m</span>
                </div>
              </div>
              {onExecute && (
                <button
                  onClick={() => onExecute(rb.id)}
                  disabled={isPending}
                  className="flex-shrink-0 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white rounded px-2.5 py-1 transition-colors"
                >
                  Run
                </button>
              )}
            </div>
          </div>
        ))}
        {runbooks.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-400">No runbooks configured</p>
        )}
      </div>
    </div>
  );
}
