'use client';
import { Check } from 'lucide-react';
import type { Plan, PlanSlug } from '@/types/billing';

interface PlanCardProps {
  plan: Plan;
  currentSlug?: PlanSlug;
  billingCycle: 'monthly' | 'yearly';
  onSelect: (slug: PlanSlug) => void;
  loading?: boolean;
}

const PLAN_COLORS: Record<PlanSlug, string> = {
  community: 'border-slate-700',
  professional: 'border-indigo-500',
  enterprise: 'border-violet-500',
};

const PLAN_BADGE: Record<PlanSlug, string> = {
  community: 'bg-slate-700 text-slate-300',
  professional: 'bg-indigo-600 text-white',
  enterprise: 'bg-violet-600 text-white',
};

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(0)}`;
}

export function PlanCard({ plan, currentSlug, billingCycle, onSelect, loading }: PlanCardProps) {
  const isCurrent = currentSlug === plan.slug;
  const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const monthlyEquivalent =
    billingCycle === 'yearly' && plan.yearlyPrice > 0 ? Math.round(plan.yearlyPrice / 12) : price;

  const isUpgrade =
    currentSlug === 'community'
      ? plan.slug !== 'community'
      : currentSlug === 'professional'
        ? plan.slug === 'enterprise'
        : false;

  return (
    <div
      className={`flex flex-col rounded-xl border-2 bg-slate-900 p-6 transition-all ${PLAN_COLORS[plan.slug]} ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-indigo-500' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
          <p className="text-sm text-slate-400 capitalize">{plan.supportLevel} support</p>
        </div>
        {isCurrent && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_BADGE[plan.slug]}`}
          >
            Current
          </span>
        )}
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold text-white">
          {price === 0 ? 'Free' : `$${(monthlyEquivalent / 100).toFixed(0)}`}
        </span>
        {price > 0 && (
          <span className="text-slate-400 text-sm ml-1">
            {billingCycle === 'yearly' ? '/mo (billed yearly)' : '/month'}
          </span>
        )}
        {billingCycle === 'yearly' && price > 0 && (
          <p className="text-xs text-emerald-400 mt-1">
            Save ${((plan.monthlyPrice * 12 - plan.yearlyPrice) / 100).toFixed(0)}/yr
          </p>
        )}
      </div>

      <ul className="flex flex-col gap-2 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
            <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan.slug)}
        disabled={isCurrent || loading}
        className={`w-full rounded-lg py-2 text-sm font-medium transition-colors ${
          isCurrent
            ? 'bg-slate-800 text-slate-500 cursor-default'
            : isUpgrade
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
        } disabled:opacity-50`}
      >
        {isCurrent
          ? 'Current Plan'
          : isUpgrade
            ? 'Upgrade'
            : plan.slug === 'community'
              ? 'Downgrade'
              : 'Switch'}
      </button>
    </div>
  );
}
