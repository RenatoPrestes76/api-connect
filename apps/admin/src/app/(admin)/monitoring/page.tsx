'use client';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, Rocket, ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingCard } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { RequirePermission } from '@/components/auth/require-permission';
import { useFleetOverview } from '@/hooks/use-fleet';
import { useAlerts } from '@/hooks/use-alerts';
import { useDeploymentJobs } from '@/hooks/use-deployment-jobs';
import { useAuditLog } from '@/hooks/use-audit-log';

const SEVERITY_VARIANT: Record<string, 'default' | 'warning' | 'danger'> = {
  INFO: 'default',
  WARNING: 'warning',
  CRITICAL: 'danger',
};
const JOB_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  SUCCEEDED: 'success',
  IN_PROGRESS: 'warning',
  FAILED: 'danger',
  PENDING_APPROVAL: 'warning',
};

function OperationsDashboardContent(): ReactElement {
  const { data: fleet, isLoading, isError, refetch } = useFleetOverview();
  const { data: alerts } = useAlerts({ status: 'ACTIVE' });
  const { data: jobs } = useDeploymentJobs();
  const { data: auditEntries } = useAuditLog(8);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Operations Dashboard"
          description="Visão consolidada de operações do Control Plane."
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingCard key={i} rows={2} />
          ))}
        </div>
      </div>
    );
  }
  if (isError || !fleet) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Operations Dashboard"
          description="Visão consolidada de operações do Control Plane."
        />
        <ErrorState message="Falha ao carregar" onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description="Visão consolidada de operações do Control Plane."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Runtimes online"
          value={`${fleet.runtimesOnline}/${fleet.runtimesTotal}`}
          icon={Activity}
        />
        <StatCard
          title="Alertas ativos"
          value={fleet.alertsActive}
          icon={AlertTriangle}
          variant={fleet.alertsCritical > 0 ? 'danger' : 'default'}
        />
        <StatCard title="Deployments" value={jobs?.length ?? 0} icon={Rocket} />
        <StatCard
          title="Eventos de auditoria"
          value={auditEntries?.length ?? 0}
          icon={ScrollText}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Alertas ativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(alerts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum alerta ativo.</p>
            ) : (
              alerts?.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <Badge variant={SEVERITY_VARIANT[a.severity]}>{a.severity}</Badge>
                  <span className="flex-1 truncate text-foreground">{a.message}</span>
                </div>
              ))
            )}
            <Link
              href="/alerts"
              className="block pt-1 text-xs font-medium text-accent hover:underline"
            >
              Ver Alert Center →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deployments recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(jobs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum deployment ainda.</p>
            ) : (
              jobs?.slice(0, 6).map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-mono text-xs text-foreground">{j.id.slice(0, 8)}</span>
                  <Badge variant={JOB_VARIANT[j.status] ?? 'default'}>{j.status}</Badge>
                </div>
              ))
            )}
            <Link
              href="/deployments"
              className="block pt-1 text-xs font-medium text-accent hover:underline"
            >
              Ver Deploy Center →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auditoria recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(auditEntries ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
            ) : (
              auditEntries?.slice(0, 6).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-foreground">{e.action}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              ))
            )}
            <Link
              href="/audit"
              className="block pt-1 text-xs font-medium text-accent hover:underline"
            >
              Ver Auditoria →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MonitoringPage(): ReactElement {
  return (
    <RequirePermission permission="dashboard.view">
      <OperationsDashboardContent />
    </RequirePermission>
  );
}
