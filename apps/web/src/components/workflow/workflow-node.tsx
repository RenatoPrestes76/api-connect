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
  // Entrada
  webhook: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950',
  schedule: 'border-purple-500 bg-purple-50 dark:bg-purple-950',
  'file-watch': 'border-purple-500 bg-purple-50 dark:bg-purple-950',
  'email-trigger': 'border-violet-500 bg-violet-50 dark:bg-violet-950',
  'api-trigger': 'border-violet-500 bg-violet-50 dark:bg-violet-950',
  'queue-trigger': 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950',
  'manual-trigger': 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950',
  // Processamento
  loop: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
  aggregate: 'border-amber-600 bg-amber-50 dark:bg-amber-950',
  filter: 'border-amber-700 bg-amber-50 dark:bg-amber-950',
  merge: 'border-stone-500 bg-stone-50 dark:bg-stone-900',
  split: 'border-slate-600 bg-slate-50 dark:bg-slate-900',
  // IA
  'ai-classify': 'border-green-500 bg-green-50 dark:bg-green-950',
  'ai-extract': 'border-green-600 bg-green-50 dark:bg-green-950',
  'ai-generate': 'border-green-700 bg-green-50 dark:bg-green-950',
  'ai-translate': 'border-lime-600 bg-lime-50 dark:bg-lime-950',
  'ai-summarize': 'border-lime-700 bg-lime-50 dark:bg-lime-950',
  'ai-embed': 'border-lime-500 bg-lime-50 dark:bg-lime-950',
  // Saída
  'database-write': 'border-rose-500 bg-rose-50 dark:bg-rose-950',
  'file-write': 'border-rose-600 bg-rose-50 dark:bg-rose-950',
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
  webhook: '⚓',
  schedule: '◷',
  'file-watch': '👁',
  'email-trigger': '✉',
  'api-trigger': '⚡',
  'queue-trigger': '☰',
  'manual-trigger': '▶',
  loop: '↻',
  aggregate: 'Σ',
  filter: '▽',
  merge: '⋈',
  split: '⑂',
  'ai-classify': '◈',
  'ai-extract': '⊃',
  'ai-generate': '✦',
  'ai-translate': '⇄',
  'ai-summarize': '≣',
  'ai-embed': '⊙',
  'database-write': '⛁',
  'file-write': '⇩',
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
  webhook: 'text-indigo-700 dark:text-indigo-300',
  schedule: 'text-purple-700 dark:text-purple-300',
  'file-watch': 'text-purple-700 dark:text-purple-300',
  'email-trigger': 'text-violet-700 dark:text-violet-300',
  'api-trigger': 'text-violet-700 dark:text-violet-300',
  'queue-trigger': 'text-fuchsia-700 dark:text-fuchsia-300',
  'manual-trigger': 'text-fuchsia-700 dark:text-fuchsia-300',
  loop: 'text-yellow-700 dark:text-yellow-300',
  aggregate: 'text-amber-700 dark:text-amber-300',
  filter: 'text-amber-800 dark:text-amber-300',
  merge: 'text-stone-700 dark:text-stone-300',
  split: 'text-slate-700 dark:text-slate-300',
  'ai-classify': 'text-green-700 dark:text-green-300',
  'ai-extract': 'text-green-700 dark:text-green-300',
  'ai-generate': 'text-green-800 dark:text-green-300',
  'ai-translate': 'text-lime-700 dark:text-lime-300',
  'ai-summarize': 'text-lime-800 dark:text-lime-300',
  'ai-embed': 'text-lime-700 dark:text-lime-300',
  'database-write': 'text-rose-700 dark:text-rose-300',
  'file-write': 'text-rose-800 dark:text-rose-300',
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
        'min-w-35 rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow',
        NODE_COLORS[type],
        selected && 'shadow-md ring-2 ring-offset-1 ring-indigo-400'
      )}
    >
      {isTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3! h-3! border-2! border-white! bg-slate-400!"
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
          className="w-3! h-3! border-2! border-white! bg-slate-400!"
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
            className="w-3! h-3! border-2! border-white! bg-emerald-400!"
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: '70%' }}
            className="w-3! h-3! border-2! border-white! bg-red-400!"
          />
        </>
      )}
    </div>
  );
}
