'use client';

import type { SelfHealingRule } from '@/types/prometheus';

const TRIGGER_LABEL: Record<string, string> = {
  agent_down: 'Agent Down',
  high_error_rate: 'High Error Rate',
  memory_leak: 'Memory Leak',
  connector_timeout: 'Connector Timeout',
  worker_overload: 'Worker Overload',
};

const ACTION_LABEL: Record<string, string> = {
  restart_service: 'Restart Service',
  migrate_agent: 'Migrate Agent',
  scale_up: 'Scale Up',
  failover: 'Failover',
  clear_cache: 'Clear Cache',
};

interface Props {
  rules: SelfHealingRule[];
  enabled: number;
  onToggle?: (id: string) => void;
  isPending?: boolean;
}

export function SelfHealingPanel({ rules, enabled, onToggle, isPending }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Self-Healing Engine</h3>
        <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-full px-2 py-0.5">
          {enabled}/{rules.length} active
        </span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rules.map((r) => (
          <div key={r.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {r.name}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                {TRIGGER_LABEL[r.trigger]} → {ACTION_LABEL[r.action]}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-400">
                <span>Executions: {r.executionCount}</span>
                {r.executionCount > 0 && <span>Success: {r.successRate.toFixed(0)}%</span>}
                {r.lastTriggeredAt && (
                  <span>Last: {new Date(r.lastTriggeredAt).toLocaleTimeString()}</span>
                )}
              </div>
            </div>
            {onToggle && (
              <button
                onClick={() => onToggle(r.id)}
                disabled={isPending}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${r.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${r.enabled ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            )}
          </div>
        ))}
        {rules.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-400">No rules configured</p>
        )}
      </div>
    </div>
  );
}
