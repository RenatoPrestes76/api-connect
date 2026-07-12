'use client';
import { useState } from 'react';
import { Layers } from 'lucide-react';
import { usePlans, useSubscription, useUpgradePlan, useDowngradePlan } from '@/hooks/use-billing';
import { PlanCard } from '@/components/billing/plan-card';
import type { PlanSlug } from '@/types/billing';

const DEMO_TENANT = 'tenant-professional';

export default function PlansPage() {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { data: plansData, isLoading: plansLoading } = usePlans();
  const { data: subData } = useSubscription(DEMO_TENANT);
  const upgrade = useUpgradePlan();
  const downgrade = useDowngradePlan();

  const currentSlug = subData?.subscription.planSlug;
  const currentPlan = plansData?.plans.find((p) => p.slug === currentSlug);
  const isPending = upgrade.isPending || downgrade.isPending;

  const handleSelect = (slug: PlanSlug) => {
    if (slug === currentSlug) return;
    const targetPlan = plansData?.plans.find((p) => p.slug === slug);
    const isUpgrade =
      targetPlan && currentPlan ? targetPlan.monthlyPrice > currentPlan.monthlyPrice : true;

    const mutation = isUpgrade ? upgrade : downgrade;
    mutation.mutate({ tenantId: DEMO_TENANT, planSlug: slug, billingCycle: cycle });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Layers className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Plans</h1>
          <p className="text-sm text-slate-400">Choose the plan that fits your team</p>
        </div>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex items-center gap-2 self-start rounded-lg border border-slate-700 bg-slate-900 p-1">
        {(['monthly', 'yearly'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCycle(c)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${cycle === c ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {c === 'monthly' ? 'Monthly' : 'Yearly (save ~17%)'}
          </button>
        ))}
      </div>

      {plansLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-96 rounded-xl bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(plansData?.plans ?? []).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentSlug={currentSlug}
              billingCycle={cycle}
              onSelect={handleSelect}
              loading={isPending}
            />
          ))}
        </div>
      )}

      {(upgrade.isSuccess || downgrade.isSuccess) && (
        <p className="text-sm text-emerald-400">Plan updated successfully.</p>
      )}
      {(upgrade.isError || downgrade.isError) && (
        <p className="text-sm text-rose-400">
          {(upgrade.error ?? downgrade.error)?.message ?? 'Failed to change plan'}
        </p>
      )}
    </div>
  );
}
