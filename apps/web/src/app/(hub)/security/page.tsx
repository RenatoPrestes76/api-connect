'use client';

import { useSecurityDashboard, useRiskEvents, useCertificates } from '@/hooks/use-security';
import { RiskBadge } from '@/components/security/risk-badge';
import { CertCard } from '@/components/security/cert-card';

const COMPLIANCE_COLORS = {
  compliant: 'text-green-600 dark:text-green-400',
  partial: 'text-amber-600 dark:text-amber-400',
  non_compliant: 'text-red-600 dark:text-red-400',
  not_assessed: 'text-zinc-400',
};

const COMPLIANCE_LABELS = {
  compliant: '✓ Compliant',
  partial: '~ Partial',
  non_compliant: '✗ Non-compliant',
  not_assessed: '— Not assessed',
};

function KpiTile({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${accent ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SecurityDashboardPage() {
  const { data: dashboard, isLoading } = useSecurityDashboard();
  const { data: riskData } = useRiskEvents();
  const { data: certData } = useCertificates();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const d = dashboard as any;
  const topRisk = (riskData as any)?.events?.filter((e: any) => !e.resolved).slice(0, 5) ?? [];
  const certs = (certData as any)?.certificates ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Security & Compliance
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Real-time security posture, risk events, and compliance status.
        </p>
      </div>

      {/* Critical alerts */}
      {d?.criticalAlerts?.length > 0 && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 p-4">
          <div className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
            Critical Alerts
          </div>
          <ul className="space-y-1">
            {d.criticalAlerts.map((alert: string, i: number) => (
              <li
                key={i}
                className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"
              >
                <span>⚠</span> {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Events Today" value={d?.eventsToday ?? 0} />
        <KpiTile
          label="Failed Auth 24h"
          value={d?.failedAuthLast24h ?? 0}
          accent={(d?.failedAuthLast24h ?? 0) > 0}
        />
        <KpiTile label="MFA Adoption" value={`${d?.mfaAdoptionPct ?? 0}%`} />
        <KpiTile label="Active Policies" value={d?.activePolicies ?? 0} />
        <KpiTile label="Risk Events (7d)" value={d?.riskEventsLast7d ?? 0} />
        <KpiTile
          label="Certs Expiring"
          value={d?.certsExpiringSoon ?? 0}
          accent={(d?.certsExpiringSoon ?? 0) > 0}
          sub="within 30 days"
        />
        <KpiTile label="Suspicious Logins" value={d?.suspiciousLogins ?? 0} />
        <KpiTile
          label="Risk Score"
          value={d?.riskScores?.[0]?.score ?? 0}
          sub={d?.riskScores?.[0]?.level}
        />
      </div>

      {/* Two columns: Compliance + Certs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance status */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Compliance Frameworks
            </h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {Object.entries(d?.compliance ?? {}).map(([fw, status]: [string, any]) => (
              <div
                key={fw}
                className="flex items-center justify-between py-2 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
              >
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{fw}</span>
                <span
                  className={`text-xs font-medium ${COMPLIANCE_COLORS[status as keyof typeof COMPLIANCE_COLORS] ?? 'text-zinc-400'}`}
                >
                  {COMPLIANCE_LABELS[status as keyof typeof COMPLIANCE_LABELS] ?? status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Certificates */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Certificate Lifecycle
            </h2>
          </div>
          <div className="p-4 grid grid-cols-1 gap-3">
            {certs.slice(0, 4).map((cert: any) => (
              <CertCard key={cert.id} cert={cert} />
            ))}
          </div>
        </div>
      </div>

      {/* Active risk events */}
      {topRisk.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Active Risk Events
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-left font-medium">Level</th>
                  <th className="px-4 py-2 text-left font-medium">Detected</th>
                </tr>
              </thead>
              <tbody>
                {topRisk.map((event: any) => (
                  <tr
                    key={event.id}
                    className="border-b border-zinc-50 dark:border-zinc-800 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {event.description}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {event.actor} · {event.ip}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={event.level} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(event.detectedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
