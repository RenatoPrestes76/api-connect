'use client';

import { useState } from 'react';
import { useAuditLogs } from '@/hooks/use-governance';
import { AuditTrail } from '@/components/governance/AuditTrail';
import { governanceService } from '@/services/governance.service';

export default function GovernanceAuditPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useAuditLogs({
    action: actionFilter || undefined,
    tenantId: tenantFilter || undefined,
    limit: 100,
  });

  const logs = data?.logs ?? [];

  async function handleExport(format: 'json' | 'csv' | 'pdf') {
    setExporting(true);
    try {
      const result = (await governanceService.exportAudit(format)) as any;
      if (format === 'csv' && result.data) {
        const blob = new Blob([result.data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-export-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(`Export ready: ${result.total} records (${format.toUpperCase()})`);
      }
    } catch {
      alert('Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Governance Audit Trail
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Immutable audit log with digital signatures — TITAN
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['json', 'csv', 'pdf'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              disabled={exporting}
              className="text-xs border border-zinc-200 dark:border-zinc-600 hover:border-indigo-400 text-zinc-600 dark:text-zinc-300 rounded px-3 py-1.5 transition-colors uppercase"
            >
              Export {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          placeholder="Filter by action (e.g. policy.updated)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 w-64"
        />
        <input
          placeholder="Filter by tenant ID"
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="text-xs border border-zinc-200 dark:border-zinc-600 rounded px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 w-56"
        />
        {(actionFilter || tenantFilter) && (
          <button
            onClick={() => {
              setActionFilter('');
              setTenantFilter('');
            }}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-zinc-400">{logs.length} records</span>
      </div>

      {isLoading ? <p className="text-zinc-400 text-sm">Loading…</p> : <AuditTrail logs={logs} />}
    </div>
  );
}
