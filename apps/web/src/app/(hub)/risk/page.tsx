'use client';

import { useState } from 'react';
import { useRisks, useCreateRisk } from '@/hooks/use-governance';
import { RiskRegister } from '@/components/governance/RiskRegister';

export default function RiskPage() {
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const { data, isLoading } = useRisks({
    category: category || undefined,
    status: status || undefined,
    severity: severity || undefined,
  });
  const createRisk = useCreateRisk();
  const risks = data?.risks ?? [];

  function notify(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 4_000);
  }

  function handleQuickAdd() {
    createRisk.mutate(
      {
        title: `New Risk — ${new Date().toLocaleString()}`,
        category: 'operational',
        probability: 2,
        impact: 3,
        owner: 'Admin',
        mitigationPlan: 'To be defined',
      },
      {
        onSuccess: (r) => notify(`Risk "${r.title}" created (${r.severity})`),
        onError: () => notify('Failed to create risk'),
      }
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Risk Register</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Operational, security, availability and compliance risks
          </p>
        </div>
        <div className="flex items-center gap-2">
          {actionMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-3 py-1.5">
              {actionMsg}
            </span>
          )}
          <button
            onClick={handleQuickAdd}
            disabled={createRisk.isPending}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded px-3 py-1.5 transition-colors"
          >
            {createRisk.isPending ? 'Adding…' : '+ Add Risk'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {[
          {
            label: 'Category',
            value: category,
            setter: setCategory,
            options: [
              ['', 'All'],
              ['security', 'Security'],
              ['operational', 'Operational'],
              ['availability', 'Availability'],
              ['compliance', 'Compliance'],
              ['infrastructure', 'Infrastructure'],
            ],
          },
          {
            label: 'Status',
            value: status,
            setter: setStatus,
            options: [
              ['', 'All'],
              ['open', 'Open'],
              ['mitigating', 'Mitigating'],
              ['mitigated', 'Mitigated'],
              ['accepted', 'Accepted'],
            ],
          },
          {
            label: 'Severity',
            value: severity,
            setter: setSeverity,
            options: [
              ['', 'All'],
              ['critical', 'Critical'],
              ['high', 'High'],
              ['medium', 'Medium'],
              ['low', 'Low'],
            ],
          },
        ].map(({ value, setter, options }) => (
          <select
            key={String(options[0])}
            value={value}
            onChange={(e) => setter(e.target.value)}
            className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
          >
            {options.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        ))}
        <span className="text-xs text-zinc-400">{risks.length} risks</span>
      </div>

      {isLoading ? (
        <p className="text-zinc-400 text-sm">Loading…</p>
      ) : (
        <RiskRegister risks={risks} />
      )}
    </div>
  );
}
