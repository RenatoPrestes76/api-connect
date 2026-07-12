'use client';
import type { DLQEntry } from '@/types/helios';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  resolved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  discarded: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
};

interface Props {
  entries: DLQEntry[];
  onRequeue: (id: string) => void;
  onDiscard: (id: string) => void;
}

export function DeadLetterQueue({ entries, onRequeue, onDiscard }: Props) {
  const pending = entries.filter((e) => e.status === 'pending').length;
  const resolved = entries.filter((e) => e.status === 'resolved').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: entries.length },
          { label: 'Pending', value: pending, color: 'text-amber-400' },
          { label: 'Resolved', value: resolved, color: 'text-emerald-400' },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-center"
          >
            <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
            <p className={`text-xl font-semibold tabular-nums ${k.color ?? 'text-zinc-200'}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-zinc-200 text-sm">{e.eventType}</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[e.status]}`}
                  >
                    {e.status}
                  </span>
                  <span className="text-xs text-zinc-500">{e.retries} retries</span>
                </div>
                <p className="text-xs text-red-400 mb-1">{e.error}</p>
                <p className="text-xs text-zinc-600">
                  Topic: {e.originalTopicId} · {e.firstFailedAt.slice(0, 16)}
                </p>
              </div>
              {e.status === 'pending' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onRequeue(e.id)}
                    className="rounded px-2 py-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                  >
                    Requeue
                  </button>
                  <button
                    onClick={() => onDiscard(e.id)}
                    className="rounded px-2 py-1 text-xs bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
                  >
                    Discard
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
