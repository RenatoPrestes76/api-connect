'use client';

import { useState } from 'react';
import { usePolicies, useEvaluatePolicies } from '@/hooks/use-security';

const EFFECT_COLORS = {
  ALLOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DENY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const DECISION_COLORS = {
  ALLOW: 'text-green-600 dark:text-green-400',
  DENY: 'text-red-600 dark:text-red-400',
  DEFAULT_DENY: 'text-zinc-500',
};

export default function PoliciesPage() {
  const { data, isLoading } = usePolicies();
  const evaluate = useEvaluatePolicies();
  const [role, setRole] = useState('admin');
  const [riskScore, setRiskScore] = useState('10');
  const [hour, setHour] = useState(String(new Date().getHours()));

  const policies = (data as any)?.policies ?? [];

  const handleEvaluate = () => {
    evaluate.mutate({
      tenantId: 'tenant-enterprise',
      context: { role, riskScore: Number(riskScore), hour: Number(hour) },
    });
  };

  const result = evaluate.data as any;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Access Policies</h1>
        <p className="text-sm text-zinc-500 mt-1">
          RBAC+ABAC policy engine — priority-ordered evaluation, first match wins.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Policy list */}
        <div className="lg:col-span-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Policies ({policies.length})
            </h2>
          </div>
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-left font-medium">Effect</th>
                    <th className="px-4 py-2 text-left font-medium">Priority</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {policies.map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</div>
                        <div className="text-xs text-zinc-500">{p.description}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${EFFECT_COLORS[p.effect as keyof typeof EFFECT_COLORS]}`}
                        >
                          {p.effect}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-300">
                        {p.priority}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs ${p.active ? 'text-green-600' : 'text-zinc-400'}`}
                        >
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Policy evaluator */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Policy Evaluator
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Role</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded px-3 py-1.5"
                placeholder="e.g. admin, viewer"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Risk Score</label>
              <input
                value={riskScore}
                onChange={(e) => setRiskScore(e.target.value)}
                type="number"
                min="0"
                max="100"
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded px-3 py-1.5"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Hour (0–23)</label>
              <input
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                type="number"
                min="0"
                max="23"
                className="w-full text-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded px-3 py-1.5"
              />
            </div>
            <button
              onClick={handleEvaluate}
              disabled={evaluate.isPending}
              className="w-full py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {evaluate.isPending ? 'Evaluating...' : 'Evaluate'}
            </button>
          </div>

          {result && (
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Decision</span>
                <span
                  className={`text-sm font-bold ${DECISION_COLORS[result.decision as keyof typeof DECISION_COLORS]}`}
                >
                  {result.decision}
                </span>
              </div>
              {result.matchedPolicy && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Matched</span>
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">
                    {result.matchedPolicy.name}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Evaluated</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                  {result.evaluatedCount} policies
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
