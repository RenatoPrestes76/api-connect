'use client';

export type HaEventType =
  | 'node.joined'
  | 'node.left'
  | 'node.degraded'
  | 'node.recovered'
  | 'failover.initiated'
  | 'failover.completed'
  | 'backup.started'
  | 'backup.completed'
  | 'backup.failed'
  | 'restore.started'
  | 'restore.completed'
  | 'restore.failed'
  | 'replication.stopped'
  | 'replication.normalized'
  | 'replication.lagging'
  | 'recovery.test.passed'
  | 'recovery.test.failed';

export interface HaEvent {
  id: string;
  type: HaEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const SEV_DOT: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  error: 'bg-orange-500',
  critical: 'bg-red-500',
};

const TYPE_ICON: Partial<Record<HaEventType, string>> = {
  'failover.initiated': '⚡',
  'failover.completed': '✅',
  'backup.completed': '💾',
  'backup.failed': '❌',
  'restore.started': '🔄',
  'node.degraded': '⚠️',
  'node.joined': '🟢',
  'node.left': '🔴',
  'recovery.test.passed': '✓',
  'recovery.test.failed': '✗',
  'replication.lagging': '⏱',
  'replication.normalized': '✅',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Props {
  events: HaEvent[];
}

export function HaEventLog({ events }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">HA Event Log</h3>
        <span className="flex items-center gap-1.5 text-xs text-emerald-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          live
        </span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[360px] overflow-y-auto">
        {events.map((e) => (
          <div key={e.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV_DOT[e.severity]}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs">{TYPE_ICON[e.type] ?? '•'}</span>
                <code className="text-xs text-zinc-500 dark:text-zinc-400">{e.type}</code>
                <span className="text-xs text-zinc-400">{timeAgo(e.createdAt)}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5 truncate">
                {e.message}
              </p>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">No events recorded</div>
        )}
      </div>
    </div>
  );
}
