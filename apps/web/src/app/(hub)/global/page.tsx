'use client';

import { useState } from 'react';
import {
  useGlobalOverview,
  useRegions,
  useReplication,
  useTriggerFailover,
  useMigrateTenant,
  useSyncRegions,
} from '@/hooks/use-regions';
import { GlobalOverview } from '@/components/regions/GlobalOverview';
import { RegionMap } from '@/components/regions/RegionMap';
import { ReplicationPanel } from '@/components/regions/ReplicationPanel';
import { LatencyMonitor } from '@/components/regions/LatencyMonitor';
import { TenantPlacement } from '@/components/regions/TenantPlacement';
import { CompliancePolicies } from '@/components/regions/CompliancePolicies';
import { DataResidencyConfig } from '@/components/regions/DataResidencyConfig';
import { GlobalEventLog } from '@/components/regions/GlobalEventLog';

export default function GlobalPage() {
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const overview = useGlobalOverview();
  const regionsQ = useRegions();
  const replication = useReplication();
  const failover = useTriggerFailover();
  const migrate = useMigrateTenant();
  const sync = useSyncRegions();

  const regions = regionsQ.data?.regions ?? [];
  const repRecords = replication.data?.records ?? [];
  const repSummary = replication.data;
  const events = overview.data?.lastEvent ? [overview.data.lastEvent] : [];

  function notify(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 4_000);
  }

  function handleMigrate(tenantId: string, targetRegion: string) {
    migrate.mutate(
      { tenantId, targetRegion },
      {
        onSuccess: (r) => notify(r.message),
        onError: () => notify('Migration failed'),
      }
    );
  }

  function handleSync() {
    sync.mutate(
      { sourceRegion: 'us-east-1', targetRegion: 'eu-west-1', scope: 'full' },
      {
        onSuccess: (r) => notify(r.message),
        onError: () => notify('Sync failed'),
      }
    );
  }

  if (overview.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading Global Dashboard...</p>
      </div>
    );
  }

  if (!overview.data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">Failed to load global infrastructure data</p>
      </div>
    );
  }

  const tenantPlacements = [
    {
      tenantId: 'tenant-enterprise',
      primaryRegion: 'us-east-1',
      secondaryRegion: 'eu-west-1',
      drRegion: 'br-south-1',
      complianceRegion: 'eu-west-1',
      placement: 'optimal' as const,
    },
    {
      tenantId: 'tenant-professional',
      primaryRegion: 'br-south-1',
      secondaryRegion: 'us-east-1',
      drRegion: 'us-west-2',
      complianceRegion: 'br-south-1',
      placement: 'pinned' as const,
    },
    {
      tenantId: 'tenant-community',
      primaryRegion: 'eu-west-1',
      secondaryRegion: 'br-south-1',
      drRegion: 'us-east-1',
      complianceRegion: 'eu-west-1',
      placement: 'optimal' as const,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Global Edge</h1>
          <p className="text-sm text-zinc-400 mt-1">
            COSMOS — Multi-Region & Global Edge Infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {actionMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-3 py-1.5">
              {actionMsg}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={sync.isPending}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-md px-3 py-2 transition-colors"
          >
            {sync.isPending ? 'Syncing…' : 'Sync Regions'}
          </button>
        </div>
      </div>

      {/* Global Overview KPIs */}
      <GlobalOverview data={overview.data} />

      {/* Region Map */}
      <RegionMap regions={regions} />

      {/* Replication + Latency */}
      {repSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReplicationPanel summary={repSummary} records={repRecords} />
          <LatencyMonitor records={repRecords} />
        </div>
      )}

      {/* Tenant Placement + Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TenantPlacement placements={tenantPlacements} regions={regions} />
        <CompliancePolicies overview={overview.data} />
      </div>

      {/* Data Residency Config + Event Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataResidencyConfig
          placements={tenantPlacements}
          regions={regions}
          onMigrate={handleMigrate}
          isPending={migrate.isPending}
        />
        <GlobalEventLog events={events} />
      </div>
    </div>
  );
}
