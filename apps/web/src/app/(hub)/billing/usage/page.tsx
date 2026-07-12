'use client';
import { BarChart3 } from 'lucide-react';
import { useUsage, useUsageHistory } from '@/hooks/use-billing';
import { UsageMeter } from '@/components/billing/usage-meter';

const DEMO_TENANT = 'tenant-professional';

export default function UsagePage() {
  const { data: current, isLoading } = useUsage(DEMO_TENANT);
  const { data: history } = useUsageHistory(DEMO_TENANT);

  const usage = current?.usage;
  const limits = current?.limits;
  const historical = history?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Usage</h1>
          <p className="text-sm text-slate-400">Current billing period consumption</p>
        </div>
      </div>

      {/* Current period */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">{usage?.month ?? 'Loading…'}</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-6 rounded bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : usage && limits ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <UsageMeter label="Agents" value={usage.agents} limit={limits.agents} />
            <UsageMeter label="Connectors" value={usage.connectors} limit={limits.connectors} />
            <UsageMeter label="Workflows" value={usage.workflows} limit={limits.workflows} />
            <UsageMeter label="AI Credits" value={usage.aiCreditsUsed} limit={limits.aiCredits} />
            <UsageMeter label="API Calls" value={usage.apiCalls} limit={null} />
            <UsageMeter label="Executions" value={usage.executions} limit={null} />
            <UsageMeter label="AI Tokens" value={usage.aiTokens} limit={null} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">No data available</p>
        )}
      </div>

      {/* Usage history table */}
      {historical.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Month</th>
                  <th className="pb-2 pr-4 font-medium">API Calls</th>
                  <th className="pb-2 pr-4 font-medium">Executions</th>
                  <th className="pb-2 pr-4 font-medium">AI Credits</th>
                  <th className="pb-2 pr-4 font-medium">AI Tokens</th>
                </tr>
              </thead>
              <tbody>
                {historical.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                    <td className="py-2 pr-4 text-slate-300 font-mono">{u.month}</td>
                    <td className="py-2 pr-4 text-slate-400 tabular-nums">
                      {u.apiCalls.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-slate-400 tabular-nums">
                      {u.executions.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-slate-400 tabular-nums">
                      {u.aiCreditsUsed.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-slate-400 tabular-nums">
                      {u.aiTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
