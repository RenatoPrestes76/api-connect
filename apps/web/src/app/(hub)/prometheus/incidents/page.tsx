'use client';

import { useState } from 'react';
import { useIncidents, useResolveIncident } from '@/hooks/use-prometheus';
import { IncidentTimeline } from '@/components/prometheus/IncidentTimeline';

export default function PrometheusIncidentsPage() {
  const [toast, setToast] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const { data, isLoading } = useIncidents();
  const resolve = useResolveIncident();
  const incidents = data?.incidents ?? [];

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4_000);
  }

  function handleResolve(id: string) {
    resolve.mutate(id, {
      onSuccess: (i) => notify(`Incident "${i.title}" resolved`),
      onError: (e) => notify(`Error: ${(e as Error).message}`),
    });
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading incidents…</p>
      </div>
    );

  const selected = incidents.find((i) => i.id === selectedId) ?? incidents[0];

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Incidents & Root Cause Analysis
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {incidents.filter((i) => i.status !== 'resolved').length} open ·{' '}
            {incidents.filter((i) => i.status === 'resolved').length} resolved
          </p>
        </div>
        {toast && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-3 py-1.5">
            {toast}
          </span>
        )}
      </div>

      <IncidentTimeline
        incidents={incidents}
        selectedId={selectedId ?? incidents[0]?.id}
        onSelect={setSelectedId}
      />

      {selected && selected.status !== 'resolved' && (
        <div className="flex justify-end">
          <button
            onClick={() => handleResolve(selected.id)}
            disabled={resolve.isPending}
            className="text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 text-white rounded-lg px-4 py-2 transition-colors"
          >
            {resolve.isPending ? 'Resolving…' : `Resolve "${selected.title}"`}
          </button>
        </div>
      )}

      {/* RCA for selected incident */}
      {selected && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Root Cause Analysis — {selected.title}
          </h3>
          {selected.rca.length > 0 ? (
            <div className="space-y-3">
              {[...selected.rca]
                .sort((a, b) => b.confidence - a.confidence)
                .map((h, i) => (
                  <div
                    key={i}
                    className="border border-zinc-100 dark:border-zinc-800 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 flex-1">
                        {h.component}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${h.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-indigo-600 dark:text-indigo-400 font-bold">
                          {h.confidence}%
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{h.hypothesis}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {h.evidence.map((ev, j) => (
                        <span
                          key={j}
                          className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded px-2 py-0.5"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No RCA data available for this incident.</p>
          )}
        </div>
      )}
    </div>
  );
}
