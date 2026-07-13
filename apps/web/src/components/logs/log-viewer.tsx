'use client';
import { useState, useRef, useEffect } from 'react';
import { Download, WrapText, Trash2 } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { LOG_LEVEL_COLORS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import type { LogEntry } from '@/types/index';

interface LogViewerProps {
  entries: LogEntry[];
  autoScroll?: boolean;
  maxHeight?: string;
  onExport?: () => void;
  className?: string;
}

export function LogViewer({
  entries,
  autoScroll = true,
  maxHeight = '400px',
  onExport,
  className,
}: LogViewerProps) {
  const [wrap, setWrap] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [entries, autoScroll]);

  return (
    <div
      className={cn('flex flex-col rounded-lg border border-slate-200 overflow-hidden', className)}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className="text-xs text-slate-500">{entries.length} entries</span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setWrap(!wrap)} title="Toggle wrap">
            <WrapText className={cn('h-3.5 w-3.5', wrap ? 'text-indigo-600' : '')} />
          </Button>
          {onExport && (
            <Button size="icon" variant="ghost" onClick={onExport} title="Export">
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Log lines */}
      <div
        className="overflow-y-auto overflow-x-auto bg-slate-950 font-mono text-xs"
        style={{ maxHeight }}
      >
        {entries.length === 0 ? (
          <p className="p-4 text-slate-600">No log entries</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'flex gap-3 px-3 py-0.5 hover:bg-slate-900',
                !wrap && 'whitespace-nowrap'
              )}
            >
              <span className="shrink-0 text-slate-600">{formatDateTime(entry.timestamp)}</span>
              <span className={cn('shrink-0 w-10', LOG_LEVEL_COLORS[entry.level])}>
                {entry.level.toUpperCase()}
              </span>
              {entry.connector && (
                <span className="shrink-0 text-slate-500 hidden sm:block">[{entry.connector}]</span>
              )}
              <span className="text-slate-300 min-w-0">{entry.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

interface LogLevelBadgeProps {
  level: LogEntry['level'];
}

export function LogLevelBadge({ level }: LogLevelBadgeProps) {
  return (
    <span className={cn('font-mono text-xs font-medium uppercase', LOG_LEVEL_COLORS[level])}>
      {level}
    </span>
  );
}
