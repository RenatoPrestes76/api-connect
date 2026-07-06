'use client';
import { useRouter } from 'next/navigation';
import { useCompanies } from '../../../hooks/use-companies.js';
import { PageHeader } from '../../../components/atlas/page-header.js';
import { Card, CardContent } from '../../../components/ui/card.js';
import { Loading } from '../../../components/atlas/loading.js';
import { EmptyState } from '../../../components/atlas/empty-state.js';
import { ErrorState } from '../../../components/atlas/error-state.js';
import { Building2 } from 'lucide-react';

export default function CompaniesPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useCompanies();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Companies"
        description="Organizations with registered Atlas agents"
        breadcrumb={[{ label: 'Companies' }]}
      />

      <Card>
        {isLoading ? (
          <CardContent><Loading rows={6} /></CardContent>
        ) : error ? (
          <CardContent>
            <ErrorState message="Failed to load companies" onRetry={() => void refetch()} />
          </CardContent>
        ) : !data?.length ? (
          <CardContent>
            <EmptyState
              icon={Building2}
              title="No companies found"
              description="No agents have been registered yet."
            />
          </CardContent>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Company ID</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Agents</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Online</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(c => {
                const pct = c.agentCount > 0 ? Math.round((c.onlineCount / c.agentCount) * 100) : 0;
                return (
                  <tr
                    key={c.companyId}
                    onClick={() => router.push(`/agents?companyId=${c.companyId}`)}
                    className="cursor-pointer bg-white transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.companyId}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.agentCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{c.onlineCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={pct >= 80 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-rose-700'}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
