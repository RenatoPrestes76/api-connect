'use client';
import { useState } from 'react';
import type { CatalogEntry } from '@/types/helios';

const CRITICALITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  restricted: 'bg-red-500/10 text-red-400 border border-red-500/20',
  confidential: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  internal: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  public: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

interface Props {
  entries: CatalogEntry[];
}

export function EventCatalogList({ entries }: Props) {
  const [selected, setSelected] = useState<CatalogEntry | null>(null);

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 min-w-0 space-y-2">
        {entries.map((e) => (
          <div
            key={e.id}
            onClick={() => setSelected(e)}
            className={`rounded-lg border p-4 cursor-pointer transition-colors ${selected?.id === e.id ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-200">{e.eventType}</p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{e.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs ${CRITICALITY_COLORS[e.criticality]}`}
                >
                  {e.criticality}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs ${CLASSIFICATION_COLORS[e.classification]}`}
                >
                  {e.classification}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
              <span>
                v{e.currentVersion} · by {e.producer}
              </span>
              <span>{e.consumers.length} consumers</span>
              <span>{e.retentionDays}d retention</span>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="w-80 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 overflow-y-auto max-h-[600px]">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">{selected.eventType}</h3>
            <button
              onClick={() => setSelected(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Producer</p>
              <p className="text-sm text-zinc-200">{selected.producer}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Consumers ({selected.consumers.length})</p>
              <div className="flex flex-wrap gap-1">
                {selected.consumers.map((c) => (
                  <span
                    key={c}
                    className="inline-flex rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Example Payload</p>
              <pre className="rounded bg-zinc-950 p-2 text-xs text-zinc-300 overflow-x-auto">
                {JSON.stringify(selected.examplePayload, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-2">Changelog</p>
              <div className="space-y-2">
                {selected.changelog.map((c) => (
                  <div key={c.version} className="rounded bg-zinc-800 p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-indigo-400">{c.version}</span>
                      <span className="text-zinc-500">{c.date}</span>
                    </div>
                    <p className="text-zinc-300">{c.changes}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
