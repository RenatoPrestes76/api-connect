'use client';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import {
  useAlertRules,
  useUpdateAlertRule,
  useDeleteAlertRule,
  useAlerts,
} from '@/hooks/use-observatory';
import type { AlertSeverity } from '@/types/observatory';

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  INFO: 'bg-blue-100   text-blue-700   dark:bg-blue-950   dark:text-blue-300',
  WARNING: 'bg-amber-100  text-amber-700  dark:bg-amber-950  dark:text-amber-300',
  ERROR: 'bg-red-100    text-red-700    dark:bg-red-950    dark:text-red-300',
  CRITICAL: 'bg-red-600    text-white',
};

export default function AlertRulesPage() {
  const { data: rules, isLoading, isError, error, refetch } = useAlertRules();
  const { data: alertsData } = useAlerts({ limit: 10 }, true);
  const update = useUpdateAlertRule();
  const destroy = useDeleteAlertRule();

  if (isLoading) return <PageLoading message="Loading alert rules…" />;
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load alert rules'}
        onRetry={refetch}
      />
    );

  const ruleList = rules ?? [];
  const recentAlerts = alertsData?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert Center"
        description="Configure alert rules and monitor delivery across email, Slack, Teams, Discord, WhatsApp, and Webhook."
        actions={
          <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New Rule
          </button>
        }
      />

      {/* Recent alerts */}
      {recentAlerts.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Recent Alerts</h2>
          <div className="space-y-2">
            {recentAlerts.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_STYLES[a.severity]}`}
                >
                  {a.severity}
                </span>
                <span className="flex-1 truncate">{a.message}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                </span>
                {!a.acknowledged && (
                  <span
                    className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0"
                    title="Unacknowledged"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rules table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Rule
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Channels
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Triggered
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Last Triggered
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ruleList.map((rule) => (
                <tr
                  key={rule.id}
                  className={`hover:bg-muted/30 transition-colors ${!rule.active ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{rule.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {rule.condition}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_STYLES[rule.severity]}`}
                    >
                      {rule.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {rule.channels.map((ch) => (
                        <span key={ch} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs">{rule.triggeredCount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {rule.lastTriggeredAt
                      ? formatDistanceToNow(new Date(rule.lastTriggeredAt), { addSuffix: true })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        title={rule.active ? 'Deactivate' : 'Activate'}
                        onClick={async () => {
                          try {
                            await update.mutateAsync({
                              id: rule.id,
                              body: { active: !rule.active },
                            });
                            toast.success(rule.active ? 'Rule deactivated' : 'Rule activated');
                          } catch {
                            toast.error('Failed to update rule');
                          }
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {rule.active ? (
                          <ToggleRight className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        title="Delete"
                        onClick={async () => {
                          try {
                            await destroy.mutateAsync(rule.id);
                            toast.success('Rule deleted');
                          } catch {
                            toast.error('Failed to delete rule');
                          }
                        }}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {ruleList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No alert rules configured.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
