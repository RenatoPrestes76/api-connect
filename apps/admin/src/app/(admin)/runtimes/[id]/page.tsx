'use client';
import { useParams } from 'next/navigation';
import type { ReactElement } from 'react';
import {
  Cpu,
  HardDrive,
  MemoryStick,
  PlayCircle,
  PowerOff,
  RefreshCw,
  RotateCw,
  Timer,
  Trash2,
  Wifi,
} from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { RequirePermission } from '@/components/auth/require-permission';
import { useIssueRuntimeCommand, useRuntimeDetail } from '@/hooks/use-fleet';
import type { RuntimeCommandType } from '@/types/fleet';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  ONLINE: 'success',
  DEGRADED: 'warning',
  OFFLINE: 'danger',
  UNRESPONSIVE: 'danger',
  RETIRED: 'default',
};

const HEALTH_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  PASS: 'success',
  WARN: 'warning',
  FAIL: 'danger',
};

const ACTIONS: Array<{ type: RuntimeCommandType; label: string; icon: typeof RotateCw }> = [
  { type: 'RESTART', label: 'Reiniciar', icon: RotateCw },
  { type: 'UPDATE', label: 'Atualizar', icon: RefreshCw },
  { type: 'REINSTALL', label: 'Reinstalar', icon: PlayCircle },
  { type: 'SYNC_NOW', label: 'Sincronizar agora', icon: Wifi },
  { type: 'CLEAR_CACHE', label: 'Limpar cache', icon: Trash2 },
  { type: 'FORCE_HEARTBEAT', label: 'Forçar heartbeat', icon: Timer },
];

function RuntimeDetailsContent({ id }: { id: string }): ReactElement {
  const { data, isLoading, isError, refetch } = useRuntimeDetail(id);
  const issueCommand = useIssueRuntimeCommand();

  if (isLoading) return <PageLoading message="Carregando runtime…" />;
  if (isError || !data)
    return <ErrorState message="Falha ao carregar o runtime" onRetry={() => void refetch()} />;

  const { runtime, metrics, healthSnapshots, logs, commands } = data;
  const latestMetric = metrics[0];
  const latestHealth = healthSnapshots[0];
  const isRetired = runtime?.status === 'RETIRED';

  return (
    <div className="space-y-6">
      <PageHeader
        title={runtime?.name ?? 'Runtime'}
        breadcrumb={[{ label: 'Runtimes', href: '/runtimes' }, { label: runtime?.name ?? '' }]}
        description={`${runtime?.hostname ?? '—'} · ${runtime?.platform ?? '—'}/${runtime?.arch ?? '—'} · v${runtime?.version}`}
        actions={
          <Badge variant={STATUS_VARIANT[runtime?.status ?? ''] ?? 'default'}>
            {runtime?.status}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="CPU" value={latestMetric ? `${latestMetric.cpuPct}%` : '—'} icon={Cpu} />
        <StatCard
          title="RAM"
          value={latestMetric ? `${latestMetric.memPct}%` : '—'}
          icon={MemoryStick}
        />
        <StatCard
          title="Disco"
          value={latestMetric ? `${latestMetric.diskPct}%` : '—'}
          icon={HardDrive}
        />
        <StatCard
          title="Latência"
          value={latestMetric ? `${latestMetric.latencyMs}ms` : '—'}
          icon={Timer}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ações remotas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ACTIONS.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant="outline"
              size="sm"
              disabled={isRetired}
              loading={issueCommand.isPending && issueCommand.variables?.type === type}
              onClick={() => issueCommand.mutate({ runtimeId: id, type })}
            >
              <Icon className="h-4 w-4" /> {label}
            </Button>
          ))}
          {isRetired ? (
            <Button
              variant="success"
              size="sm"
              onClick={() => issueCommand.mutate({ runtimeId: id, type: 'ENABLE' })}
            >
              <PlayCircle className="h-4 w-4" /> Reabilitar
            </Button>
          ) : (
            <Button
              variant="danger-outline"
              size="sm"
              onClick={() => issueCommand.mutate({ runtimeId: id, type: 'DISABLE' })}
            >
              <PowerOff className="h-4 w-4" /> Desabilitar
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Health Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {latestHealth ? (
              latestHealth.checks.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-foreground">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.message}</span>
                    <Badge variant={HEALTH_VARIANT[c.status]}>{c.status}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados de health check.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comandos recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {commands.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum comando executado ainda.</p>
            ) : (
              commands.slice(0, 8).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-foreground">{c.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.issuedAt).toLocaleTimeString('pt-BR')}
                    </span>
                    <Badge
                      variant={
                        c.status === 'SUCCEEDED'
                          ? 'success'
                          : c.status === 'FAILED'
                            ? 'danger'
                            : 'default'
                      }
                    >
                      {c.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent className="max-h-72 space-y-1 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum log ainda.</p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex gap-2">
                <span className="shrink-0 text-muted-foreground">
                  {new Date(l.createdAt).toLocaleTimeString('pt-BR')}
                </span>
                <span
                  className={
                    l.level === 'ERROR'
                      ? 'text-danger'
                      : l.level === 'WARN'
                        ? 'text-warning'
                        : 'text-muted-foreground'
                  }
                >
                  [{l.level}]
                </span>
                <span className="text-foreground">{l.message}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RuntimeDetailsPage(): ReactElement {
  const params = useParams<{ id: string }>();
  return (
    <RequirePermission permission="runtime.read">
      <RuntimeDetailsContent id={params.id} />
    </RequirePermission>
  );
}
