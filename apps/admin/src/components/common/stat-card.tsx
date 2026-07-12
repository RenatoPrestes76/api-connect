import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; direction: 'up' | 'down' };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<StatCardProps['variant']>, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps): ReactElement {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p
            className={cn(
              'mt-1 text-2xl font-semibold leading-none tabular-nums',
              VARIANT_CLASSES[variant]
            )}
          >
            {value}
          </p>
          {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                trend.direction === 'up' ? 'text-success' : 'text-danger'
              )}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="shrink-0 rounded-lg bg-muted p-2">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
    </Card>
  );
}
