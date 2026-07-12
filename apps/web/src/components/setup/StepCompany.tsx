'use client';
import { useState } from 'react';
import type { CompanyFormData, SetupPlan, WorkspaceEnvironment } from '@/types/setup';
import { cn } from '@/lib/utils';

interface Props {
  loading: boolean;
  onNext: (data: CompanyFormData) => void;
}

const PLANS: { value: SetupPlan; label: string; desc: string }[] = [
  { value: 'community', label: 'Community', desc: 'Gratuito · 1 tenant · 3 connectors' },
  { value: 'professional', label: 'Professional', desc: '$299/mês · 5 tenants · 20 connectors' },
  { value: 'enterprise', label: 'Enterprise', desc: 'Sob consulta · Ilimitado' },
];

const ENVS: { value: WorkspaceEnvironment; label: string }[] = [
  { value: 'production', label: 'Produção' },
  { value: 'staging', label: 'Homologação' },
  { value: 'development', label: 'Desenvolvimento' },
];

export function StepCompany({ loading, onNext }: Props) {
  const [form, setForm] = useState<CompanyFormData>({
    name: '',
    cnpj: '',
    domain: '',
    plan: 'professional',
    timezone: 'America/Sao_Paulo',
    locale: 'pt-BR',
    workspaceName: '',
    workspaceEnvironment: 'production',
  });

  const set = (k: keyof CompanyFormData, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.domain) return;
    onNext(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Nome da Empresa <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="Acme Tecnologia Ltda"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">CNPJ</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="00.000.000/0001-00"
            value={form.cnpj}
            onChange={(e) => set('cnpj', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Domínio <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="acme.com.br"
            value={form.domain}
            onChange={(e) => set('domain', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Fuso Horário</label>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            value={form.timezone}
            onChange={(e) => set('timezone', e.target.value)}
          >
            <option value="America/Sao_Paulo">América/São Paulo (UTC-3)</option>
            <option value="America/New_York">América/Nova York (UTC-5)</option>
            <option value="Europe/London">Europa/Londres (UTC+0)</option>
            <option value="Asia/Tokyo">Ásia/Tokyo (UTC+9)</option>
          </select>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-400">Plano</p>
        <div className="grid grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => set('plan', p.value)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                form.plan === p.value
                  ? 'border-indigo-500 bg-indigo-900/20'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              )}
            >
              <p className="text-sm font-medium text-slate-200">{p.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-700 pt-4">
        <p className="mb-3 text-xs font-medium text-slate-400">Workspace Inicial</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nome do Workspace</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              placeholder={form.name || 'Workspace Principal'}
              value={form.workspaceName}
              onChange={(e) => set('workspaceName', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Ambiente</label>
            <div className="flex gap-2">
              {ENVS.map((env) => (
                <button
                  key={env.value}
                  type="button"
                  onClick={() => set('workspaceEnvironment', env.value)}
                  className={cn(
                    'flex-1 rounded border px-2 py-1.5 text-xs font-medium transition-colors',
                    form.workspaceEnvironment === env.value
                      ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  )}
                >
                  {env.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !form.name || !form.domain}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Salvando...' : 'Próximo →'}
      </button>
    </form>
  );
}
