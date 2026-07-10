'use client';
import type { TimelineEvent, TimelineEventType } from '@/types/observatory';

const TYPE_COLOR: Record<TimelineEventType, string> = {
  started: 'bg-indigo-500',
  step_started: 'bg-blue-400',
  step_completed: 'bg-emerald-500',
  step_failed: 'bg-red-500',
  retry: 'bg-amber-400',
  condition: 'bg-purple-500',
  completed: 'bg-emerald-600',
  failed: 'bg-red-600',
  cancelled: 'bg-slate-400',
};

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface Props {
  events: TimelineEvent[];
}

export function TimelineView({ events }: Props) {
  const sorted = [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return (
    <div className="relative flex flex-col gap-0">
      {sorted.map((ev, i) => (
        <div key={ev.id} className="flex gap-3">
          {/* Spine */}
          <div className="flex flex-col items-center">
            <div className={`h-3 w-3 rounded-full mt-1 flex-shrink-0 ${TYPE_COLOR[ev.type]}`} />
            {i < sorted.length - 1 && <div className="w-px flex-1 bg-border min-h-[20px]" />}
          </div>
          {/* Content */}
          <div className="pb-4 min-w-0">
            <p className="text-sm leading-tight">{ev.message}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {fmt(ev.timestamp)}
              </span>
              {ev.durationMs !== undefined && (
                <span className="text-[10px] text-muted-foreground">{ev.durationMs}ms</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
