'use client';

import type { ComplianceEvidence as Evidence } from '@/types/governance';

const STATUS_BADGE: Record<string, string> = {
  valid:
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  expired:
    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  pending:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

const TYPE_ICON: Record<string, string> = {
  document: '📄',
  screenshot: '🖼',
  log: '📋',
  report: '📊',
  attestation: '✍️',
};

const FW_LABELS: Record<string, string> = {
  iso27001: 'ISO 27001',
  soc2: 'SOC 2',
  lgpd: 'LGPD',
  gdpr: 'GDPR',
  nist: 'NIST',
  cis: 'CIS',
};

interface Props {
  evidence: Evidence[];
}

export function ComplianceEvidence({ evidence }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Compliance Evidence</h3>
        <span className="text-xs text-zinc-400">{evidence.length} records</span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-80 overflow-y-auto">
        {evidence.map((e) => (
          <div key={e.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className="text-base mt-0.5">{TYPE_ICON[e.evidenceType] ?? '📄'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {e.title}
                </p>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_BADGE[e.status] ?? ''}`}
                >
                  {e.status}
                </span>
                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded px-1">
                  {FW_LABELS[e.framework] ?? e.framework}
                </span>
                <code className="text-[10px] text-zinc-400">{e.controlId}</code>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Verified by {e.verifiedBy} · {new Date(e.verifiedAt).toLocaleDateString()}
                {e.expiresAt && ` · Expires ${new Date(e.expiresAt).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        ))}
        {evidence.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">No evidence records</div>
        )}
      </div>
    </div>
  );
}
