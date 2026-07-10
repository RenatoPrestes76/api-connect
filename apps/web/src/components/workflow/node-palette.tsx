'use client';
import type { DragEvent } from 'react';
import { NODE_PALETTE } from '@/types/workflow';
import type { NodeType, NodePaletteItem } from '@/types/workflow';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<NodePaletteItem['category'], string> = {
  trigger: 'Trigger',
  processing: 'Processing',
  control: 'Control Flow',
  output: 'Output',
};

const ICON_MAP: Record<NodeType, string> = {
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

interface NodePaletteProps {
  onDragStart?: (type: NodeType) => void;
}

export function NodePalette({ onDragStart }: NodePaletteProps) {
  const categories = ['trigger', 'processing', 'control', 'output'] as const;

  const handleDragStart = (e: DragEvent<HTMLDivElement>, type: NodeType) => {
    e.dataTransfer.setData('application/workflow-node-type', type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(type);
  };

  return (
    <aside className="w-48 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto">
      <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Node Types</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Drag to canvas</p>
      </div>

      <div className="py-2 space-y-3 px-2">
        {categories.map((cat) => {
          const items = NODE_PALETTE.filter((n) => n.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <p className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="space-y-1">
                {items.map((item) => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.type)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 cursor-grab',
                      'border border-transparent hover:border-slate-200 dark:hover:border-slate-700',
                      'bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-750',
                      'transition-colors select-none active:cursor-grabbing'
                    )}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm"
                      style={{ backgroundColor: `${item.color}20`, color: item.color }}
                    >
                      {ICON_MAP[item.type]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                        {item.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
