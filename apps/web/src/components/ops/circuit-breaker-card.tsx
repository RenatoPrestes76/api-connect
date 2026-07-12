import type { CircuitBreakerMetrics, CircuitState } from '@/types/ops';

const STATE_STYLES: Record<CircuitState, { badge: string; border: string; label: string }> = {
  CLOSED: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    label: 'Closed',
  },
  OPEN: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    border: 'border-red-300 dark:border-red-700',
    label: 'Open',
  },
  HALF_OPEN: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700',
    label: 'Half-Open',
  },
};

interface Props {
  circuit: CircuitBreakerMetrics;
  onReset?: (name: string) => void;
}

export function CircuitBreakerCard({ circuit, onReset }: Props) {
  const style = STATE_STYLES[circuit.state];
  return (
    <div className={`rounded-lg border ${style.border} bg-white dark:bg-zinc-900 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {circuit.name}
            </span>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${style.badge}`}>
              {style.label}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-zinc-500">
            <div>
              <div className="font-medium text-zinc-700 dark:text-zinc-300">{circuit.failures}</div>
              <div>Failures</div>
            </div>
            <div>
              <div className="font-medium text-zinc-700 dark:text-zinc-300">
                {circuit.totalRequests}
              </div>
              <div>Total</div>
            </div>
            <div>
              <div className="font-medium text-zinc-700 dark:text-zinc-300">
                {circuit.rejectedRequests}
              </div>
              <div>Rejected</div>
            </div>
          </div>
          {circuit.lastFailureTime && (
            <div className="mt-1 text-xs text-zinc-400">
              Last failure: {new Date(circuit.lastFailureTime).toLocaleString()}
            </div>
          )}
        </div>
        {onReset && circuit.state !== 'CLOSED' && (
          <button
            onClick={() => onReset(circuit.name)}
            className="shrink-0 text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
