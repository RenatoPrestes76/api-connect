import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface MetricCardProps {
  title:      string;
  value:      string | number;
  subtitle?:  string;
  icon?:      LucideIcon;
  trend?:     { value: number; direction: 'up' | 'down' };
  variant?:   'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantClasses = {
  default: 'text-slate-700',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger:  'text-rose-600',
};

export function MetricCard({
  title, value, subtitle, icon: Icon, trend, variant = 'default', className,
}: MetricCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{title}</p>
          <p className={cn('mt-1 text-2xl font-semibold tabular leading-none', variantClasses[variant])}>
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-slate-400 truncate">{subtitle}</p>}
          {trend && (
            <p className={cn(
              'mt-1 text-xs font-medium',
              trend.direction === 'up' ? 'text-emerald-600' : 'text-rose-500',
            )}>
              {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="shrink-0 rounded-lg bg-slate-50 p-2">
            <Icon className="h-4 w-4 text-slate-400" aria-hidden />
          </div>
        )}
      </div>
    </Card>
  );
}
