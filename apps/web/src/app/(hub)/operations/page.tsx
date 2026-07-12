'use client';

import { useState } from 'react';
import { useOperationsOverview, useOperationsHealth, useRunAction } from '@/hooks/use-operations';
import { HealthOverview } from '@/components/operations/HealthOverview';
import { TenantGrid } from '@/components/operations/TenantGrid';
import { AgentStatus } from '@/components/operations/AgentStatus';
import { ConnectorHealth } from '@/components/operations/ConnectorHealth';
import { RecentFailures } from '@/components/operations/RecentFailures';
import { ApiUsage } from '@/components/operations/ApiUsage';
import { QueueMonitor } from '@/components/operations/QueueMonitor';
import { SlaCard } from '@/components/operations/SlaCard';
import { AlertCenter } from '@/components/operations/AlertCenter';
import { LiveEvents } from '@/components/operations/LiveEvents';

export default function OperationsPage() {
  const overview = useOperationsOverview();
  const health = useOperationsHealth();
  const runAction = useRunAction();
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const tenants = health.data?.tenants ?? [];

  function handleRestart(tenantId: string, agentId: string) {
    runAction.mutate(
      { action: 'restart-agent', payload: { tenantId, agentId } },
      {
        onSuccess: (r) => setActionMsg(r.message),
        onError: () => setActionMsg('Restart failed'),
      }
    );
  }

  function handleRetry(tenantId: string, connectorId: string) {
    runAction.mutate(
      { action: 'retry', payload: { tenantId, connectorId } },
      {
        onSuccess: (r) => setActionMsg(r.message),
        onError: () => setActionMsg('Retry failed'),
      }
    );
  }

  function handleRunHealth() {
    runAction.mutate(
      { action: 'run-health', payload: {} },
      {
        onSuccess: (r) => setActionMsg(r.message),
      }
    );
  }

  if (overview.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading Operations Center...</p>
      </div>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">Failed to load operations data</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Operations Center</h1>
          <p className="text-sm text-zinc-400 mt-1">AURORA — Enterprise NOC Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          {actionMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-3 py-1.5">
              {actionMsg}
            </span>
          )}
          <button
            onClick={handleRunHealth}
            disabled={runAction.isPending}
            className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Run Health Check
          </button>
        </div>
      </div>

      {/* KPI row */}
      <HealthOverview data={overview.data} />

      {/* Tenant grid */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          Tenant Health
        </h2>
        <TenantGrid tenants={overview.data.tenants} />
      </section>

      {/* Agents + Connectors side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgentStatus tenants={tenants} onRestart={handleRestart} />
        <ConnectorHealth tenants={tenants} onRetry={handleRetry} />
      </div>

      {/* Failures + Queue + SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentFailures alerts={overview.data.tenants.flatMap(() => [])} />
        </div>
        <QueueMonitor tenants={tenants} />
      </div>

      {/* Metrics (first tenant) */}
      {tenants[0] && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Metrics
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {tenants.map((t) => (
              <ApiUsage
                key={t.tenantId}
                metrics={t.checks.map((c) => ({
                  id: c.id,
                  tenantId: c.tenantId,
                  metric: c.componentType,
                  value:
                    c.status === 'healthy'
                      ? 100
                      : c.status === 'warning'
                        ? 70
                        : c.status === 'critical'
                          ? 30
                          : 0,
                  unit: '%',
                  timestamp: c.checkedAt,
                }))}
                tenantName={t.tenantName}
              />
            ))}
          </div>
        </section>
      )}

      {/* SLA + Alert Center + Live Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SlaCard />
        <div className="lg:col-span-1">
          <AlertCenter />
        </div>
        <LiveEvents />
      </div>
    </div>
  );
}
