import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/types/index';

const CONFIG: Record<
  HealthStatus,
  {
    icon: typeof CheckCircle2;
    bg: string;
    text: string;
    label: string;
  }
> = {
  healthy: { icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Healthy' },
  degraded: { icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-600', label: 'Degraded' },
  unhealthy: { icon: XCircle, bg: 'bg-rose-50', text: 'text-rose-600', label: 'Unhealthy' },
  unknown: { icon: HelpCircle, bg: 'bg-slate-50', text: 'text-slate-400', label: 'Unknown' },
};

interface HealthIndicatorProps {
  status: HealthStatus;
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function HealthIndicator({
  status,
  label,
  showLabel = true,
  size = 'md',
  className,
}: HealthIndicatorProps) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  const iconSize = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' }[size];
  const textSize = { sm: 'text-xs', md: 'text-xs', lg: 'text-sm' }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium',
        cfg.bg,
        cfg.text,
        textSize,
        className
      )}
    >
      <Icon className={cn(iconSize, 'shrink-0')} aria-hidden />
      {showLabel && (label ?? cfg.label)}
    </span>
  );
}

// ─── Metric gauge bar ─────────────────────────────────────────────────────────

interface MetricGaugeProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  status?: HealthStatus;
}

export function MetricGauge({
  label,
  value,
  max,
  unit = '%',
  status = 'healthy',
}: MetricGaugeProps) {
  const pct = Math.round((value / max) * 100);
  const barColor =
    status === 'unhealthy'
      ? 'bg-rose-500'
      : status === 'degraded'
        ? 'bg-amber-400'
        : 'bg-emerald-500';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular text-slate-500">
          {value}
          {unit} / {max}
          {unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
    </div>
  );
}
