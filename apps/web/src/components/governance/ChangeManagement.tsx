'use client';

import type { ChangeRequest } from '@/types/governance';

const STATUS_BADGE: Record<string, string> = {
  pending:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  approved:
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  rejected:
    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  executing:
    'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  completed:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  rolled_back:
    'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-zinc-400',
};

const TYPE_ICON: Record<string, string> = {
  infrastructure: '🖥',
  configuration: '⚙️',
  deployment: '🚀',
  security: '🔒',
  data: '🗄',
  emergency: '🚨',
};

interface Props {
  changes: ChangeRequest[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isPending?: boolean;
}

export function ChangeManagement({ changes, onApprove, onReject, isPending }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Change Management</h3>
        <span className="text-xs text-zinc-400">
          {changes.length} change{changes.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {changes.map((c) => (
          <div key={c.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-sm">{TYPE_ICON[c.type] ?? '📝'}</span>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {c.title}
                </p>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[c.status] ?? ''}`}
                >
                  {c.status}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[c.priority] ?? 'bg-zinc-400'}`}
                  />
                  {c.priority}
                </span>
              </div>
              {c.status === 'pending' && (onApprove || onReject) && (
                <div className="flex items-center gap-1 shrink-0">
                  {onApprove && (
                    <button
                      onClick={() => onApprove(c.id)}
                      disabled={isPending}
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded px-2 py-1 transition-colors"
                    >
                      Approve
                    </button>
                  )}
                  {onReject && (
                    <button
                      onClick={() => onReject(c.id)}
                      disabled={isPending}
                      className="text-[10px] bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded px-2 py-1 transition-colors"
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-400">
              <span>By: {c.requesterName}</span>
              {c.approverName && <span>Approver: {c.approverName}</span>}
              <span>Scheduled: {new Date(c.scheduledAt).toLocaleDateString()}</span>
            </div>
            {c.rejectionReason && (
              <p className="text-[10px] text-red-500 mt-1">Rejection: {c.rejectionReason}</p>
            )}
          </div>
        ))}
        {changes.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">No change requests</div>
        )}
      </div>
    </div>
  );
}
