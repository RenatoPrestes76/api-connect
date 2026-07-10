'use client';
import { Handle, Position } from '@xyflow/react';
import type { NodeType } from '@/types/workflow';
import { cn } from '@/lib/utils';

const NODE_COLORS: Record<NodeType, string> = {
  trigger: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950',
  transform: 'border-sky-500 bg-sky-50 dark:bg-sky-950',
  validate: 'border-violet-500 bg-violet-50 dark:bg-violet-950',
  http: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950',
  condition: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
  delay: 'border-slate-500 bg-slate-50 dark:bg-slate-900',
  retry: 'border-orange-500 bg-orange-50 dark:bg-orange-950',
  notification: 'border-pink-500 bg-pink-50 dark:bg-pink-950',
  log: 'border-teal-500 bg-teal-50 dark:bg-teal-950',
  dlq: 'border-red-500 bg-red-50 dark:bg-red-950',
};

const NODE_ICONS: Record<NodeType, string> = {
  trigger: '⚡',
  transform: '⇄',
  validate: '✓',
  http: '↗',
  condition: '◇',
  delay: '⏱',
  retry: '↺',
  notification: '✉',
  log: '≡',
  dlq: '✕',
};

const LABEL_COLORS: Record<NodeType, string> = {
  trigger: 'text-indigo-700 dark:text-indigo-300',
  transform: 'text-sky-700 dark:text-sky-300',
  validate: 'text-violet-700 dark:text-violet-300',
  http: 'text-emerald-700 dark:text-emerald-300',
  condition: 'text-amber-700 dark:text-amber-300',
  delay: 'text-slate-700 dark:text-slate-300',
  retry: 'text-orange-700 dark:text-orange-300',
  notification: 'text-pink-700 dark:text-pink-300',
  log: 'text-teal-700 dark:text-teal-300',
  dlq: 'text-red-700 dark:text-red-300',
};

interface WorkflowNodeData {
  label: string;
  nodeType: NodeType;
  selected?: boolean;
}

export function WorkflowNodeComponent({
  data,
  selected,
}: {
  data: WorkflowNodeData;
  selected?: boolean;
}) {
  const type = data.nodeType;
  const isSource = type !== 'dlq' && type !== 'log';
  const isTarget = type !== 'trigger';

  return (
    <div
      className={cn(
        'min-w-[140px] rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow',
        NODE_COLORS[type],
        selected && 'shadow-md ring-2 ring-offset-1 ring-indigo-400'
      )}
    >
      {isTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !border-2 !border-white !bg-slate-400"
        />
      )}

      <div className="flex items-center gap-2">
        <span className="text-base leading-none select-none">{NODE_ICONS[type]}</span>
        <div className="min-w-0">
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-widest leading-none mb-0.5',
              LABEL_COLORS[type]
            )}
          >
            {type}
          </p>
          <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate leading-tight">
            {data.label}
          </p>
        </div>
      </div>

      {isSource && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-white !bg-slate-400"
        />
      )}

      {/* Condition node gets two source handles */}
      {type === 'condition' && (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Left}
            style={{ top: '70%' }}
            className="!w-3 !h-3 !border-2 !border-white !bg-emerald-400"
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: '70%' }}
            className="!w-3 !h-3 !border-2 !border-white !bg-red-400"
          />
        </>
      )}
    </div>
  );
}
