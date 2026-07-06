import { cn } from '../../lib/utils.js';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../ui/card.js';

interface MetricCardProps {
  title:      string;
  value:      number | string;
  icon?:      LucideIcon;
  sub?:       string;
  className?: string;
}

export function MetricCard({ title, value, icon: Icon, sub, className }: MetricCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
            {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
          </div>
          {Icon && (
            <div className="rounded-lg bg-slate-50 p-2.5">
              <Icon className="h-5 w-5 text-slate-400" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
