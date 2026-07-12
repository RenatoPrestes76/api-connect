'use client';
import { Check } from 'lucide-react';
import type { OnboardingProgress, OnboardingStep } from '@/types/portal';
import { cn } from '@/lib/utils';

const STEP_LABELS: Record<OnboardingStep, string> = {
  cadastro: 'Cadastro',
  provisionamento: 'Provisionamento',
  conector: 'Conector',
  primeiro_workflow: 'Workflow',
  primeira_execucao: 'Execução',
  producao: 'Produção',
};

interface Props {
  progress: OnboardingProgress;
  onCompleteStep?: (step: OnboardingStep) => void;
}

export function OnboardingStepper({ progress, onCompleteStep }: Props) {
  const steps: OnboardingStep[] = [
    'cadastro',
    'provisionamento',
    'conector',
    'primeiro_workflow',
    'primeira_execucao',
    'producao',
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Onboarding</span>
        <span className="font-medium text-slate-300">{progress.percentComplete}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            progress.percentComplete === 100 ? 'bg-green-500' : 'bg-blue-500'
          )}
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>
      <div className="flex gap-1">
        {steps.map((step) => {
          const done = progress.completedSteps.includes(step);
          const isCurrent = progress.currentStep === step && !done;
          return (
            <button
              key={step}
              onClick={() => onCompleteStep?.(step)}
              disabled={done || !isCurrent}
              title={STEP_LABELS[step]}
              className={cn(
                'flex h-6 flex-1 items-center justify-center rounded text-xs transition-colors',
                done
                  ? 'bg-green-700/60 text-green-400'
                  : isCurrent
                    ? 'cursor-pointer bg-blue-600/40 text-blue-300 hover:bg-blue-600/60'
                    : 'bg-slate-800 text-slate-600'
              )}
            >
              {done ? <Check className="h-3 w-3" /> : STEP_LABELS[step].slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
