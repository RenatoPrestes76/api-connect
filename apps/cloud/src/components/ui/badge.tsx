import { cn } from '../../lib/utils.js';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
  className?: string;
}

const VARIANTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  default:  'bg-slate-100 text-slate-700',
  outline:  'border border-slate-300 text-slate-600 bg-transparent',
  success:  'bg-emerald-50 text-emerald-700',
  warning:  'bg-amber-50 text-amber-700',
  danger:   'bg-rose-50 text-rose-700',
  info:     'bg-blue-50 text-blue-700',
  muted:    'bg-slate-100 text-slate-400',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', VARIANTS[variant], className)}>
      {children}
    </span>
  );
}
