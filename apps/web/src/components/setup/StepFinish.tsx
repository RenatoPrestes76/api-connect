'use client';
import type { FinishResponse } from '@/types/setup';
import { CheckCircle2, Building2, Server, Plug, Key, ExternalLink, Loader2 } from 'lucide-react';

interface Props {
  loading: boolean;
  finishResult: FinishResponse | null;
  company: string;
  workspace: string;
  connector: string;
  onFinish: () => void;
}

function ms(n: number): string {
  if (n < 1000) return `${n}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

export function StepFinish({
  loading,
  finishResult,
  company,
  workspace,
  connector,
  onFinish,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm text-slate-400">Finalizando instalação...</p>
      </div>
    );
  }

  const summary = finishResult?.summary;
  const apiKey = summary?.apiKey ?? '';

  const items = [
    { icon: Building2, label: 'Empresa', value: company },
    { icon: Building2, label: 'Workspace', value: workspace || company },
    { icon: Plug, label: 'Connector', value: connector || 'Configurado' },
    {
      icon: Server,
      label: 'Agent',
      value: summary?.agentId ? `ID: ${summary.agentId.slice(0, 12)}...` : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30 ring-4 ring-green-800/30">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">🎉 Atlas Connect está pronto.</h2>
          <p className="mt-1 text-sm text-slate-400">
            Seu ambiente foi provisionado com sucesso em{' '}
            {finishResult ? ms(finishResult.summary.durationMs) : '—'}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="mt-1 truncate text-sm font-medium text-slate-200">{value}</p>
          </div>
        ))}
      </div>

      {apiKey && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
            <Key className="h-3.5 w-3.5" />
            API Key — guarde agora, não será exibida novamente
          </div>
          <code className="mt-2 block break-all rounded bg-slate-900 px-3 py-2 text-xs text-amber-200">
            {apiKey}
          </code>
        </div>
      )}

      {finishResult && (
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            {
              label: 'Tarefas',
              value: `${finishResult.report.summary.tasksPassed}/${finishResult.report.summary.tasksTotal}`,
            },
            { label: 'Validações', value: '9/9' },
            { label: 'Status', value: finishResult.report.success ? 'OK' : 'FALHA' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-700 bg-slate-800 py-3">
              <p className="text-lg font-bold text-slate-100">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onFinish}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        <ExternalLink className="h-4 w-4" />
        Ir para o Dashboard
      </button>
    </div>
  );
}
