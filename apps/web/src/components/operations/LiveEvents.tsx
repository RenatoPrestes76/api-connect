'use client';

import { useOperationsEvents } from '@/hooks/use-operations';

const severityDot: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  error: 'bg-orange-500',
  critical: 'bg-red-500',
};

function timeAgo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function LiveEvents() {
  const { data, isLoading } = useOperationsEvents(undefined, 20);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Live Events</h3>
        <span className="flex items-center gap-1.5 text-xs text-emerald-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          live
        </span>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-sm text-zinc-400">Loading events...</div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[360px] overflow-y-auto">
          {data?.events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${severityDot[e.severity]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-xs text-zinc-500 dark:text-zinc-400">{e.event}</code>
                  <span className="text-xs text-zinc-400">{timeAgo(e.createdAt)}</span>
                </div>
                <p className="text-xs text-zinc-400 truncate">{e.tenantId}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
