'use client';
import type { ReleaseStage } from '@/types/release';
import { cn } from '@/lib/utils';

const STAGE_STYLE: Record<ReleaseStage, string> = {
  beta: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
  rc1: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  rc2: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/40',
  rc3: 'bg-teal-900/40 text-teal-300 border-teal-700/40',
  ga: 'bg-green-900/40 text-green-300 border-green-700/40',
};

const STAGE_LABEL: Record<ReleaseStage, string> = {
  beta: 'Beta',
  rc1: 'RC1',
  rc2: 'RC2',
  rc3: 'RC3',
  ga: 'GA',
};

interface Props {
  version: string;
  stage: ReleaseStage;
  className?: string;
}

export function VersionBadge({ version, stage, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-sm font-mono font-medium',
        STAGE_STYLE[stage],
        className
      )}
    >
      v{version}
      <span
        className={cn(
          'rounded px-1 py-px text-xs font-sans font-bold',
          stage === 'ga' ? 'bg-green-700/50' : 'bg-slate-700/50'
        )}
      >
        {STAGE_LABEL[stage]}
      </span>
    </span>
  );
}
