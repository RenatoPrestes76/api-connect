'use client';
import { Check, X, Clock, SkipForward, Loader2 } from 'lucide-react';
import type { ChecklistItem, ChecklistStatus } from '@/types/release';
import { cn } from '@/lib/utils';

const STATUS_ICON: Record<ChecklistStatus, React.ReactNode> = {
  passed: <Check className="h-3.5 w-3.5 text-green-400" />,
  failed: <X className="h-3.5 w-3.5 text-red-400" />,
  pending: <Clock className="h-3.5 w-3.5 text-slate-500" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />,
  skipped: <SkipForward className="h-3.5 w-3.5 text-slate-600" />,
};

const STATUS_BG: Record<ChecklistStatus, string> = {
  passed: 'bg-green-900/20 border-green-800/40',
  failed: 'bg-red-900/20 border-red-800/40',
  pending: 'bg-slate-800/50 border-slate-700',
  running: 'bg-blue-900/20 border-blue-800/40',
  skipped: 'bg-slate-900/50 border-slate-800',
};

interface Props {
  item: ChecklistItem;
  onMark?: (id: string, status: ChecklistStatus) => void;
}

export function ChecklistItemRow({ item, onMark }: Props) {
  return (
    <div className={cn('flex items-start gap-3 rounded border px-3 py-2', STATUS_BG[item.status])}>
      <span className="mt-0.5 shrink-0">{STATUS_ICON[item.status]}</span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm',
            item.status === 'passed'
              ? 'text-slate-300'
              : item.status === 'failed'
                ? 'text-red-300'
                : item.status === 'skipped'
                  ? 'text-slate-600 line-through'
                  : 'text-slate-200'
          )}
        >
          {item.label}
          {item.blocksRelease && item.status !== 'passed' && (
            <span className="ml-2 rounded bg-red-900/40 px-1 py-0.5 text-xs text-red-400">
              blocker
            </span>
          )}
        </p>
        {item.notes && <p className="mt-0.5 text-xs text-slate-500">{item.notes}</p>}
        {item.checkedBy && <p className="mt-0.5 text-xs text-slate-600">by {item.checkedBy}</p>}
      </div>
      {onMark && item.status === 'pending' && (
        <div className="flex gap-1">
          <button
            onClick={() => onMark(item.id, 'passed')}
            className="rounded bg-green-800/30 px-2 py-1 text-xs text-green-400 hover:bg-green-800/50"
          >
            ✓
          </button>
          <button
            onClick={() => onMark(item.id, 'failed')}
            className="rounded bg-red-800/30 px-2 py-1 text-xs text-red-400 hover:bg-red-800/50"
          >
            ✗
          </button>
        </div>
      )}
    </div>
  );
}
