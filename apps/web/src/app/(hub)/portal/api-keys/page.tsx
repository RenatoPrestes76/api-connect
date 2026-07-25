'use client';
import { useState } from 'react';
import { Plus, Copy, Check } from 'lucide-react';
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useRegenerateApiKey,
} from '@/hooks/use-gateway';
import { useEnvironments } from '@/hooks/use-portal';
import { ApiKeyRow } from '@/components/portal/api-key-row';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { OrgRole } from '@/types/portal';

const ROLES: OrgRole[] = ['OWNER', 'ADMINISTRATOR', 'DEVELOPER', 'OPERATOR', 'VIEWER'];

export default function ApiKeysPage() {
  const [showForm, setShowForm] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: '', environmentId: '', role: 'VIEWER' as OrgRole });

  const { data, isLoading, error } = useApiKeys();
  const { data: envData } = useEnvironments();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const regenerateKey = useRegenerateApiKey();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar chaves de API" />;

  const environments = envData?.environments ?? [];
  const environmentName = (id: string): string | undefined =>
    environments.find((e) => e.id === id)?.name;

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreate = () => {
    createKey.mutate(form, {
      onSuccess: (created) => {
        if (created.apiKey) setNewKey(created.apiKey);
        setShowForm(false);
        setForm({ name: '', environmentId: '', role: 'VIEWER' });
      },
    });
  };

  const handleRegenerate = (id: string) => {
    regenerateKey.mutate(id, {
      onSuccess: (updated) => {
        if (updated.apiKey) setNewKey(updated.apiKey);
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Chaves de API</h1>
          <p className="text-sm text-slate-400">
            {data?.total ?? 0} chaves · Autenticação de serviço a serviço via header X-Api-Key
          </p>
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
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-medium text-green-300">
              Chave criada com sucesso. Copie agora — não será exibida novamente.
            </p>
            <button
              onClick={() => void copyKey()}
              className="flex shrink-0 items-center gap-1.5 rounded bg-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <code className="block rounded bg-slate-900 p-2 text-xs font-mono text-green-400 break-all">
            {newKey}
          </code>
          <p className="mt-2 text-xs text-slate-500">
            Envie como header: <code className="text-slate-400">X-Api-Key: {newKey}</code>
          </p>
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
          <div className="grid grid-cols-2 gap-2">
            <select
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              value={form.environmentId}
              onChange={(e) => setForm({ ...form, environmentId: e.target.value })}
            >
              <option value="">Selecione o ambiente</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
            <select
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as OrgRole })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!form.name || !form.environmentId || createKey.isPending}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
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
          <ApiKeyRow
            key={key.id}
            apiKey={key}
            environmentName={environmentName(key.environmentId)}
            onRevoke={(id) => revokeKey.mutate(id)}
            onRegenerate={handleRegenerate}
          />
        ))}
        {data?.keys.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Nenhuma chave criada</p>
        )}
      </div>
    </div>
  );
}
