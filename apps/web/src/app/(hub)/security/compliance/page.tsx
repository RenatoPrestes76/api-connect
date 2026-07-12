'use client';

import { useCompliance, useConsent } from '@/hooks/use-security';

const STATUS_COLORS = {
  compliant: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  partial: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  non_compliant: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  not_assessed: 'text-zinc-500 bg-zinc-50 dark:bg-zinc-800',
};

const STATUS_LABELS = {
  compliant: '✓ Compliant',
  partial: '~ Partial',
  non_compliant: '✗ Non-compliant',
  not_assessed: '— Not assessed',
};

const FRAMEWORK_ORDER = ['LGPD', 'GDPR', 'SOC2', 'ISO27001'];

export default function CompliancePage() {
  const { data: complianceData, isLoading } = useCompliance();
  const { data: consentData } = useConsent();

  const controls = (complianceData as any)?.controls ?? [];
  const summary = (complianceData as any)?.summary ?? [];
  const consentRecords = (consentData as any)?.records ?? [];

  const byFramework = FRAMEWORK_ORDER.reduce<Record<string, typeof controls>>((acc, fw) => {
    acc[fw] = controls.filter((c: any) => c.framework === fw);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Compliance & Data Protection
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          LGPD, GDPR, SOC2, ISO27001 compliance controls and consent management.
        </p>
      </div>

      {/* Framework summary */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summary.map((fw: any) => (
            <div
              key={fw.framework}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4"
            >
              <div className="text-xs font-bold text-zinc-500 uppercase">{fw.framework}</div>
              <div className="mt-2 text-sm font-semibold text-green-600 dark:text-green-400">
                {fw.compliant} compliant
              </div>
              {fw.partial > 0 && <div className="text-xs text-amber-500">{fw.partial} partial</div>}
              {fw.nonCompliant > 0 && (
                <div className="text-xs text-red-500">{fw.nonCompliant} non-compliant</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Controls by framework */}
      <div className="space-y-6">
        {FRAMEWORK_ORDER.filter((fw) => byFramework[fw]?.length > 0).map((fw) => (
          <div
            key={fw}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          >
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{fw}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-4 py-2 text-left font-medium">Control</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Evidence</th>
                    <th className="px-4 py-2 text-left font-medium">Last Assessed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {byFramework[fw]?.map((c: any) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">
                          {c.control}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">{c.description}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[c.status as keyof typeof STATUS_COLORS]}`}
                        >
                          {STATUS_LABELS[c.status as keyof typeof STATUS_LABELS] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs">{c.evidence}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                        {new Date(c.lastAssessedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Consent records */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Consent Management ({consentRecords.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-4 py-2 text-left font-medium">User</th>
                <th className="px-4 py-2 text-left font-medium">Purpose</th>
                <th className="px-4 py-2 text-left font-medium">Framework</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {consentRecords.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">{r.userId}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.purpose.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-zinc-500">{r.framework}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${r.granted ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}
                    >
                      {r.granted ? 'Granted' : 'Revoked'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {r.grantedAt
                      ? new Date(r.grantedAt).toLocaleDateString()
                      : r.revokedAt
                        ? new Date(r.revokedAt).toLocaleDateString()
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
