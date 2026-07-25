'use client';
import { useState } from 'react';
import { Gauge, Trash2 } from 'lucide-react';
import {
  useRateLimitRules,
  useUpsertRateLimitRule,
  useDeleteRateLimitRule,
} from '@/hooks/use-gateway';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { RateLimitWindow } from '@/types/gateway';

const WINDOWS: RateLimitWindow[] = ['minute', 'hour', 'day'];
const WINDOW_LABELS: Record<RateLimitWindow, string> = {
  minute: 'Por minuto',
  hour: 'Por hora',
  day: 'Por dia',
};

export default function RateLimitsPage() {
  const { data, isLoading, error } = useRateLimitRules();
  const upsert = useUpsertRateLimitRule();
  const remove = useDeleteRateLimitRule();
  const [form, setForm] = useState<Record<RateLimitWindow, string>>({
    minute: '',
    hour: '',
    day: '',
  });

  if (isLoading) return <PageLoading />;
  if (error || !data) return <ErrorState message="Erro ao carregar limites de requisição" />;

  const ruleFor = (window: RateLimitWindow) => data.rules.find((r) => r.window === window);

  const handleSave = (window: RateLimitWindow) => {
    const value = Number(form[window]);
    if (!value || value <= 0) return;
    upsert.mutate(
      { window, limit: value },
      { onSuccess: () => setForm({ ...form, [window]: '' }) }
    );
  };

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Limites de Requisição</h1>
        <p className="text-sm text-slate-400">
          Configuráveis por organização. Excedido retorna HTTP 429 Too Many Requests.
        </p>
      </div>

      <div className="space-y-3">
        {WINDOWS.map((window) => {
          const rule = ruleFor(window);
          return (
            <div
              key={window}
              className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4"
            >
              <Gauge className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">{WINDOW_LABELS[window]}</p>
                <p className="text-xs text-slate-500">
                  {rule ? (
                    <>
                      Limite atual: <span className="font-mono text-slate-300">{rule.limit}</span>{' '}
                      requisições
                    </>
                  ) : (
                    <>
                      Padrão:{' '}
                      <span className="font-mono text-slate-400">{data.defaults[window]}</span>{' '}
                      requisições
                    </>
                  )}
                </p>
              </div>
              <input
                type="number"
                min={1}
                placeholder="Novo limite"
                value={form[window]}
                onChange={(e) => setForm({ ...form, [window]: e.target.value })}
                className="w-28 rounded bg-slate-900 px-2.5 py-1.5 text-sm text-slate-200 border border-slate-700"
              />
              <button
                onClick={() => handleSave(window)}
                disabled={upsert.isPending}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Salvar
              </button>
              {rule && (
                <button
                  onClick={() => remove.mutate(rule.id)}
                  aria-label={`Remover limite de ${WINDOW_LABELS[window]}`}
                  className="text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
