'use client';
import { Package, CheckCircle, XCircle } from 'lucide-react';
import {
  useInstalled,
  useEnableConnector,
  useDisableConnector,
  useUninstallConnector,
} from '@/hooks/use-marketplace';
import { cn } from '@/lib/utils';

export default function InstalledPage() {
  const { data, isLoading } = useInstalled();
  const enable = useEnableConnector();
  const disable = useDisableConnector();
  const uninstall = useUninstallConnector();

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Connectors Instalados</h1>
          <p className="text-sm text-slate-400">
            {items.length} instalação{items.length !== 1 ? 'ões' : ''}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum connector instalado. Acesse o Descobrir para instalar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Connector</th>
                <th className="px-4 py-3">Versão</th>
                <th className="px-4 py-3">Sandbox</th>
                <th className="px-4 py-3">CPU / RAM</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((inst) => (
                <tr key={inst.id} className="bg-slate-900 hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{inst.connectorName}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">v{inst.version}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                    {inst.sandboxId}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {inst.resourceUsage.cpuCores} vCPU / {inst.resourceUsage.memoryMb} MB
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        inst.enabled
                          ? 'bg-green-900/40 text-green-400'
                          : 'bg-slate-800 text-slate-500'
                      )}
                    >
                      {inst.enabled ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {inst.enabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {inst.enabled ? (
                        <button
                          onClick={() => disable.mutate(inst.id)}
                          disabled={disable.isPending}
                          className="text-[11px] text-slate-400 hover:text-amber-400 transition-colors"
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          onClick={() => enable.mutate(inst.id)}
                          disabled={enable.isPending}
                          className="text-[11px] text-slate-400 hover:text-green-400 transition-colors"
                        >
                          Ativar
                        </button>
                      )}
                      <span className="text-slate-700">|</span>
                      <button
                        onClick={() => uninstall.mutate(inst.id)}
                        disabled={uninstall.isPending}
                        className="text-[11px] text-slate-400 hover:text-red-400 transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
