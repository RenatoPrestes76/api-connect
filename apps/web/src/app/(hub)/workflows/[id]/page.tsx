'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, GitBranch, CheckCircle2, XCircle, Clock, Edit3 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { ExecutionLogViewer } from '@/components/workflow/execution-log-viewer';
import { useWorkflow, useWorkflowVersions, useRunWorkflow } from '@/hooks/use-workflows';
import { useExecutions } from '@/hooks/use-executions';
import type { WorkflowExecution } from '@/types/workflow';
import { cn } from '@/lib/utils';

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: wf, isLoading, isError, error } = useWorkflow(id);
  const { data: versions } = useWorkflowVersions(id);
  const { data: execResult } = useExecutions({ workflowId: id, limit: 20 }, true);
  const { data: allVersions } = useWorkflowVersions(id);
  const run = useRunWorkflow();

  const [selectedExec, setSelectedExec] = useState<WorkflowExecution | null>(null);
  void allVersions;

  if (isLoading) return <PageLoading message="Loading workflow…" />;
  if (isError)
    return <ErrorState message={(error as Error)?.message ?? 'Failed to load workflow'} />;
  if (!wf) return <ErrorState message="Workflow not found" />;

  const executions = execResult?.data ?? [];
  const successRate =
    wf.executionCount > 0 ? Math.round((wf.successCount / wf.executionCount) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/workflows"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </Link>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{wf.name}</h1>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            wf.active
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
          )}
        >
          {wf.active ? 'Active' : 'Inactive'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => run.mutate({ id: wf.id })}
            disabled={run.isPending}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            Run Now
          </button>
          <Link
            href={`/workflows/${id}/builder`}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit in Builder
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Runs"
          value={String(wf.executionCount)}
          sub="all time"
          icon={GitBranch}
        />
        <StatCard
          label="Success Rate"
          value={successRate !== null ? `${successRate}%` : '—'}
          sub={`${wf.successCount} ok / ${wf.failureCount} err`}
          icon={CheckCircle2}
          color={successRate !== null && successRate >= 90 ? 'emerald' : 'amber'}
        />
        <StatCard
          label="Last Run"
          value={
            wf.lastExecutedAt
              ? formatDistanceToNow(new Date(wf.lastExecutedAt), { addSuffix: true })
              : 'Never'
          }
          sub={wf.triggerType}
          icon={Clock}
        />
        <StatCard
          label="Version"
          value={`v${wf.version}`}
          sub={`${versions?.length ?? 0} version(s)`}
          icon={GitBranch}
        />
      </div>

      {/* Execution history + log viewer */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Execution list */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Execution History
            </h2>
          </div>
          {executions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">No executions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {executions.map((exec) => (
                <ExecRow
                  key={exec.id}
                  exec={exec}
                  selected={selectedExec?.id === exec.id}
                  onClick={() => setSelectedExec(selectedExec?.id === exec.id ? null : exec)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Log viewer */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {selectedExec ? 'Execution Trace' : 'Select an execution'}
            </h2>
          </div>
          {selectedExec ? (
            <div className="overflow-y-auto max-h-96">
              <ExecutionLogViewer execution={selectedExec} />
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">Click a row to inspect its steps</p>
            </div>
          )}
        </div>
      </div>

      {/* Version history */}
      {versions && versions.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Version History
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...versions].reverse().map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-600 dark:text-slate-300">
                  v{v.version}
                </span>
                <span className="flex-1 text-xs text-slate-600 dark:text-slate-300">
                  {v.note ?? 'No note'}
                </span>
                <span className="text-xs text-slate-400">{v.author}</span>
                <span className="text-xs text-slate-400">
                  {format(new Date(v.createdAt), 'dd MMM yyyy')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'text-emerald-600 dark:text-emerald-400',
  FAILED: 'text-red-600 dark:text-red-400',
  RUNNING: 'text-blue-600 dark:text-blue-400',
  CANCELLED: 'text-slate-500',
  PENDING: 'text-slate-400',
  TIMEOUT: 'text-orange-500',
};

function ExecRow({
  exec,
  selected,
  onClick,
}: {
  exec: WorkflowExecution;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        selected ? 'bg-indigo-50 dark:bg-indigo-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
      )}
    >
      {exec.status === 'COMPLETED' ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold', STATUS_STYLES[exec.status] ?? 'text-slate-500')}>
          {exec.status}
        </p>
        <p className="text-[11px] text-slate-400 font-mono truncate">{exec.id.slice(0, 16)}…</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[11px] text-slate-500 font-mono">
          {exec.durationMs ? `${exec.durationMs}ms` : '—'}
        </p>
        <p className="text-[10px] text-slate-400">
          {formatDistanceToNow(new Date(exec.startedAt), { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'slate',
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-700 dark:text-slate-200',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={cn('text-xl font-bold', colorMap[color] ?? colorMap['slate'])}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
