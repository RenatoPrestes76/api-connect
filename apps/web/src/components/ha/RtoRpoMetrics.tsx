'use client';

const TENANT_LABELS: Record<string, string> = {
  'tenant-enterprise': 'Omega Corp',
  'tenant-professional': 'Beta Systems',
  'tenant-community': 'Gamma Startup',
};

const RTO_TARGETS: Record<string, number> = {
  'tenant-enterprise': 30,
  'tenant-professional': 60,
  'tenant-community': 300,
};

const RPO_TARGETS: Record<string, number> = {
  'tenant-enterprise': 15,
  'tenant-professional': 30,
  'tenant-community': 120,
};

interface Props {
  rtoByTenant: Record<string, number>;
  rpoByTenant: Record<string, number>;
  avgRtoSeconds: number;
  avgRpoMinutes: number;
}

export function RtoRpoMetrics({ rtoByTenant, rpoByTenant, avgRtoSeconds, avgRpoMinutes }: Props) {
  const tenants = Object.keys(rtoByTenant);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">RTO / RPO per Tenant</h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Avg RTO:{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{avgRtoSeconds}s</span>
          {' · '}
          Avg RPO:{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{avgRpoMinutes}min</span>
        </p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {tenants.map((tid) => {
          const rto = rtoByTenant[tid] ?? 0;
          const rpo = rpoByTenant[tid] ?? 0;
          const rtoTarget = RTO_TARGETS[tid] ?? 60;
          const rpoTarget = RPO_TARGETS[tid] ?? 30;
          const rtoMet = rto <= rtoTarget;
          const rpoMet = rpo <= rpoTarget;

          return (
            <div key={tid} className="px-4 py-3">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                {TENANT_LABELS[tid] ?? tid}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-400">RTO</span>
                    <span className="text-zinc-400">target ≤{rtoTarget}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-lg font-bold tabular-nums ${rtoMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {rto}s
                    </p>
                    <span
                      className={`text-xs font-medium ${rtoMet ? 'text-emerald-500' : 'text-red-500'}`}
                    >
                      {rtoMet ? '✓ Met' : '✗ Missed'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-400">RPO</span>
                    <span className="text-zinc-400">target ≤{rpoTarget}min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-lg font-bold tabular-nums ${rpoMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {rpo}min
                    </p>
                    <span
                      className={`text-xs font-medium ${rpoMet ? 'text-emerald-500' : 'text-red-500'}`}
                    >
                      {rpoMet ? '✓ Met' : '✗ Missed'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {tenants.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">
            No recovery test data yet
          </div>
        )}
      </div>
    </div>
  );
}
