'use client';

import type { GovernancePolicy } from '@/types/governance';

const ENFORCEMENT_BADGE: Record<string, string> = {
  mandatory:
    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  advisory:
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  disabled: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700',
};

const CAT_ICON: Record<string, string> = {
  security: '🔒',
  access: '🔑',
  deployment: '🚀',
  data: '🗄',
  operational: '⚙️',
  compliance: '✅',
};

interface Props {
  policies: GovernancePolicy[];
}

export function PolicyCenter({ policies }: Props) {
  const enabled = policies.filter((p) => p.enabled);
  const disabled = policies.filter((p) => !p.enabled);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Policy Center</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {enabled.length} active · {disabled.length} disabled
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          {['mandatory', 'advisory', 'disabled'].map((e) => (
            <span
              key={e}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${ENFORCEMENT_BADGE[e]}`}
            >
              {e}
            </span>
          ))}
        </div>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {policies.map((p) => (
          <div key={p.id} className="flex items-start gap-3 px-4 py-3">
            <span className="text-lg mt-0.5">{CAT_ICON[p.category] ?? '📋'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {p.name}
                </p>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ENFORCEMENT_BADGE[p.enforcement] ?? ''}`}
                >
                  {p.enforcement}
                </span>
                {!p.enabled && (
                  <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                    disabled
                  </span>
                )}
                <span className="text-[10px] text-zinc-400">v{p.version}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                {p.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
