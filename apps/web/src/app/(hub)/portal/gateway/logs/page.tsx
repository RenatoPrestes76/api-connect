'use client';
import { useApiLogs } from '@/hooks/use-gateway';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { cn } from '@/lib/utils';

function statusColor(status: number): string {
  if (status >= 500) return 'text-red-400';
  if (status >= 429) return 'text-amber-400';
  if (status >= 400) return 'text-orange-400';
  if (status >= 200) return 'text-emerald-400';
  return 'text-slate-400';
}

export default function ApiLogsPage() {
  const { data, isLoading, error } = useApiLogs(200);

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar logs de API" />;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Logs de API</h1>
        <p className="text-sm text-slate-400">
          {data?.total ?? 0} requisições registradas (atualiza a cada 15s)
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              {['Método', 'Endpoint', 'Ator', 'IP', 'Status', 'Tempo', 'Data'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(data?.entries ?? []).map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2 font-mono text-xs text-slate-300">{entry.method}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-400">{entry.endpoint}</td>
                <td className="px-4 py-2 text-xs text-slate-400">
                  {entry.actorLabel}
                  <span className="ml-1 text-slate-600">({entry.actorType})</span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{entry.ip}</td>
                <td className={cn('px-4 py-2 text-xs font-medium', statusColor(entry.statusCode))}>
                  {entry.statusCode}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">{entry.responseTimeMs}ms</td>
                <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.entries.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Nenhuma requisição registrada</p>
        )}
      </div>
    </div>
  );
}
