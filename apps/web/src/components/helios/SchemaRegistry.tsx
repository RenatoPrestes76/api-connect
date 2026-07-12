'use client';
import { useState } from 'react';
import type { SchemaVersion } from '@/types/helios';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  deprecated: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  draft: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
};

interface Props {
  schemas: SchemaVersion[];
  onRollback: (eventType: string, version: string) => void;
}

export function SchemaRegistry({ schemas, onRollback }: Props) {
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const grouped = schemas.reduce<Record<string, SchemaVersion[]>>((acc, s) => {
    (acc[s.eventType] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([eventType, versions]) => {
        const active = versions.find((v) => v.status === 'active');
        const open = expandedType === eventType;
        return (
          <div
            key={eventType}
            className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden"
          >
            <button
              onClick={() => setExpandedType(open ? null : eventType)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-200 text-sm">{eventType}</span>
                {active && (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS.active}`}
                  >
                    v{active.version} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  {versions.length} version{versions.length !== 1 ? 's' : ''}
                </span>
                <span className="text-zinc-500 text-xs">{open ? '▲' : '▼'}</span>
              </div>
            </button>

            {open && (
              <div className="border-t border-zinc-800 divide-y divide-zinc-800/50">
                {versions
                  .sort((a, b) => b.version.localeCompare(a.version))
                  .map((v) => (
                    <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-sm text-indigo-400">{v.version}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[v.status]}`}
                        >
                          {v.status}
                        </span>
                        <span className="text-xs text-zinc-500">{v.compatibility}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-zinc-600">{v.createdAt.slice(0, 10)}</span>
                        {v.status !== 'active' && (
                          <button
                            onClick={() => onRollback(eventType, v.version)}
                            className="rounded px-2 py-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                          >
                            Rollback
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
