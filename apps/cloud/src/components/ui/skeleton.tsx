import type { ReactElement } from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps): ReactElement {
  return <div className={cn('animate-pulse rounded bg-slate-200', className)} />;
}
