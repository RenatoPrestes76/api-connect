import type { SloDefinition } from '@/types/ops';

const STATUS_COLORS = {
  compliant: {
    bar: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
    label: '✓ Compliant',
  },
  warning: {
    bar: 'bg-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    label: '⚠ Warning',
  },
  breached: {
    bar: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    label: '✗ Breached',
  },
};

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${value.toFixed(2)}%`;
  if (unit === 'ms') return `${value}ms`;
  if (unit === 's') return `${value}s`;
  return `${value}`;
}

interface Props {
  slo: SloDefinition;
  compact?: boolean;
}

export function SloGauge({ slo, compact = false }: Props) {
  const style = STATUS_COLORS[slo.status];
  const budgetWidth = `${Math.max(0, Math.min(100, slo.errorBudgetPercent))}%`;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{slo.name}</span>
        <span className={`text-xs font-semibold shrink-0 ${style.text}`}>
          {formatValue(slo.current, slo.unit)}
          <span className="font-normal text-zinc-400 ml-1">
            / {formatValue(slo.target, slo.unit)}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{slo.name}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{slo.description}</div>
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ml-2 shrink-0 ${style.text}`}>
          {style.label}
        </span>
      </div>

      <div className="mt-3 flex items-end gap-4">
        <div>
          <div className={`text-2xl font-bold tabular-nums ${style.text}`}>
            {formatValue(slo.current, slo.unit)}
          </div>
          <div className="text-xs text-zinc-400">
            Target: {formatValue(slo.target, slo.unit)} · {slo.windowDays}d window
          </div>
        </div>
      </div>

      {/* Error budget bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Error budget remaining</span>
          <span className={style.text}>{slo.errorBudgetPercent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${style.bar} transition-all`}
            style={{ width: budgetWidth }}
          />
        </div>
      </div>
    </div>
  );
}
