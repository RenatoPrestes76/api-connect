'use client';
import { useState } from 'react';
import { Blocks } from 'lucide-react';
import { useConnectorCatalog } from '@/hooks/use-portal';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { ConnectorCatalogCategory } from '@/types/portal';
import { cn } from '@/lib/utils';

const CATEGORIES: ConnectorCatalogCategory[] = [
  'DATABASE',
  'ERP',
  'REST_API',
  'SOAP',
  'FTP_SFTP',
  'MESSAGING',
  'FILES',
  'WEBHOOK',
  'CUSTOM',
];

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-900/40 text-green-300',
  beta: 'bg-amber-900/40 text-amber-300',
  deprecated: 'bg-slate-700 text-slate-400',
};

export default function ConnectorCatalogPage() {
  const [category, setCategory] = useState<ConnectorCatalogCategory | ''>('');
  const { data, isLoading, error } = useConnectorCatalog(category || undefined);

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar catálogo de conectores" />;

  const connectors = data?.connectors ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Catálogo de Conectores</h1>
        <p className="text-sm text-slate-400">
          {data?.total ?? 0} conectores disponíveis para configuração
        </p>
      </div>

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as ConnectorCatalogCategory | '')}
        className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
      >
        <option value="">Todas as categorias</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {connectors.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Blocks className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-100">{c.name}</span>
              </div>
              <span
                className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_BADGE[c.status])}
              >
                {c.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{c.description}</p>
            <p className="mt-2 text-xs text-slate-600">
              {c.category} · {c.vendor}
              {c.currentVersion && ` · v${c.currentVersion}`}
            </p>
          </div>
        ))}
        {connectors.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">
            Nenhum conector disponível no catálogo.
          </p>
        )}
      </div>
    </div>
  );
}
