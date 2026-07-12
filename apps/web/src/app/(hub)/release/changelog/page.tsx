'use client';
import { useState } from 'react';
import { useChangelog } from '@/hooks/use-release';
import { PageLoading, ErrorState } from '@/components/common/loading-state';
import type { ChangeType } from '@/types/release';
import { cn } from '@/lib/utils';

const TYPE_STYLE: Record<ChangeType, string> = {
  feat: 'bg-blue-900/40 text-blue-300',
  fix: 'bg-orange-900/40 text-orange-300',
  perf: 'bg-purple-900/40 text-purple-300',
  security: 'bg-red-900/40 text-red-300',
  breaking: 'bg-red-700/60 text-red-200',
  docs: 'bg-slate-700 text-slate-400',
  infra: 'bg-teal-900/40 text-teal-300',
};

export default function ChangelogPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useChangelog(search || undefined);

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar changelog" />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Changelog</h1>
          <p className="text-sm text-slate-400">{data?.total ?? 0} versões · 37 sprints</p>
        </div>
        <input
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 w-56"
          placeholder="Buscar por sprint, feature..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {(data?.versions ?? []).map((v) => (
          <div key={v.version} className="relative">
            <div className="mb-3 flex items-baseline gap-3">
              <span className="font-mono text-sm font-bold text-slate-200">v{v.version}</span>
              <span className="text-xs font-medium text-blue-400">{v.codename}</span>
              <span className="text-xs text-slate-600">Sprint {v.sprint}</span>
              <span className="ml-auto text-xs text-slate-600">
                {new Date(v.releasedAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
            {v.summary && <p className="mb-2 text-xs text-slate-500">{v.summary}</p>}
            <div className="space-y-1">
              {v.entries.map((e) => (
                <div key={e.id} className="flex items-baseline gap-2 text-sm">
                  <span
                    className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs', TYPE_STYLE[e.type])}
                  >
                    {e.type}
                  </span>
                  <span className="text-slate-300">{e.description}</span>
                  <span className="ml-auto shrink-0 text-xs text-slate-600">{e.component}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
