import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:   'bg-slate-100 text-slate-700',
        primary:   'bg-indigo-50 text-indigo-700',
        success:   'bg-emerald-50 text-emerald-700',
        warning:   'bg-amber-50 text-amber-700',
        danger:    'bg-rose-50 text-rose-700',
        info:      'bg-blue-50 text-blue-700',
        muted:     'bg-slate-50 text-slate-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
