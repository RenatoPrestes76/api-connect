'use client';
import { useAuditLog } from '@/hooks/use-portal';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';

export default function PortalAuditPage() {
  const { data, isLoading, error } = useAuditLog(100);

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar auditoria" />;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Auditoria</h1>
        <p className="text-sm text-slate-400">{data?.total ?? 0} eventos registrados</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              {['Ação', 'Ator', 'Alvo', 'Data'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(data?.entries ?? []).map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-300">{entry.action}</td>
                <td className="px-4 py-2.5 text-slate-400">{entry.actorEmail}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{entry.target ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">
                  {new Date(entry.createdAt).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
