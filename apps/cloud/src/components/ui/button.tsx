'use client';
import { cn } from '../../lib/utils.js';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?:    'sm' | 'md' | 'lg';
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'bg-slate-900 text-white hover:bg-slate-800 border border-slate-900',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300',
  ghost:     'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent',
  danger:    'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600',
  outline:   'bg-transparent text-slate-700 hover:bg-slate-50 border border-slate-300',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
};

export function Button({ variant = 'primary', size = 'md', className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant], SIZES[size], className,
      )}
    >
      {children}
    </button>
  );
}
