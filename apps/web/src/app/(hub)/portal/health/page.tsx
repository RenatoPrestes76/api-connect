'use client';
import { useQuery } from '@tanstack/react-query';
import { HeartPulse, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api-client';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { cn } from '@/lib/utils';

interface HealthResponse {
  status: string;
  version: string;
  uptime: number;
  checks: { database: string; memory: string };
  timestamp: string;
}
interface ReadyResponse {
  status: string;
  checks: { database: string; cache: string; queues: string };
  timestamp: string;
}
interface LiveResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <AlertTriangle className="h-4 w-4 text-slate-500" />;
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  ) : (
    <XCircle className="h-4 w-4 text-red-400" />
  );
}

function isOk(status: string): boolean {
  return status === 'ok' || status === 'alive' || status === 'ready' || status === 'healthy';
}

export default function GatewayHealthPage() {
  const live = useQuery({
    queryKey: ['gateway', 'health', 'live'],
    queryFn: () => api.get<LiveResponse>('/live'),
    refetchInterval: 10_000,
  });
  const ready = useQuery({
    queryKey: ['gateway', 'health', 'ready'],
    queryFn: () => api.get<ReadyResponse>('/ready'),
    refetchInterval: 10_000,
  });
  const health = useQuery({
    queryKey: ['gateway', 'health', 'health'],
    queryFn: () => api.get<HealthResponse>('/health'),
    refetchInterval: 10_000,
  });

  if (live.isLoading || ready.isLoading || health.isLoading) return <PageLoading />;
  if (live.error || ready.error || health.error) {
    return <ErrorState message="Erro ao consultar a saúde da plataforma" />;
  }

  const checks = [
    { label: 'API', ok: live.data ? isOk(live.data.status) : null },
    { label: 'Banco de dados', ok: ready.data ? isOk(ready.data.checks.database) : null },
    {
      label: 'Cache',
      ok: ready.data?.checks.cache === 'not_configured' ? null : ready.data?.checks.cache === 'ok',
    },
    {
      label: 'Filas',
      ok:
        ready.data?.checks.queues === 'not_configured' ? null : ready.data?.checks.queues === 'ok',
    },
  ];

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Saúde da Plataforma</h1>
          <p className="text-sm text-slate-400">/health · /ready · /live — atualiza a cada 10s</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 p-4"
          >
            <StatusIcon ok={c.ok} />
            <div>
              <p className="text-sm font-medium text-slate-200">{c.label}</p>
              <p className="text-xs text-slate-500">
                {c.ok === null ? 'não configurado' : c.ok ? 'ok' : 'com problema'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-slate-500">Status geral</span>
          <span
            className={cn(
              'font-medium',
              health.data?.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'
            )}
          >
            {health.data?.status}
          </span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-500">Versão</span>
          <span className="font-mono text-slate-300">{health.data?.version}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-500">Uptime</span>
          <span className="font-mono text-slate-300">
            {Math.floor((live.data?.uptime ?? 0) / 60)} min
          </span>
        </div>
      </div>
    </div>
  );
}
