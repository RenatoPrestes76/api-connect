'use client';
import Link from 'next/link';
import { Plus, Play, Power, PowerOff, GitBranch, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import {
  useWorkflows,
  useActivateWorkflow,
  useDeactivateWorkflow,
  useRunWorkflow,
} from '@/hooks/use-workflows';
import { useExecutionStats } from '@/hooks/use-executions';
import type { Workflow } from '@/types/workflow';
import { cn } from '@/lib/utils';

const TRIGGER_LABELS = {
  WEBHOOK: 'Webhook',
  CRON: 'Cron',
  EVENT: 'Event',
  MANUAL: 'Manual',
};

export default function WorkflowsPage() {
  const { data: workflows, isLoading, isError, error, refetch } = useWorkflows();
  const { data: stats } = useExecutionStats(true);
  const activate = useActivateWorkflow();
  const deactivate = useDeactivateWorkflow();
  const run = useRunWorkflow();

  if (isLoading) return <PageLoading message="Loading workflows…" />;
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load workflows'}
        onRetry={refetch}
      />
    );

  const list = workflows ?? [];
  const active = list.filter((w) => w.active).length;
  const total = list.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Visual integration flows — build, version and monitor end-to-end automation."
        actions={
          <Link
            href="/workflows/new"
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Workflow
          </Link>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Workflows" value={total} icon={GitBranch} />
        <StatCard label="Active" value={active} icon={Power} color="emerald" />
        <StatCard
          label="Executions (24h)"
          value={stats?.completed24h ?? 0}
          icon={CheckCircle2}
          color="indigo"
        />
        <StatCard label="Failures (24h)" value={stats?.failed24h ?? 0} icon={XCircle} color="red" />
      </div>

      {/* Workflow list */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-16 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">No workflows yet</p>
          <Link
            href="/workflows/new"
            className="mt-3 inline-block text-sm text-indigo-600 hover:underline"
          >
            Create your first workflow
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onActivate={() => activate.mutate(wf.id)}
              onDeactivate={() => deactivate.mutate(wf.id)}
              onRun={() => run.mutate({ id: wf.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({
  workflow,
  onActivate,
  onDeactivate,
  onRun,
}: {
  workflow: Workflow;
  onActivate: () => void;
  onDeactivate: () => void;
  onRun: () => void;
}) {
  const successRate =
    workflow.executionCount > 0
      ? Math.round((workflow.successCount / workflow.executionCount) * 100)
      : null;

  return (
    <div className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                workflow.active ? 'bg-emerald-500' : 'bg-slate-300'
              )}
            />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {workflow.name}
            </p>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {workflow.description || 'No description'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {TRIGGER_LABELS[workflow.triggerType]}
        </span>
      </div>

      {/* Tags */}
      {workflow.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {workflow.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-base font-bold text-slate-800 dark:text-slate-100">
            {workflow.executionCount}
          </p>
          <p className="text-[10px] text-slate-400">Executions</p>
        </div>
        <div>
          <p
            className={cn(
              'text-base font-bold',
              successRate === null
                ? 'text-slate-400'
                : successRate >= 90
                  ? 'text-emerald-600'
                  : successRate >= 70
                    ? 'text-amber-500'
                    : 'text-red-500'
            )}
          >
            {successRate !== null ? `${successRate}%` : '—'}
          </p>
          <p className="text-[10px] text-slate-400">Success</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 font-mono">v{workflow.version}</p>
          <p className="text-[10px] text-slate-400">Version</p>
        </div>
      </div>

      {/* Last run */}
      {workflow.lastExecutedAt && (
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="h-3 w-3" />
          Last run {formatDistanceToNow(new Date(workflow.lastExecutedAt), { addSuffix: true })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <Link
          href={`/workflows/${workflow.id}/builder`}
          className="flex-1 rounded px-2 py-1.5 text-center text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
        >
          Edit
        </Link>
        <Link
          href={`/workflows/${workflow.id}`}
          className="flex-1 rounded px-2 py-1.5 text-center text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          History
        </Link>
        <button
          onClick={onRun}
          className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
          title="Run now"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={workflow.active ? onDeactivate : onActivate}
          className={cn(
            'rounded p-1.5 transition-colors',
            workflow.active
              ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950'
              : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          )}
          title={workflow.active ? 'Deactivate' : 'Activate'}
        >
          {workflow.active ? (
            <PowerOff className="h-3.5 w-3.5" />
          ) : (
            <Power className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'slate',
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-700 dark:text-slate-200',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    indigo: 'text-indigo-700 dark:text-indigo-300',
    red: 'text-red-700 dark:text-red-300',
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', colorMap[color] ?? colorMap['slate'])} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold', colorMap[color] ?? colorMap['slate'])}>{value}</p>
    </div>
  );
}
