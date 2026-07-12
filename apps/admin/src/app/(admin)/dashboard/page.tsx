'use client';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { Building2, Landmark, Layers, Plug, Rocket, ServerCog, ToggleLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingCard } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { useDashboard } from '@/hooks/use-dashboard';

const ACTION_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  LOGIN: 'success',
  LOGOUT: 'default',
  LOGIN_FAILED: 'danger',
  ACCOUNT_LOCKED: 'danger',
};

export default function DashboardPage(): ReactElement {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Visão geral global do Atlas Control Plane." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <LoadingCard key={i} rows={2} />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Visão geral global do Atlas Control Plane." />
        <ErrorState message="Falha ao carregar o dashboard" onRetry={() => void refetch()} />
      </div>
    );
  }

  const { summary, recentAudit } = data;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Visão geral global do Atlas Control Plane." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Tenants" value={summary.tenants} icon={Landmark} />
        <StatCard title="Organizations" value={summary.organizations} icon={Building2} />
        <StatCard title="Ambientes" value={summary.environments} icon={Layers} />
        <StatCard
          title="Runtimes online"
          value={`${summary.runtimesOnline}/${summary.runtimesTotal}`}
          icon={ServerCog}
          variant={summary.runtimesOnline === summary.runtimesTotal ? 'success' : 'warning'}
        />
        <StatCard title="Connectors publicados" value={summary.connectorsPublished} icon={Plug} />
        <StatCard
          title="Deployments em andamento"
          value={summary.deploymentsInProgress}
          icon={Rocket}
          variant={summary.deploymentsInProgress > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Feature flags ativas"
          value={summary.activeFeatureFlags}
          icon={ToggleLeft}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
          ) : (
            recentAudit.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={ACTION_VARIANT[entry.action] ?? 'default'}>{entry.action}</Badge>
                  <span className="text-sm text-foreground">{entry.actorEmail}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            ))
          )}
          <div className="pt-2">
            <Link href="/audit" className="text-xs font-medium text-accent hover:underline">
              Ver auditoria completa →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
