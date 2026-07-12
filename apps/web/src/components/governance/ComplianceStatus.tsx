'use client';

import type { ComplianceFrameworkStatus } from '@/types/governance';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBar(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props {
  overallScore: number;
  frameworks: ComplianceFrameworkStatus[];
}

export function ComplianceStatus({ overallScore, frameworks }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Compliance Status</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Overall</span>
          <span className={`text-xl font-bold ${scoreColor(overallScore)}`}>{overallScore}%</span>
        </div>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {frameworks.map((fw) => (
          <div key={fw.framework} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{fw.label}</p>
                <span className="text-[10px] text-zinc-400">{fw.totalControls} controls</span>
              </div>
              <span className={`text-sm font-bold ${scoreColor(fw.complianceScore)}`}>
                {fw.complianceScore}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full transition-all ${scoreBar(fw.complianceScore)}`}
                style={{ width: `${fw.complianceScore}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-400">
              <span className="text-emerald-600 dark:text-emerald-400">
                ✓ {fw.compliant} compliant
              </span>
              {fw.partial > 0 && (
                <span className="text-amber-600 dark:text-amber-400">~ {fw.partial} partial</span>
              )}
              {fw.nonCompliant > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  ✗ {fw.nonCompliant} non-compliant
                </span>
              )}
              {fw.underReview > 0 && (
                <span className="text-blue-500">⟳ {fw.underReview} review</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
