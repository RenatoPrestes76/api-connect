'use client';
import { usePortalDashboard, useCompleteOnboardingStep } from '@/hooks/use-portal';
import { OnboardingStepper } from '@/components/portal/onboarding-stepper';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { OnboardingStep } from '@/types/portal';

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function PortalPage() {
  const { data: dash, isLoading, error } = usePortalDashboard();
  const completeStep = useCompleteOnboardingStep();

  if (isLoading) return <PageLoading />;
  if (error || !dash) return <ErrorState message="Erro ao carregar portal" />;

  const aiPct =
    dash.aiCreditsTotal > 0 ? Math.round((dash.aiCreditsUsed / dash.aiCreditsTotal) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Customer Portal</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Tenant: <span className="font-mono text-slate-300">{dash.tenantId}</span>
            {' · '}Plan: <span className="capitalize font-medium text-slate-300">{dash.plan}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${dash.healthScore >= 90 ? 'bg-green-500' : dash.healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
          />
          <span className="text-slate-300">Health: {dash.healthScore}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Agents Online"
          value={`${dash.agentsOnline}/${dash.agentsTotal}`}
          sub="edge agents"
        />
        <KpiCard label="Workflows Ativos" value={dash.workflowsActive} sub="em execução" />
        <KpiCard label="Conectores" value={dash.connectorsInstalled} sub="instalados" />
        <KpiCard label="API Calls Hoje" value={dash.apiCallsToday.toLocaleString('pt-BR')} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-300">Créditos AI</h2>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-100">
              {dash.aiCreditsUsed.toLocaleString()}
            </span>
            <span className="text-sm text-slate-500">
              / {dash.aiCreditsTotal === 999999 ? '∞' : dash.aiCreditsTotal.toLocaleString()}
            </span>
          </div>
          {dash.aiCreditsTotal < 999999 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full ${aiPct >= 90 ? 'bg-red-500' : aiPct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                style={{ width: `${aiPct}%` }}
              />
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Próxima fatura: {new Date(dash.nextBillingDate).toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-300">Suporte</h2>
          <p className="text-2xl font-bold text-slate-100">{dash.openTickets}</p>
          <p className="text-xs text-slate-500">tickets em aberto</p>
          <a
            href="/portal/support"
            className="mt-3 inline-block text-xs text-blue-400 hover:underline"
          >
            Ver todos os tickets →
          </a>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Jornada de Onboarding</h2>
        <OnboardingStepper
          progress={dash.onboarding}
          onCompleteStep={(step: OnboardingStep) => completeStep.mutate(step)}
        />
        {dash.onboarding.completedAt && (
          <p className="mt-2 text-xs text-green-400">
            ✓ Onboarding concluído em{' '}
            {new Date(dash.onboarding.completedAt).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
    </div>
  );
}
