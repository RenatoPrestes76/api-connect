'use client';

import type { Risk } from '@/types/governance';

const SEV_BADGE: Record<string, string> = {
  critical:
    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  high: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  medium:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  low: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
};

const STATUS_DOT: Record<string, string> = {
  open: 'bg-red-500',
  mitigating: 'bg-amber-500',
  mitigated: 'bg-emerald-500',
  accepted: 'bg-blue-400',
  transferred: 'bg-purple-400',
};

const CAT_ICON: Record<string, string> = {
  operational: '⚙️',
  security: '🔒',
  availability: '📡',
  compliance: '📋',
  integration: '🔗',
  infrastructure: '🖥',
};

function matrixColor(score: number): string {
  if (score >= 15) return 'bg-red-500';
  if (score >= 8) return 'bg-orange-400';
  if (score >= 4) return 'bg-amber-400';
  return 'bg-emerald-400';
}

interface Props {
  risks: Risk[];
}

export function RiskRegister({ risks }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Risk Register</h3>
        <div className="flex items-center gap-3 text-xs">
          {['critical', 'high', 'medium', 'low'].map((s) => (
            <span
              key={s}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${SEV_BADGE[s]}`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
        {risks.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-3">
            <span className="text-base mt-0.5">{CAT_ICON[r.category] ?? '⚠️'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {r.title}
                </p>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${SEV_BADGE[r.severity] ?? ''}`}
                >
                  {r.severity}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.status] ?? 'bg-zinc-400'}`}
                  />
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{r.description}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-400">
                <span>
                  P: {r.probability} × I: {r.impact} =
                  <span
                    className={`ml-1 text-white rounded px-1 ${matrixColor(r.probability * r.impact)}`}
                  >
                    {r.probability * r.impact}
                  </span>
                </span>
                <span>Owner: {r.owner}</span>
                {r.dueDate && (
                  <span className="text-amber-500">
                    Due: {new Date(r.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {risks.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">No risks recorded</div>
        )}
      </div>
    </div>
  );
}
