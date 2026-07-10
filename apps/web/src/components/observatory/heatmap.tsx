'use client';
import type { HeatmapCell } from '@/types/observatory';

interface Props {
  cells: HeatmapCell[];
}

function cellColor(value: number, max: number): string {
  if (value === 0) return 'bg-slate-100 dark:bg-slate-800';
  const pct = value / max;
  if (pct < 0.2) return 'bg-indigo-100 dark:bg-indigo-950';
  if (pct < 0.4) return 'bg-indigo-200 dark:bg-indigo-900';
  if (pct < 0.6) return 'bg-indigo-400 dark:bg-indigo-700';
  if (pct < 0.8) return 'bg-indigo-600 dark:bg-indigo-500';
  return 'bg-indigo-800 dark:bg-indigo-300';
}

export function HeatmapChart({ cells }: Props) {
  if (!cells.length) return null;
  const max = Math.max(...cells.map((c) => c.value));
  const days = [...new Set(cells.map((c) => c.day))].sort((a, b) => b - a);
  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  const dayLabels = ['Today', 'Yesterday', '2d ago', '3d ago', '4d ago', '5d ago', '6d ago'];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1">
          <div className="w-20 flex-shrink-0" />
          {hours.map((h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
              {h % 3 === 0 ? `${h.toString().padStart(2, '0')}h` : ''}
            </div>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-20 flex-shrink-0 text-[10px] text-muted-foreground text-right pr-2">
              {dayLabels[d] ?? `${d}d ago`}
            </div>
            {hours.map((h) => {
              const cell = cells.find((c) => c.day === d && c.hour === h);
              const v = cell?.value ?? 0;
              return (
                <div
                  key={h}
                  title={cell?.label ?? `${dayLabels[d]}, ${h}:00 — ${v} executions`}
                  className={`flex-1 h-5 rounded-[2px] cursor-default transition-opacity hover:opacity-80 ${cellColor(v, max)}`}
                />
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 justify-end">
          <span className="text-[10px] text-muted-foreground mr-1">Less</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((p) => (
            <div
              key={p}
              className={`h-3 w-3 rounded-[2px] ${cellColor(Math.round(p * max), max)}`}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">More</span>
        </div>
      </div>
    </div>
  );
}
