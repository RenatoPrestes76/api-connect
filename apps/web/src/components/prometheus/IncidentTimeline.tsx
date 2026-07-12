'use client';

import type { Incident, IncidentTimelineEvent } from '@/types/prometheus';

const EVENT_COLOR: Record<string, string> = {
  detection: 'bg-red-500',
  escalation: 'bg-orange-500',
  action: 'bg-indigo-500',
  resolution: 'bg-emerald-500',
};

const SEV_COLOR: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-500',
  low: 'border-l-zinc-400',
};

interface Props {
  incidents: Incident[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function IncidentTimeline({ incidents, selectedId, onSelect }: Props) {
  const selected = incidents.find((i) => i.id === selectedId) ?? incidents[0];

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Incident Timeline</h3>
      </div>
      <div className="flex divide-x divide-zinc-100 dark:divide-zinc-800">
        {/* Incident list */}
        <div className="w-1/3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {incidents.map((inc) => (
            <button
              key={inc.id}
              onClick={() => onSelect?.(inc.id)}
              className={`w-full text-left px-3 py-2.5 border-l-4 ${SEV_COLOR[inc.severity]} ${selectedId === inc.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'} transition-colors`}
            >
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2">
                {inc.title}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5 capitalize">{inc.status}</p>
            </button>
          ))}
        </div>
        {/* Timeline */}
        <div className="flex-1 p-3">
          {selected ? (
            <div className="space-y-3">
              {selected.timeline.map((ev: IncidentTimelineEvent, i: number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${EVENT_COLOR[ev.type] ?? 'bg-zinc-400'}`}
                    />
                    {i < selected.timeline.length - 1 && (
                      <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700 my-1" />
                    )}
                  </div>
                  <div className="pb-2">
                    <p className="text-[10px] text-zinc-400 tabular-nums">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300">{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 text-center py-8">Select an incident</p>
          )}
        </div>
      </div>
    </div>
  );
}
