'use client';

import { useState } from 'react';
import type { TenantRegion, Region } from '@/types/regions';

interface Props {
  placements: TenantRegion[];
  regions: Region[];
  onMigrate?: (tenantId: string, targetRegion: string) => void;
  isPending?: boolean;
}

export function DataResidencyConfig({ placements, regions, onMigrate, isPending }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});

  function flagFor(code: string): string {
    return regions.find((r) => r.code === code)?.flag ?? '🌐';
  }

  function handleMigrate(tenantId: string) {
    const target = selected[tenantId];
    if (target && onMigrate) onMigrate(tenantId, target);
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Data Residency Config</h3>
        <p className="text-xs text-zinc-400 mt-0.5">Configure primary region per tenant</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {placements.map((p) => (
          <div key={p.tenantId} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 capitalize">
                {p.tenantId.replace('tenant-', '')}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Current: {flagFor(p.primaryRegion)} {p.primaryRegion} · Compliance:{' '}
                {flagFor(p.complianceRegion)} {p.complianceRegion}
              </p>
            </div>
            <select
              className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
              value={selected[p.tenantId] ?? ''}
              onChange={(e) => setSelected((prev) => ({ ...prev, [p.tenantId]: e.target.value }))}
            >
              <option value="">Migrate to…</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code} disabled={r.code === p.primaryRegion}>
                  {r.flag} {r.name} ({r.code})
                </option>
              ))}
            </select>
            <button
              onClick={() => handleMigrate(p.tenantId)}
              disabled={!selected[p.tenantId] || isPending}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded px-3 py-1.5 transition-colors shrink-0"
            >
              Migrate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
