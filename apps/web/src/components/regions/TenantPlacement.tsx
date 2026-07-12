'use client';

import type { TenantRegion, Region } from '@/types/regions';

const PLACEMENT_BADGE: Record<string, string> = {
  optimal: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
  pinned: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  migrating: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
};

interface Props {
  placements: TenantRegion[];
  regions: Region[];
}

export function TenantPlacement({ placements, regions }: Props) {
  function flagFor(code: string): string {
    return regions.find((r) => r.code === code)?.flag ?? '🌐';
  }

  function nameFor(code: string): string {
    return regions.find((r) => r.code === code)?.name ?? code;
  }

  const tenantsByRegion: Record<string, string[]> = {};
  for (const p of placements) {
    const key = p.primaryRegion;
    if (!tenantsByRegion[key]) tenantsByRegion[key] = [];
    tenantsByRegion[key]!.push(p.tenantId.replace('tenant-', ''));
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Tenant Placement</h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Primary region per tenant with DR assignments
        </p>
      </div>

      {/* By region summary */}
      <div className="px-4 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-500 mb-2">Distribution</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(tenantsByRegion).map(([code, tenants]) => (
            <span
              key={code}
              className="flex items-center gap-1.5 text-xs bg-zinc-50 dark:bg-zinc-800 rounded px-2 py-1"
            >
              <span>{flagFor(code)}</span>
              <span className="text-zinc-600 dark:text-zinc-300">{nameFor(code)}</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                ×{tenants.length}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {placements.map((p) => (
          <div key={p.tenantId} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 capitalize">
                  {p.tenantId.replace('tenant-', '')}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PLACEMENT_BADGE[p.placement] ?? ''}`}
                >
                  {p.placement}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
              <div>
                <p className="text-zinc-400 mb-0.5">Primary</p>
                <span className="flex items-center gap-1">
                  <span>{flagFor(p.primaryRegion)}</span>
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                    {p.primaryRegion}
                  </span>
                </span>
              </div>
              <div>
                <p className="text-zinc-400 mb-0.5">Secondary</p>
                <span className="flex items-center gap-1">
                  <span>{flagFor(p.secondaryRegion)}</span>
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">
                    {p.secondaryRegion}
                  </span>
                </span>
              </div>
              <div>
                <p className="text-zinc-400 mb-0.5">DR Region</p>
                <span className="flex items-center gap-1">
                  <span>{flagFor(p.drRegion)}</span>
                  <span className="font-mono text-zinc-600 dark:text-zinc-400">{p.drRegion}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
