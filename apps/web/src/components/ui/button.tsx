'use client';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800',
        secondary:   'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300',
        outline:     'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100',
        ghost:       'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        danger:      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
        'danger-outline': 'border border-rose-200 text-rose-600 hover:bg-rose-50',
        success:     'bg-emerald-600 text-white hover:bg-emerald-700',
      },
      size: {
        sm:   'h-7  px-2.5 text-xs',
        md:   'h-9  px-3.5',
        lg:   'h-10 px-5 text-base',
        icon: 'h-8  w-8 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
