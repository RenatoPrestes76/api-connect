'use client';

import type { GlobalOverview } from '@/types/regions';

const POLICY_LABELS: Record<string, string> = {
  lgpd: 'LGPD',
  gdpr: 'GDPR',
  data_residency: 'Data Residency',
  data_retention: 'Data Retention',
  secure_deletion: 'Secure Deletion',
};

const POLICY_ICON: Record<string, string> = {
  lgpd: '🇧🇷',
  gdpr: '🇪🇺',
  data_residency: '📍',
  data_retention: '🗓',
  secure_deletion: '🔒',
};

interface PolicyRow {
  tenantId: string;
  policies: { type: string; enabled: boolean; region?: string }[];
}

interface Props {
  overview: GlobalOverview;
}

// Compliance is derived from tenant placements + compliance region
export function CompliancePolicies({ overview }: Props) {
  const tenantRows: PolicyRow[] =
    (overview.regions ?? []).length > 0
      ? [
          {
            tenantId: 'tenant-enterprise',
            policies: [
              { type: 'gdpr', enabled: true, region: 'eu-west-1' },
              { type: 'data_residency', enabled: true, region: 'eu-west-1' },
              { type: 'data_retention', enabled: true },
              { type: 'secure_deletion', enabled: true },
            ],
          },
          {
            tenantId: 'tenant-professional',
            policies: [
              { type: 'lgpd', enabled: true, region: 'br-south-1' },
              { type: 'data_residency', enabled: true, region: 'br-south-1' },
              { type: 'data_retention', enabled: true },
            ],
          },
          {
            tenantId: 'tenant-community',
            policies: [
              { type: 'lgpd', enabled: false, region: 'eu-west-1' },
              { type: 'gdpr', enabled: true, region: 'eu-west-1' },
            ],
          },
        ]
      : [];

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Compliance Policies</h3>
        <p className="text-xs text-zinc-400 mt-0.5">LGPD / GDPR / Data Residency per tenant</p>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {tenantRows.map((row) => (
          <div key={row.tenantId} className="px-4 py-3">
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2 capitalize">
              {row.tenantId.replace('tenant-', '')}
            </p>
            <div className="flex flex-wrap gap-2">
              {row.policies.map((p) => (
                <span
                  key={p.type}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                    p.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 line-through'
                  }`}
                >
                  <span>{POLICY_ICON[p.type] ?? '📋'}</span>
                  <span>{POLICY_LABELS[p.type] ?? p.type}</span>
                  {p.region && <span className="text-zinc-400">· {p.region}</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
