'use client';
import { CreditCard, Zap, FileText, Key, ExternalLink } from 'lucide-react';
import { useSubscription, useUsage, useLicense, useCustomerPortal } from '@/hooks/use-billing';
import { UsageMeter } from '@/components/billing/usage-meter';

const DEMO_TENANT = 'tenant-professional';

const PLAN_BADGE: Record<string, string> = {
  community: 'bg-slate-700 text-slate-300',
  professional: 'bg-indigo-600 text-white',
  enterprise: 'bg-violet-600 text-white',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  trialing: 'bg-sky-500/20 text-sky-400',
  past_due: 'bg-amber-500/20 text-amber-400',
  canceled: 'bg-slate-700 text-slate-500',
};

export default function BillingPage() {
  const { data: subData, isLoading: subLoading } = useSubscription(DEMO_TENANT);
  const { data: usageData, isLoading: usageLoading } = useUsage(DEMO_TENANT);
  const { data: license } = useLicense(DEMO_TENANT);
  const { refetch: openPortal, isFetching: portalLoading } = useCustomerPortal(DEMO_TENANT);

  const sub = subData?.subscription;
  const plan = subData?.plan;
  const usage = usageData?.usage;
  const limits = usageData?.limits;

  const handlePortal = async () => {
    const { data } = await openPortal();
    if (data?.url) window.open(data.url, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-indigo-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Billing & Licensing</h1>
            <p className="text-sm text-slate-400">Manage your plan, invoices and license</p>
          </div>
        </div>
        {sub && sub.planSlug !== 'community' && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            Customer Portal
          </button>
        )}
      </div>

      {/* Current plan card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Current Plan</p>
            {subLoading ? (
              <div className="h-6 w-32 rounded bg-slate-800 animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">{plan?.name ?? '—'}</h2>
                {sub && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PLAN_BADGE[sub.planSlug] ?? 'bg-slate-700 text-slate-400'}`}
                  >
                    {sub.planSlug}
                  </span>
                )}
              </div>
            )}
          </div>
          {sub && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[sub.status] ?? 'bg-slate-700 text-slate-400'}`}
            >
              {sub.status}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-slate-500">Billing Cycle</p>
            <p className="text-slate-200 capitalize">{sub?.billingCycle ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Next Renewal</p>
            <p className="text-slate-200">
              {sub?.renewAt ? new Date(sub.renewAt).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Rate Limit</p>
            <p className="text-slate-200">
              {plan?.rateLimit === 0 ? 'Custom' : `${plan?.rateLimit ?? '—'} req/min`}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Support</p>
            <p className="text-slate-200 capitalize">{plan?.supportLevel ?? '—'}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <a
            href="/billing/plans"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
          >
            Change Plan
          </a>
          <a
            href="/billing/invoices"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            View Invoices
          </a>
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">Usage — {usageData?.usage.month}</h2>
        </div>
        {usageLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-6 rounded bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : usage && limits ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <UsageMeter label="Agents" value={usage.agents} limit={limits.agents} />
            <UsageMeter label="Connectors" value={usage.connectors} limit={limits.connectors} />
            <UsageMeter label="Workflows" value={usage.workflows} limit={limits.workflows} />
            <UsageMeter label="AI Credits" value={usage.aiCreditsUsed} limit={limits.aiCredits} />
            <UsageMeter label="API Calls" value={usage.apiCalls} limit={null} unit=" calls" />
            <UsageMeter label="Executions" value={usage.executions} limit={null} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">No usage data available</p>
        )}
      </div>

      {/* License */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">License</h2>
        </div>
        {license ? (
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-slate-500">Key</p>
              <p className="font-mono text-slate-300 text-xs break-all">{license.key}</p>
            </div>
            <div>
              <p className="text-slate-500">Fingerprint</p>
              <p className="font-mono text-slate-300">{license.fingerprint ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${license.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}
              >
                {license.status}
              </span>
            </div>
            <div>
              <p className="text-slate-500">Expires</p>
              <p className="text-slate-300">
                {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No license found</p>
        )}
      </div>
    </div>
  );
}
