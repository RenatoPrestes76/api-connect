'use client';
import { CONNECTOR_CATEGORIES } from '@/types/marketplace';
import type { ConnectorCategory } from '@/types/marketplace';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  selected: ConnectorCategory | '';
  counts?: Record<string, number>;
  onChange: (cat: ConnectorCategory | '') => void;
}

export function CategoryFilter({ selected, counts, onChange }: CategoryFilterProps) {
  const all = [
    ['', 'Todos'] as [ConnectorCategory | '', string],
    ...CONNECTOR_CATEGORIES.map((c) => [c, c] as [ConnectorCategory | '', string]),
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map(([cat, label]) => {
        const count = cat && counts ? (counts[cat] ?? 0) : undefined;
        return (
          <button
            key={cat}
            onClick={() => onChange(cat as ConnectorCategory | '')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              selected === cat
                ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            )}
          >
            {label}
            {count !== undefined && <span className="ml-1 opacity-60">({count})</span>}
          </button>
        );
      })}
    </div>
  );
}
