'use client';
import { usePortalConnectors } from '@/hooks/use-portal';
import { PageLoading, ErrorState } from '@/components/common/loading-state';
import type { ConnectorHealth } from '@/types/portal';
import { cn } from '@/lib/utils';

const HEALTH_STYLE: Record<ConnectorHealth, string> = {
  healthy: 'bg-green-900/40 text-green-300',
  degraded: 'bg-yellow-900/40 text-yellow-300',
  error: 'bg-red-900/40 text-red-300',
  unknown: 'bg-slate-700 text-slate-400',
};

const HEALTH_DOT: Record<ConnectorHealth, string> = {
  healthy: 'bg-green-400',
  degraded: 'bg-yellow-400',
  error: 'bg-red-400',
  unknown: 'bg-slate-500',
};

export default function ConnectorsPage() {
  const { data, isLoading, error } = usePortalConnectors();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar conectores" />;

  const { summary, connectors } = data ?? {
    summary: { total: 0, healthy: 0, degraded: 0, error: 0 },
    connectors: [],
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Status dos Conectores</h1>
        <p className="text-sm text-slate-400">
          Monitoramento em tempo real de todos os conectores instalados
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: summary.total, color: 'text-slate-200' },
          { label: 'Saudáveis', value: summary.healthy, color: 'text-green-400' },
          { label: 'Degradados', value: summary.degraded, color: 'text-yellow-400' },
          { label: 'Com Erro', value: summary.error, color: 'text-red-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3"
          >
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className={cn('mt-1 text-2xl font-bold', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {connectors.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
          >
            <span className={cn('h-2 w-2 rounded-full shrink-0', HEALTH_DOT[c.health])} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-200">{c.name}</p>
                <span className="text-xs text-slate-600">v{c.version}</span>
                <span className={cn('rounded px-1.5 py-0.5 text-xs', HEALTH_STYLE[c.health])}>
                  {c.health}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {c.type} · {c.syncCount.toLocaleString()} syncs · {c.errorCount} erros
                {c.lastSyncAt &&
                  ` · último sync: ${new Date(c.lastSyncAt).toLocaleString('pt-BR')}`}
              </p>
            </div>
          </div>
        ))}
        {connectors.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Nenhum conector instalado</p>
        )}
      </div>
    </div>
  );
}
