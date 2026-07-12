'use client';

import { useState } from 'react';
import { useFeatureFlags, useUpdateFeatureFlag } from '@/hooks/use-ops';
import { FeatureFlagToggle } from '@/components/ops/feature-flag-toggle';
import type { FeatureFlag } from '@/types/ops';

export default function FeatureFlagsPage() {
  const { data, isLoading } = useFeatureFlags();
  const updateFlag = useUpdateFeatureFlag();
  const [evalContext, setEvalContext] = useState(
    '{"tenantId":"tenant-enterprise","plan":"enterprise"}'
  );
  const [evalResult, setEvalResult] = useState<
    Record<string, { enabled: boolean; variant: string; reason: string }>
  >({});

  const flags: FeatureFlag[] = (data as any)?.flags ?? [];
  const enabledCount = flags.filter((f) => f.enabled).length;

  const handleToggle = async (id: string, enabled: boolean) => {
    await updateFlag.mutateAsync({ id, data: { enabled } });
  };

  const handleEvaluateAll = async () => {
    try {
      const ctx = JSON.parse(evalContext);
      const results: typeof evalResult = {};
      for (const flag of flags) {
        const res = await fetch(`/api/v1/ops/feature-flags/${flag.id}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: ctx }),
        });
        const body = await res.json();
        results[flag.key] = { enabled: body.enabled, variant: body.variant, reason: body.reason };
      }
      setEvalResult(results);
    } catch {
      // ignore JSON parse errors
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Feature Flags</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage rollouts, A/B tests, and tenant targeting.{' '}
          {!isLoading && `${enabledCount}/${flags.length} enabled.`}
        </p>
      </div>

      {/* Live evaluator */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Live Evaluator
        </h2>
        <div className="flex gap-2">
          <input
            value={evalContext}
            onChange={(e) => setEvalContext(e.target.value)}
            placeholder='{"tenantId":"...","plan":"enterprise"}'
            className="flex-1 text-xs font-mono px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleEvaluateAll}
            className="text-sm px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Evaluate All
          </button>
        </div>
        {Object.keys(evalResult).length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-1.5 text-left font-medium">Flag Key</th>
                  <th className="py-1.5 text-left font-medium">Enabled</th>
                  <th className="py-1.5 text-left font-medium">Variant</th>
                  <th className="py-1.5 text-left font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {Object.entries(evalResult).map(([key, r]) => (
                  <tr key={key}>
                    <td className="py-1.5 font-mono text-zinc-700 dark:text-zinc-300">{key}</td>
                    <td
                      className={`py-1.5 font-semibold ${r.enabled ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'}`}
                    >
                      {r.enabled ? '✓ Yes' : '✗ No'}
                    </td>
                    <td className="py-1.5 text-zinc-600 dark:text-zinc-400">{r.variant}</td>
                    <td className="py-1.5 text-zinc-500">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flags list */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            All Flags ({flags.length})
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {flags.map((flag) => (
              <FeatureFlagToggle key={flag.id} flag={flag} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
