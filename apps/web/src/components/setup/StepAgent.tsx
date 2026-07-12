'use client';
import { useState } from 'react';
import type { AgentFormData } from '@/types/setup';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  loading: boolean;
  onNext: (data: AgentFormData) => void;
  onBack: () => void;
}

const AGENT_TYPES = [
  {
    value: 'connector',
    label: 'Connector Agent',
    desc: 'Gerencia integrações e sincronização de dados',
  },
  {
    value: 'workflow',
    label: 'Workflow Agent',
    desc: 'Executa automações e orquestração de processos',
  },
  {
    value: 'discovery',
    label: 'Discovery Agent',
    desc: 'Mapeia schemas e estruturas automaticamente',
  },
  { value: 'monitor', label: 'Monitor Agent', desc: 'Monitora saúde e SLAs em tempo real' },
];

export function StepAgent({ loading, onNext, onBack }: Props) {
  const [form, setForm] = useState<AgentFormData>({
    name: 'atlas-agent-01',
    type: 'connector',
  });

  const set = (k: keyof AgentFormData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onNext(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-medium text-slate-200">O que é um Agent?</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Agents são processos autônomos que executam integrações, monitoram sistemas e
              orquestram workflows. Cada tenant pode ter múltiplos agents com funções diferentes.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Nome do Agent <span className="text-red-500">*</span>
        </label>
        <input
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          placeholder="atlas-agent-01"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-slate-600">Apenas letras minúsculas, números e hífens</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-400">Tipo do Agent</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AGENT_TYPES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => set('type', a.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                form.type === a.value
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              )}
            >
              <div
                className={cn(
                  'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                  form.type === a.value ? 'bg-blue-400' : 'bg-slate-600'
                )}
              />
              <div>
                <p className="text-sm font-medium text-slate-200">{a.label}</p>
                <p className="text-xs text-slate-500">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
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
          disabled={loading || !form.name}
          className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Próximo →'}
        </button>
      </div>
    </form>
  );
}
