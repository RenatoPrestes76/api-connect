'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetupWizard } from '@/hooks/use-setup';
import { StepCompany } from '@/components/setup/StepCompany';
import { StepAdmin } from '@/components/setup/StepAdmin';
import { StepDatabase } from '@/components/setup/StepDatabase';
import { StepConnector } from '@/components/setup/StepConnector';
import { StepAgent } from '@/components/setup/StepAgent';
import { StepSecrets } from '@/components/setup/StepSecrets';
import { StepValidation } from '@/components/setup/StepValidation';
import { StepFinish } from '@/components/setup/StepFinish';
import { cn } from '@/lib/utils';

const STEP_LABELS: Record<string, string> = {
  company: 'Empresa',
  admin: 'Administrador',
  database: 'Banco de Dados',
  connector: 'Connector',
  agent: 'Agent',
  secrets: 'Secrets',
  provision: 'Provisionamento',
  finish: 'Concluído',
};

const STEP_ORDER = [
  'company',
  'admin',
  'database',
  'connector',
  'agent',
  'secrets',
  'provision',
  'finish',
] as const;

export default function SetupPage() {
  const router = useRouter();
  const wizard = useSetupWizard();
  const { state } = wizard;

  useEffect(() => {
    if (!state.sessionId) {
      wizard.startSession();
    }
  }, []);

  const currentIndex = STEP_ORDER.indexOf(state.step as (typeof STEP_ORDER)[number]);

  if (!state.sessionId && !state.loading) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 text-center">
        <div className="h-12 w-12 animate-pulse rounded-full bg-indigo-900/40" />
        <p className="text-sm text-slate-500">Iniciando sessão de setup...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Etapa {currentIndex + 1} de {STEP_ORDER.length}
          </span>
          <span className="font-medium text-slate-300">{STEP_LABELS[state.step]}</span>
        </div>
        <div className="flex gap-1">
          {STEP_ORDER.map((step, i) => (
            <div
              key={step}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all',
                i < currentIndex
                  ? 'bg-indigo-500'
                  : i === currentIndex
                    ? 'bg-indigo-400'
                    : 'bg-slate-700'
              )}
            />
          ))}
        </div>
      </div>

      {/* Step header */}
      {state.step !== 'finish' && (
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{STEP_LABELS[state.step]}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {state.step === 'company' && 'Configure os dados da sua empresa e workspace inicial.'}
            {state.step === 'admin' && 'Crie o primeiro administrador da plataforma.'}
            {state.step === 'database' && 'Conecte o banco de dados da sua aplicação.'}
            {state.step === 'connector' && 'Configure o primeiro conector de integração.'}
            {state.step === 'agent' && 'Registre o primeiro agent do Atlas Connect.'}
            {state.step === 'secrets' && 'Escolha onde armazenar credenciais e tokens.'}
            {state.step === 'provision' &&
              'O Atlas Connect está provisionando seu ambiente automaticamente.'}
          </p>
        </div>
      )}

      {/* Error banner */}
      {state.error && (
        <div className="rounded-lg border border-red-700/40 bg-red-900/10 px-4 py-2.5 text-sm text-red-300">
          {state.error}
        </div>
      )}

      {/* Card */}
      <div
        className={cn(
          'rounded-xl border border-slate-700 bg-slate-900 p-6',
          state.step === 'finish' && 'border-green-700/30 bg-green-900/5'
        )}
      >
        {state.step === 'company' && (
          <StepCompany loading={state.loading} onNext={wizard.submitCompany} />
        )}
        {state.step === 'admin' && (
          <StepAdmin
            loading={state.loading}
            onNext={wizard.submitAdmin}
            onBack={() => wizard.setStep('company')}
          />
        )}
        {state.step === 'database' && (
          <StepDatabase
            loading={state.loading}
            onNext={wizard.submitDatabase}
            onBack={() => wizard.setStep('admin')}
          />
        )}
        {state.step === 'connector' && (
          <StepConnector
            loading={state.loading}
            onNext={wizard.submitConnector}
            onBack={() => wizard.setStep('database')}
          />
        )}
        {state.step === 'agent' && (
          <StepAgent
            loading={state.loading}
            onNext={wizard.submitAgent}
            onBack={() => wizard.setStep('connector')}
          />
        )}
        {state.step === 'secrets' && (
          <StepSecrets
            loading={state.loading}
            onNext={wizard.submitSecrets}
            onBack={() => wizard.setStep('agent')}
          />
        )}
        {state.step === 'provision' && state.sessionId && (
          <StepValidation
            sessionId={state.sessionId}
            onProvision={wizard.runProvision}
            onNext={wizard.finishSetup}
            onBack={() => wizard.setStep('secrets')}
          />
        )}
        {state.step === 'finish' && (
          <StepFinish
            loading={state.loading}
            finishResult={state.finishResult}
            company={state.company?.name ?? ''}
            workspace={state.company?.workspaceName ?? state.company?.name ?? ''}
            connector={state.connector?.name ?? ''}
            onFinish={() => router.push('/dashboard')}
          />
        )}
      </div>
    </div>
  );
}
