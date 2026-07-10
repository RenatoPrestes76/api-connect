'use client';
import { Play, Save, Power, PowerOff, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Workflow } from '@/types/workflow';
import { cn } from '@/lib/utils';

interface WorkflowToolbarProps {
  workflow: Workflow | null;
  isDirty: boolean;
  isSaving: boolean;
  isRunning: boolean;
  onSave: () => void;
  onRun: () => void;
  onToggleActive: () => void;
}

export function WorkflowToolbar({
  workflow,
  isDirty,
  isSaving,
  isRunning,
  onSave,
  onRun,
  onToggleActive,
}: WorkflowToolbarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
      <Link
        href="/workflows"
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Workflows</span>
      </Link>

      <span className="text-slate-300 dark:text-slate-600">|</span>

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
          {workflow?.name ?? 'Untitled Workflow'}
        </h1>
        {workflow && (
          <p className="text-[10px] text-slate-400">
            v{workflow.version} · {workflow.active ? 'Active' : 'Inactive'}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isDirty && <span className="text-[10px] text-amber-500 font-medium">Unsaved changes</span>}

        <button
          onClick={onRun}
          disabled={isRunning}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
            'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Play className="h-3 w-3" />
          {isRunning ? 'Running…' : 'Run'}
        </button>

        <button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
            'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Save className="h-3 w-3" />
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        {workflow && (
          <button
            onClick={onToggleActive}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
              workflow.active
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                : 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200'
            )}
          >
            {workflow.active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
            {workflow.active ? 'Deactivate' : 'Activate'}
          </button>
        )}
      </div>
    </div>
  );
}
