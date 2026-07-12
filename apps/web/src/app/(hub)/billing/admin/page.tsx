'use client';
import { TrendingUp, Users, AlertCircle, DollarSign } from 'lucide-react';
import { useAdminDashboard, useAdminInvoices } from '@/hooks/use-billing';
import { InvoiceRow } from '@/components/billing/invoice-row';

function formatUSD(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminBillingPage() {
  const { data: metrics, isLoading } = useAdminDashboard();
  const { data: invoicesData } = useAdminInvoices('open');

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-emerald-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Admin — Billing Dashboard</h1>
          <p className="text-sm text-slate-400">Financial overview and revenue metrics</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : metrics ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard
              label="MRR"
              value={formatUSD(metrics.mrr)}
              sub="Monthly Recurring Revenue"
              icon={DollarSign}
              accent="text-emerald-400"
            />
            <MetricCard
              label="ARR"
              value={formatUSD(metrics.arr)}
              sub="Annual Run Rate"
              icon={TrendingUp}
              accent="text-indigo-400"
            />
            <MetricCard
              label="Active Customers"
              value={String(metrics.activeCustomers)}
              sub={`${metrics.trialingCustomers} trialing`}
              icon={Users}
              accent="text-sky-400"
            />
            <MetricCard
              label="Community"
              value={String(metrics.communityUsers)}
              sub="Free tier"
              icon={Users}
              accent="text-slate-400"
            />
            <MetricCard
              label="New This Month"
              value={String(metrics.newThisMonth)}
              icon={TrendingUp}
              accent="text-emerald-400"
            />
            <MetricCard
              label="Churned"
              value={String(metrics.churnedThisMonth)}
              icon={AlertCircle}
              accent="text-rose-400"
            />
            <MetricCard
              label="AI Credits Used"
              value={metrics.totalAiCreditsUsed.toLocaleString()}
              icon={TrendingUp}
              accent="text-violet-400"
            />
            <MetricCard
              label="Open Invoices"
              value={String(metrics.overdueInvoices.length)}
              icon={AlertCircle}
              accent="text-amber-400"
            />
          </div>

          {/* Revenue by plan */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">MRR by Plan</h2>
            <div className="grid grid-cols-3 gap-4">
              {(['community', 'professional', 'enterprise'] as const).map((slug) => (
                <div key={slug} className="text-center">
                  <p className="text-xs text-slate-500 capitalize mb-1">{slug}</p>
                  <p className="text-lg font-bold text-white tabular-nums">
                    {formatUSD(metrics.revenueByPlan[slug])}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Top customers */}
          {metrics.topCustomers.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Top Customers</h2>
              <div className="flex flex-col gap-2">
                {metrics.topCustomers.map((c, i) => (
                  <div key={c.tenantId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-slate-500 text-xs">{i + 1}</span>
                      <span className="font-mono text-slate-300">{c.tenantId}</span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400 capitalize">
                        {c.planSlug}
                      </span>
                    </div>
                    <span className="tabular-nums text-slate-300 font-medium">
                      {formatUSD(c.spend)}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open invoices */}
          {invoicesData && invoicesData.items.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Open Invoices</h2>
              <div className="flex flex-col gap-2">
                {invoicesData.items.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">No data available</p>
      )}
    </div>
  );
}
