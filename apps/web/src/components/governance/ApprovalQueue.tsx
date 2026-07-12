'use client';

import type { ChangeRequest } from '@/types/governance';

const TYPE_ICON: Record<string, string> = {
  infrastructure: '🖥',
  configuration: '⚙️',
  deployment: '🚀',
  security: '🔒',
  data: '🗄',
  emergency: '🚨',
};

const PRIORITY_RING: Record<string, string> = {
  critical: 'ring-red-400',
  high: 'ring-orange-400',
  medium: 'ring-amber-400',
  low: 'ring-zinc-300',
};

interface Props {
  pending: ChangeRequest[];
  onApprove: (id: string, notes?: string) => void;
  onReject: (id: string, reason: string) => void;
  isPending?: boolean;
}

export function ApprovalQueue({ pending, onApprove, onReject, isPending }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Approval Queue</h3>
        {pending.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
            {pending.length} awaiting
          </span>
        )}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {pending.map((c) => (
          <div
            key={c.id}
            className={`px-4 py-3 ring-1 ring-inset ${PRIORITY_RING[c.priority] ?? 'ring-zinc-200'} rounded-none`}
          >
            <div className="flex items-start gap-2">
              <span className="text-base">{TYPE_ICON[c.type] ?? '📝'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{c.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{c.justification}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-400">
                  <span>By: {c.requesterName}</span>
                  <span>Scheduled: {new Date(c.scheduledAt).toLocaleDateString()}</span>
                  <span
                    className={`font-medium uppercase ${c.priority === 'critical' ? 'text-red-500' : c.priority === 'high' ? 'text-orange-500' : 'text-zinc-400'}`}
                  >
                    {c.priority}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => onApprove(c.id)}
                disabled={isPending}
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white rounded px-3 py-1.5 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onReject(c.id, 'Change rejected by reviewer')}
                disabled={isPending}
                className="flex-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white rounded px-3 py-1.5 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">No pending approvals</div>
        )}
      </div>
    </div>
  );
}
