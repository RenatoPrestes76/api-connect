import type { FeatureFlag } from '@/types/ops';

interface Props {
  flag: FeatureFlag;
  onToggle?: (id: string, enabled: boolean) => void;
}

export function FeatureFlagToggle({ flag, onToggle }: Props) {
  return (
    <div className="flex items-center justify-between py-3 px-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{flag.name}</span>
          {flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
              {flag.rolloutPercentage}%
            </span>
          )}
          {flag.variants.length > 0 && (
            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">
              A/B
            </span>
          )}
          {flag.targetingRules.length > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
              Targeting
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5 truncate">{flag.description || flag.key}</div>
      </div>
      <div className="ml-4 flex items-center gap-3 shrink-0">
        <span className="text-xs text-zinc-400">{flag.createdBy}</span>
        {onToggle ? (
          <button
            role="switch"
            aria-checked={flag.enabled}
            onClick={() => onToggle(flag.id, !flag.enabled)}
            className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none ${
              flag.enabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${
                flag.enabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        ) : (
          <span
            className={`text-xs font-medium ${flag.enabled ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'}`}
          >
            {flag.enabled ? 'On' : 'Off'}
          </span>
        )}
      </div>
    </div>
  );
}
