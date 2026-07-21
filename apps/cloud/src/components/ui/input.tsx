import type { InputHTMLAttributes, ReactElement, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps): ReactElement {
  return (
    <input
      {...props}
      className={cn(
        'h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400',
        'focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
        className
      )}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps): ReactElement {
  return (
    <select
      {...props}
      className={cn(
        'h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900',
        'focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200',
        'disabled:cursor-not-allowed disabled:bg-slate-50',
        className
      )}
    >
      {children}
    </select>
  );
}
