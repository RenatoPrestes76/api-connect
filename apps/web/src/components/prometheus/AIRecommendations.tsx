'use client';

import type { AIRecommendation } from '@/types/prometheus';

const CAT_COLOR: Record<string, string> = {
  performance: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400',
  cost: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
  reliability: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  scaling: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  security: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  applied: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  dismissed: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500',
};

interface Props {
  recommendations: AIRecommendation[];
  onApply?: (id: string) => void;
  onDismiss?: (id: string) => void;
  isPending?: boolean;
}

export function AIRecommendations({ recommendations, onApply, onDismiss, isPending }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">AI Recommendations</h3>
        <span className="text-xs text-zinc-400">
          {recommendations.filter((r) => r.status === 'pending').length} pending
        </span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {recommendations.map((r) => (
          <div key={r.id} className={`p-3 ${r.status !== 'pending' ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={`text-[10px] font-medium rounded-full px-2 py-0.5 uppercase ${CAT_COLOR[r.category]}`}
                  >
                    {r.category}
                  </span>
                  <span
                    className={`text-[10px] rounded-full px-2 py-0.5 ${STATUS_BADGE[r.status]}`}
                  >
                    {r.status}
                  </span>
                  <span className="text-[10px] text-zinc-400 ml-auto">
                    {r.confidence}% confidence
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{r.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{r.description}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                  {r.estimatedImpact}
                </p>
              </div>
            </div>
            {r.status === 'pending' && (onApply || onDismiss) && (
              <div className="flex gap-2 mt-2">
                {onApply && (
                  <button
                    onClick={() => onApply(r.id)}
                    disabled={isPending}
                    className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white rounded px-2 py-1 transition-colors"
                  >
                    Apply
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={() => onDismiss(r.id)}
                    disabled={isPending}
                    className="flex-1 text-xs border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded px-2 py-1 transition-colors"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {recommendations.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-400">No recommendations</p>
        )}
      </div>
    </div>
  );
}
