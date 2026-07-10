'use client';
import { useState } from 'react';
import { Search, Store } from 'lucide-react';
import {
  useConnectors,
  useCategories,
  useInstallConnector,
  useUninstallConnector,
  useUpdateConnector,
} from '@/hooks/use-marketplace';
import { ConnectorCard } from '@/components/marketplace/connector-card';
import { CategoryFilter } from '@/components/marketplace/category-filter';
import type { ConnectorCategory } from '@/types/marketplace';

export default function MarketplacePage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<ConnectorCategory | ''>('');

  const { data, isLoading } = useConnectors({ q: q || undefined, category: category || undefined });
  const { data: cats } = useCategories();

  const install = useInstallConnector();
  const uninstall = useUninstallConnector();
  const update = useUpdateConnector();

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Store className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Marketplace de Connectors</h1>
          <p className="text-sm text-slate-400">
            {data ? `${data.total} connectors disponíveis` : 'Carregando catálogo…'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar connector por nome, categoria ou palavra-chave…"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Category filter */}
      <CategoryFilter selected={category} counts={cats?.counts} onChange={setCategory} />

      {/* Grid */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Store className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum connector encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((c) => (
            <ConnectorCard
              key={c.manifest.id}
              connector={c}
              onInstall={(id) => install.mutate({ connectorId: id })}
              onUninstall={(id) => uninstall.mutate(id)}
              onUpdate={(id) => update.mutate({ installationId: id })}
              loading={install.isPending || uninstall.isPending || update.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
