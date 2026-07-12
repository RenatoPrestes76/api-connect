'use client';

import { useState } from 'react';
import {
  usePolicies,
  useChanges,
  useRisks,
  useAuditLogs,
  useComplianceStatus,
  useApproveChange,
  useRejectChange,
} from '@/hooks/use-governance';
import { GovernanceKpis } from '@/components/governance/GovernanceKpis';
import { PolicyCenter } from '@/components/governance/PolicyCenter';
import { ComplianceStatus } from '@/components/governance/ComplianceStatus';
import { RiskRegister } from '@/components/governance/RiskRegister';
import { ChangeManagement } from '@/components/governance/ChangeManagement';
import { AuditTrail } from '@/components/governance/AuditTrail';
import { ApprovalQueue } from '@/components/governance/ApprovalQueue';
import type { GovernanceOverview } from '@/types/governance';

export default function GovernancePage() {
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const policies = usePolicies();
  const changes = useChanges();
  const risks = useRisks();
  const auditLogs = useAuditLogs({ limit: 20 });
  const compliance = useComplianceStatus();
  const approve = useApproveChange();
  const reject = useRejectChange();

  const allPolicies = policies.data?.policies ?? [];
  const allChanges = changes.data?.changes ?? [];
  const allRisks = risks.data?.risks ?? [];
  const allLogs = auditLogs.data?.logs ?? [];
  const compData = compliance.data;
  const pendingChanges = allChanges.filter((c) => c.status === 'pending');

  function notify(msg: string) {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 4_000);
  }

  function handleApprove(id: string) {
    approve.mutate(
      { id, payload: { approverName: 'Admin', notes: 'Approved via Governance Center' } },
      {
        onSuccess: (r) => notify(`Change "${r.title}" approved`),
        onError: () => notify('Approval failed'),
      }
    );
  }

  function handleReject(id: string, reason: string) {
    reject.mutate(
      { id, payload: { rejectorName: 'Admin', reason } },
      {
        onSuccess: (r) => notify(`Change "${r.title}" rejected`),
        onError: () => notify('Rejection failed'),
      }
    );
  }

  const overview: GovernanceOverview = {
    activePolicies: allPolicies.filter((p) => p.enabled).length,
    totalPolicies: allPolicies.length,
    openChanges: allChanges.filter(
      (c) => !['completed', 'rejected', 'rolled_back'].includes(c.status)
    ).length,
    pendingApprovals: pendingChanges.length,
    openRisks: allRisks.filter((r) => r.status === 'open' || r.status === 'mitigating').length,
    criticalRisks: allRisks.filter((r) => r.severity === 'critical').length,
    auditLogsToday: allLogs.filter((l) => {
      const d = new Date(l.createdAt);
      const n = new Date();
      return d.toDateString() === n.toDateString();
    }).length,
    overallComplianceScore: compData?.overallScore ?? 0,
  };

  if (policies.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading Governance Center…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Governance Center</h1>
          <p className="text-sm text-zinc-400 mt-1">TITAN — Enterprise Governance & Compliance</p>
        </div>
        {actionMsg && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-3 py-1.5">
            {actionMsg}
          </span>
        )}
      </div>

      {/* KPIs */}
      <GovernanceKpis data={overview} />

      {/* Compliance + Approval Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {compData && (
          <ComplianceStatus overallScore={compData.overallScore} frameworks={compData.frameworks} />
        )}
        <ApprovalQueue
          pending={pendingChanges}
          onApprove={handleApprove}
          onReject={handleReject}
          isPending={approve.isPending || reject.isPending}
        />
      </div>

      {/* Policy Center + Risk Register */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PolicyCenter policies={allPolicies} />
        <RiskRegister risks={allRisks} />
      </div>

      {/* Change Management + Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChangeManagement changes={allChanges} />
        <AuditTrail logs={allLogs} />
      </div>
    </div>
  );
}
