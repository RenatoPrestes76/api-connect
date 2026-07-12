'use client';
import type { GovernancePolicy } from '@/types/helios';

const CRITICALITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  low: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

const CLASS_COLORS: Record<string, string> = {
  restricted: 'bg-red-500/10 text-red-400 border border-red-500/20',
  confidential: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  internal: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  public: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

interface Props {
  policies: GovernancePolicy[];
}

export function EventGovernance({ policies }: Props) {
  return (
    <div className="space-y-2">
      {policies.map((p) => (
        <div key={p.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-zinc-200 text-sm">{p.eventType}</span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs ${CRITICALITY_COLORS[p.criticality]}`}
                >
                  {p.criticality}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs ${CLASS_COLORS[p.classification]}`}
                >
                  {p.classification}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                {p.owner} · {p.team}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-zinc-500">Retention</p>
              <p className="text-sm font-mono text-zinc-300">{p.retentionDays}d</p>
            </div>
          </div>
          {p.complianceFrameworks.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {p.complianceFrameworks.map((f) => (
                <span key={f} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {f}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-zinc-600 mt-1">Archive after {p.archiveAfterDays}d</p>
        </div>
      ))}
    </div>
  );
}
