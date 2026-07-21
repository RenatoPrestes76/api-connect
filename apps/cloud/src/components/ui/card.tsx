import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps): ReactElement {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps): ReactElement {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-slate-100 px-5 py-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: CardProps): ReactElement {
  return <h3 className={cn('text-sm font-semibold text-slate-900', className)}>{children}</h3>;
}

export function CardContent({ children, className }: CardProps): ReactElement {
  return <div className={cn('p-5', className)}>{children}</div>;
}
