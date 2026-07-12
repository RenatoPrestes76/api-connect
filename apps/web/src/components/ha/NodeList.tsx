'use client';

import type { ClusterNode, NodeStatus, NodeRole } from '@/types/ha';

const STATUS_CLASSES: Record<NodeStatus, string> = {
  online: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  degraded: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  failover: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  recovering: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  offline: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

const ROLE_BADGE: Record<NodeRole, string> = {
  leader: 'text-indigo-600 dark:text-indigo-400 font-semibold',
  secondary: 'text-sky-600 dark:text-sky-400',
  standby: 'text-zinc-500 dark:text-zinc-400',
  worker: 'text-violet-600 dark:text-violet-400',
};

function heartbeatAgo(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1_000);
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

interface Props {
  nodes: ClusterNode[];
}

export function NodeList({ nodes }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Cluster Nodes</h3>
        <p className="text-xs text-zinc-400 mt-0.5">{nodes.length} nodes registered</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {nodes.map((n) => (
          <div key={n.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {n.hostname}
                </p>
                <span className={`text-xs ${ROLE_BADGE[n.role]}`}>{n.role}</span>
              </div>
              <p className="text-xs text-zinc-400">
                {n.region} · v{n.version} · hb: {heartbeatAgo(n.lastHeartbeat)}
              </p>
            </div>

            {n.replication && (
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-zinc-400">lag</p>
                <p
                  className={`text-xs font-mono tabular-nums ${
                    n.replication.lagMs > 200
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {n.replication.lagMs}ms
                </p>
              </div>
            )}

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${STATUS_CLASSES[n.status]}`}
            >
              {n.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
