'use client';

import { useState } from 'react';
import { useComplianceStatus, useComplianceEvidence } from '@/hooks/use-governance';
import { ComplianceStatus } from '@/components/governance/ComplianceStatus';
import { ComplianceEvidence } from '@/components/governance/ComplianceEvidence';

const FRAMEWORKS = ['', 'iso27001', 'soc2', 'lgpd', 'gdpr', 'nist', 'cis'];
const FW_LABELS: Record<string, string> = {
  '': 'All Frameworks',
  iso27001: 'ISO 27001',
  soc2: 'SOC 2',
  lgpd: 'LGPD',
  gdpr: 'GDPR',
  nist: 'NIST CSF',
  cis: 'CIS Controls',
};

export default function CompliancePage() {
  const [framework, setFramework] = useState('');
  const [evidenceStatus, setEvidenceStatus] = useState('');

  const compliance = useComplianceStatus();
  const evidence = useComplianceEvidence({
    framework: framework || undefined,
    status: evidenceStatus || undefined,
  });

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Compliance</h1>
        <p className="text-sm text-zinc-400 mt-1">
          ISO 27001 · SOC 2 · LGPD · GDPR · NIST · CIS Controls
        </p>
      </div>

      {/* Framework status */}
      {compliance.data && (
        <ComplianceStatus
          overallScore={compliance.data.overallScore}
          frameworks={compliance.data.frameworks}
        />
      )}

      {/* Evidence filters + table */}
      <div>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
          >
            {FRAMEWORKS.map((fw) => (
              <option key={fw} value={fw}>
                {FW_LABELS[fw] ?? fw}
              </option>
            ))}
          </select>
          <select
            value={evidenceStatus}
            onChange={(e) => setEvidenceStatus(e.target.value)}
            className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
          >
            <option value="">All Status</option>
            <option value="valid">Valid</option>
            <option value="expired">Expired</option>
            <option value="pending">Pending</option>
          </select>
          <span className="text-xs text-zinc-400">
            {evidence.data?.total ?? 0} evidence records
          </span>
        </div>
        <ComplianceEvidence evidence={evidence.data?.evidence ?? []} />
      </div>
    </div>
  );
}
