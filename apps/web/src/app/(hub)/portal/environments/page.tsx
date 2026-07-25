'use client';
import { useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useEnvironments, useCreateEnvironment, useDeleteEnvironment } from '@/hooks/use-portal';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { EnvironmentKind } from '@/types/portal';
import { cn } from '@/lib/utils';

const KIND_BADGE: Record<EnvironmentKind, string> = {
  production: 'bg-red-900/40 text-red-300',
  staging: 'bg-amber-900/40 text-amber-300',
  development: 'bg-teal-900/40 text-teal-300',
};

export default function EnvironmentsPage() {
  const { data, isLoading, error } = useEnvironments();
  const createEnvironment = useCreateEnvironment();
  const deleteEnvironment = useDeleteEnvironment();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    kind: 'development' as EnvironmentKind,
    region: 'us-east-1',
    timezone: 'America/Sao_Paulo',
  });

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar ambientes" />;

  const handleCreate = async () => {
    await createEnvironment.mutateAsync(form);
    setShowCreate(false);
    setForm({ name: '', kind: 'development', region: 'us-east-1', timezone: 'America/Sao_Paulo' });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Ambientes</h1>
          <p className="text-sm text-slate-400">{data?.total ?? 0} ambientes configurados</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Novo ambiente
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-200">Novo Ambiente</h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as EnvironmentKind })}
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              placeholder="Região"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
            <input
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              placeholder="Timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              disabled={createEnvironment.isPending}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Criar
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.environments ?? []).map((env) => (
          <div key={env.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-100">{env.name}</span>
              </div>
              <button
                onClick={() => deleteEnvironment.mutate(env.id)}
                aria-label={`Excluir ${env.name}`}
                className="text-slate-500 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <span
              className={cn(
                'mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium',
                KIND_BADGE[env.kind]
              )}
            >
              {env.kind}
            </span>
            <p className="mt-2 text-xs text-slate-500">
              {env.region} · {env.timezone}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {env.status === 'active' ? 'Ativo' : 'Inativo'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
