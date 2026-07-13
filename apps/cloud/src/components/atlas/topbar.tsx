'use client';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';

interface TopbarProps {
  className?: string;
}

export function Topbar({ className }: TopbarProps) {
  const qc = useQueryClient();

  function handleRefresh(): void {
    void qc.invalidateQueries();
  }

  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">Atlas Operations Dashboard</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRefresh}
          title="Refresh all data"
          className="flex h-8 w-8 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
