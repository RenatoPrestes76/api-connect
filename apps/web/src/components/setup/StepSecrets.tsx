'use client';
import { useState } from 'react';
import type { SecretsFormData, SecretsProvider } from '@/types/setup';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  loading: boolean;
  onNext: (data: SecretsFormData) => void;
  onBack: () => void;
}

const PROVIDERS: {
  value: SecretsProvider;
  label: string;
  desc: string;
  badge?: string;
}[] = [
  {
    value: 'vault',
    label: 'HashiCorp Vault',
    desc: 'Solução enterprise open-source para gestão de secrets',
    badge: 'Popular',
  },
  {
    value: 'aws',
    label: 'AWS Secrets Manager',
    desc: 'Gestão nativa para workloads na AWS',
  },
  {
    value: 'azure',
    label: 'Azure Key Vault',
    desc: 'Integração com Microsoft Azure e Active Directory',
  },
  {
    value: 'gcp',
    label: 'GCP Secret Manager',
    desc: 'Integração com Google Cloud Platform',
  },
  {
    value: 'internal',
    label: 'Secrets Interno',
    desc: 'Armazenamento criptografado gerenciado pelo Atlas',
    badge: 'Simples',
  },
];

export function StepSecrets({ loading, onNext, onBack }: Props) {
  const [form, setForm] = useState<SecretsFormData>({ provider: 'internal' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-slate-200">Gestão de Secrets</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Credenciais, tokens e chaves de API são criptografadas e nunca expostas em logs.
              Escolha o provedor que melhor se integra com sua infraestrutura.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setForm({ provider: p.value })}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
              form.provider === p.value
                ? 'border-amber-600/60 bg-amber-900/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
            )}
          >
            <div
              className={cn(
                'h-4 w-4 shrink-0 rounded-full border-2',
                form.provider === p.value ? 'border-amber-500 bg-amber-500' : 'border-slate-600'
              )}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{p.label}</span>
                {p.badge && (
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{p.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-300"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Iniciar Provisionamento →'}
        </button>
      </div>
    </form>
  );
}
