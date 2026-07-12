'use client';
import { useEffect, useState } from 'react';
import type { ProvisionResponse, ProvisionTask, ValidationCheck } from '@/types/setup';
import { CheckCircle2, XCircle, Loader2, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  sessionId: string;
  onProvision: () => Promise<ProvisionResponse | null>;
  onNext: () => void;
  onBack: () => void;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

export function StepValidation({ sessionId: _sessionId, onProvision, onNext, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [tasks, setTasks] = useState<ProvisionTask[]>([]);
  const [checks, setChecks] = useState<ValidationCheck[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setPhase('running');
      const result = await onProvision();
      if (cancelled) return;
      if (result) {
        // Animate tasks appearing one by one
        for (let i = 0; i <= result.tasks.length; i++) {
          if (cancelled) return;
          setTasks(result.tasks.slice(0, i));
          await new Promise((r) => setTimeout(r, 80));
        }
        setChecks(result.validationChecks);
        setPhase('done');
      } else {
        setPhase('error');
        setError('Provisionamento falhou. Verifique as configurações anteriores.');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const allDone = phase === 'done';
  const checksPassed = checks.filter((c) => c.passed).length;

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'rounded-lg border p-4',
          allDone
            ? 'border-green-700/40 bg-green-900/10'
            : phase === 'error'
              ? 'border-red-700/40 bg-red-900/10'
              : 'border-slate-700 bg-slate-800'
        )}
      >
        <div className="flex items-center gap-3">
          {phase === 'running' && <Loader2 className="h-5 w-5 animate-spin text-blue-400" />}
          {phase === 'done' && <Rocket className="h-5 w-5 text-green-400" />}
          {phase === 'error' && <XCircle className="h-5 w-5 text-red-400" />}
          {phase === 'idle' && <Loader2 className="h-5 w-5 animate-spin text-slate-500" />}
          <div>
            <p className="text-sm font-medium text-slate-200">
              {phase === 'running' && 'Provisionando Atlas Connect...'}
              {phase === 'done' && 'Provisionamento concluído com sucesso!'}
              {phase === 'error' && 'Falha no provisionamento'}
              {phase === 'idle' && 'Iniciando...'}
            </p>
            {phase === 'done' && (
              <p className="text-xs text-slate-400">
                {tasks.length} tarefas · {checksPassed}/{checks.length} validações passaram
              </p>
            )}
          </div>
        </div>
      </div>

      {tasks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-400">Tarefas de Provisionamento</p>
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                <span className="text-sm text-slate-300">{task.label}</span>
              </div>
            ))}
            {phase === 'running' && tasks.length < 11 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" />
                <span className="text-sm text-slate-400">Executando...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {checks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-400">Checklist de Validação</p>
          <div className="grid grid-cols-3 gap-2">
            {checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                  check.passed
                    ? 'border-green-700/40 bg-green-900/10 text-green-300'
                    : 'border-red-700/40 bg-red-900/10 text-red-300'
                )}
              >
                {check.passed ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 shrink-0" />
                )}
                {check.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-700/40 bg-red-900/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={phase === 'running'}
          className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-300 disabled:opacity-30"
        >
          ← Voltar
        </button>
        <button
          type="button"
          disabled={!allDone}
          onClick={onNext}
          className="flex-1 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
        >
          {allDone ? 'Ver Dashboard →' : 'Aguarde...'}
        </button>
      </div>
    </div>
  );
}
