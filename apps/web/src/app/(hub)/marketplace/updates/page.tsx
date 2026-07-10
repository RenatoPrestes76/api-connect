'use client';
import { ArrowUpCircle, RefreshCw } from 'lucide-react';
import { useUpdates, useUpdateConnector } from '@/hooks/use-marketplace';

export default function UpdatesPage() {
  const { data, isLoading } = useUpdates();
  const update = useUpdateConnector();

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Atualizações Disponíveis</h1>
          <p className="text-sm text-slate-400">
            {items.length > 0
              ? `${items.length} atualização${items.length !== 1 ? 'ões' : ''} disponível${items.length !== 1 ? 'is' : ''}`
              : 'Tudo atualizado'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Verificando atualizações…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="font-medium text-slate-300">Todos os connectors estão atualizados</p>
          <p className="text-sm mt-1">Verifique novamente mais tarde</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(({ installation: inst, latestVersion }) => (
            <div
              key={inst.id}
              className="rounded-lg border border-amber-800/30 bg-amber-900/10 p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-white">{inst.connectorName}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  v{inst.version} <span className="text-amber-400">→ v{latestVersion}</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Sandbox: {inst.sandboxId}</p>
              </div>
              <button
                onClick={() => update.mutate({ installationId: inst.id, version: latestVersion })}
                disabled={update.isPending}
                className="flex items-center gap-1.5 rounded bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {update.isPending ? 'Atualizando…' : 'Atualizar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
