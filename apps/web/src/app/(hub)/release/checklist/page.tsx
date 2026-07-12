'use client';
import { useChecklist, useMarkChecklistItem } from '@/hooks/use-release';
import { ChecklistItemRow } from '@/components/release/checklist-item';
import { PageLoading, ErrorState } from '@/components/common/loading-state';
import type { ChecklistCategory, ChecklistStatus } from '@/types/release';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL: Record<ChecklistCategory, string> = {
  produto: 'Produto',
  infra: 'Infraestrutura',
  seguranca: 'Segurança',
  performance: 'Performance',
  suporte: 'Suporte',
  comercial: 'Comercial',
};

const CATEGORIES: ChecklistCategory[] = [
  'produto',
  'infra',
  'seguranca',
  'performance',
  'suporte',
  'comercial',
];

export default function ChecklistPage() {
  const { data: result, isLoading, error } = useChecklist();
  const mark = useMarkChecklistItem();

  if (isLoading) return <PageLoading />;
  if (error || !result) return <ErrorState message="Erro ao carregar checklist" />;

  const pct = Math.round((result.passed / result.total) * 100);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">GA Release Checklist</h1>
          <p className="text-sm text-slate-400">
            {result.passed}/{result.total} concluídos · {result.blockers} blockers
          </p>
        </div>
        <div
          className={cn(
            'rounded-full px-3 py-1 text-sm font-medium',
            result.readyForRelease
              ? 'bg-green-900/40 text-green-300'
              : 'bg-yellow-900/40 text-yellow-300'
          )}
        >
          {result.readyForRelease ? '✓ Pronto para GA' : `${result.pending} pendentes`}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-700">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct === 100 ? 'bg-green-500' : 'bg-blue-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {CATEGORIES.map((cat) => {
        const items = result.items.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        const catData = result.byCategory[cat];
        return (
          <div key={cat}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-400">{CATEGORY_LABEL[cat]}</h2>
              <span className="text-xs text-slate-600">
                {catData.passed}/{catData.total}
              </span>
            </div>
            <div className="space-y-1.5">
              {items.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  onMark={(id, status) =>
                    mark.mutate({ id, status: status as ChecklistStatus, checkedBy: 'admin' })
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
