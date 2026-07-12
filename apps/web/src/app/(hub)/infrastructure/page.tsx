'use client';

import { useState } from 'react';
import {
  useClusterOverview,
  useClusterNodes,
  useFailoverEvents,
  useBackups,
  useRecoveryTests,
  useCreateBackup,
  useRestore,
  useRunRecoveryTest,
  useTriggerFailover,
} from '@/hooks/use-ha';
import { ClusterStatus } from '@/components/ha/ClusterStatus';
import { NodeList } from '@/components/ha/NodeList';
import { FailoverHistory } from '@/components/ha/FailoverHistory';
import { BackupManager } from '@/components/ha/BackupManager';
import { RecoveryTests } from '@/components/ha/RecoveryTests';
import { ReplicationMonitor } from '@/components/ha/ReplicationMonitor';
import { RtoRpoMetrics } from '@/components/ha/RtoRpoMetrics';
import { HaEventLog, type HaEvent } from '@/components/ha/HaEventLog';
import type { BackupType } from '@/types/ha';

export default function InfrastructurePage() {
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const overview = useClusterOverview();
  const nodes = useClusterNodes();
  const failovers = useFailoverEvents();
  const backups = useBackups();
  const recovery = useRecoveryTests();
  const createBackup = useCreateBackup();
  const restore = useRestore();
  const runTest = useRunRecoveryTest();
  const doFailover = useTriggerFailover();

  const allNodes = nodes.data?.nodes ?? [];
  const haEvents: HaEvent[] = []; // populated via a dedicated /ha/events endpoint if extended

  function notify(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 4000);
  }

  function handleCreateBackup(tenantId: string, type: BackupType) {
    createBackup.mutate(
      { tenantId, type },
      {
        onSuccess: (b) => notify(`Backup created: ${b.sizeLabel} (${b.type})`),
        onError: () => notify('Backup failed'),
      }
    );
  }

  function handleRestore(backupId: string, tenantId: string) {
    restore.mutate(
      { backupId, tenantId },
      {
        onSuccess: (r) => notify(r.message),
        onError: () => notify('Restore failed'),
      }
    );
  }

  function handleRunTest(tenantId: string) {
    runTest.mutate(tenantId, {
      onSuccess: (t) =>
        notify(`Recovery test ${t.result}: RTO ${t.rtoSeconds}s, RPO ${t.rpoMinutes}min`),
      onError: () => notify('Recovery test failed'),
    });
  }

  if (overview.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading Infrastructure Dashboard...</p>
      </div>
    );
  }

  if (!overview.data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">Failed to load infrastructure data</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Infrastructure</h1>
          <p className="text-sm text-zinc-400 mt-1">
            NEBULA — High Availability & Disaster Recovery
          </p>
        </div>
        {actionMsg && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-3 py-1.5">
            {actionMsg}
          </span>
        )}
      </div>

      {/* Cluster KPIs + health banner */}
      <ClusterStatus data={overview.data} />

      {/* Nodes + Replication */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NodeList nodes={allNodes} />
        <ReplicationMonitor nodes={allNodes} />
      </div>

      {/* Failover History */}
      <FailoverHistory events={failovers.data?.events ?? []} />

      {/* Backup Manager + Recovery Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BackupManager
          backups={backups.data?.backups ?? []}
          totalSizeBytes={backups.data?.totalSizeBytes ?? 0}
          onCreateBackup={handleCreateBackup}
          onRestore={handleRestore}
          isPending={createBackup.isPending || restore.isPending}
        />
        <RecoveryTests
          tests={recovery.data?.tests ?? []}
          rtoByTenant={recovery.data?.rtoByTenant ?? {}}
          rpoByTenant={recovery.data?.rpoByTenant ?? {}}
          onRunTest={handleRunTest}
          isPending={runTest.isPending}
        />
      </div>

      {/* RTO/RPO + Event Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RtoRpoMetrics
          rtoByTenant={recovery.data?.rtoByTenant ?? {}}
          rpoByTenant={recovery.data?.rpoByTenant ?? {}}
          avgRtoSeconds={overview.data.avgRtoSeconds}
          avgRpoMinutes={overview.data.avgRpoMinutes}
        />
        <HaEventLog events={haEvents} />
      </div>
    </div>
  );
}
