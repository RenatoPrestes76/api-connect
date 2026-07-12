'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/use-portal';
import { ApiKeyRow } from '@/components/portal/api-key-row';
import { PageLoading, ErrorState } from '@/components/common/loading-state';

export default function ApiKeysPage() {
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', scopes: 'read:workflows' });

  const { data, isLoading, error } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar chaves de API" />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Chaves de API</h1>
          <p className="text-sm text-slate-400">{data?.total ?? 0} chaves</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Nova Chave
        </button>
      </div>

      {newKey && (
        <div className="rounded-lg border border-green-700/40 bg-green-900/20 p-4">
          <p className="text-sm font-medium text-green-300 mb-1">
            Chave criada com sucesso. Copie agora — não será exibida novamente.
          </p>
          <code className="block rounded bg-slate-900 p-2 text-xs font-mono text-green-400 break-all">
            {newKey}
          </code>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs text-slate-500 hover:text-slate-400"
          >
            Fechar
          </button>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-200">Nova Chave de API</h3>
          <input
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            placeholder="Nome da chave (ex: CI/CD Pipeline)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            placeholder="Escopos (ex: read:workflows,write:events)"
            value={form.scopes}
            onChange={(e) => setForm({ ...form, scopes: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                createKey.mutate(
                  { name: form.name, scopes: form.scopes.split(',').map((s) => s.trim()) },
                  {
                    onSuccess: (created) => {
                      if (created.key) setNewKey(created.key);
                      setShowForm(false);
                      setForm({ name: '', scopes: 'read:workflows' });
                    },
                  }
                );
              }}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Criar
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(data?.keys ?? []).map((key) => (
          <ApiKeyRow key={key.id} apiKey={key} onRevoke={(id) => revokeKey.mutate(id)} />
        ))}
        {data?.keys.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Nenhuma chave criada</p>
        )}
      </div>
    </div>
  );
}
