'use client';

import type { AuditLog } from '@/types/governance';

const RESULT_DOT: Record<string, string> = {
  success: 'bg-emerald-500',
  failure: 'bg-orange-500',
  denied: 'bg-red-500',
};

const ACTION_ICON: Record<string, string> = {
  'user.login': '🔑',
  'user.logout': '🚪',
  'user.mfa_enabled': '🛡',
  'policy.created': '📋',
  'policy.updated': '✏️',
  'policy.enabled': '✅',
  'policy.disabled': '⛔',
  'secret.rotated': '🔄',
  'secret.created': '🔐',
  'secret.deleted': '🗑',
  'change.approved': '✅',
  'change.rejected': '❌',
  'change.executed': '⚡',
  'permission.changed': '🔑',
  'api_key.rotated': '🔑',
  'data.exported': '📤',
  'workflow.executed': '▶',
  'connector.provisioned': '🔌',
  'tenant.created': '🏢',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  logs: AuditLog[];
}

export function AuditTrail({ logs }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Audit Trail</h3>
        <div className="flex items-center gap-1.5 text-xs text-emerald-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>immutable · {logs.length} records</span>
        </div>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
        {logs.map((l) => (
          <div key={l.id} className="flex items-start gap-3 px-4 py-2.5">
            <span
              className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${RESULT_DOT[l.result] ?? 'bg-zinc-400'}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs">{ACTION_ICON[l.action] ?? '•'}</span>
                <code className="text-xs text-zinc-500 dark:text-zinc-400">{l.action}</code>
                <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                  {l.actorName}
                </span>
                <span className="text-xs text-zinc-400">{timeAgo(l.createdAt)}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                {l.resource}
              </p>
              <p
                className="text-[10px] text-zinc-300 dark:text-zinc-600 mt-0.5 truncate font-mono"
                title={l.signature}
              >
                {l.signature.slice(0, 30)}…
              </p>
            </div>
            {l.result !== 'success' && (
              <span
                className={`text-[10px] shrink-0 ${l.result === 'denied' ? 'text-red-500' : 'text-orange-500'}`}
              >
                {l.result}
              </span>
            )}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">No audit records</div>
        )}
      </div>
    </div>
  );
}
