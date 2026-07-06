'use client';
import { useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { EmptyState } from '@/components/common/empty-state';
import { DiscoveryCard } from '@/components/discovery/confidence-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useDiscoveryRuns, useDiscoveryEntities, useDiscoverySuggestions } from '@/hooks/use-discovery';
import { formatDateTime } from '@/lib/utils';
import type { DiscoveryAnalysis } from '@/types/index';

export default function DiscoveryPage() {
  const [selected, setSelected] = useState<DiscoveryAnalysis | null>(null);

  const runsQuery     = useDiscoveryRuns();
  const entitiesQuery = useDiscoveryEntities(selected?.analysisId ?? '');
  const suggestionsQuery = useDiscoverySuggestions(selected?.analysisId ?? '');

  if (runsQuery.isLoading) return <PageLoading />;
  if (runsQuery.error)     return <ErrorState message="Could not load discovery runs." onRetry={() => void runsQuery.refetch()} />;

  const runs = runsQuery.data ?? [];

  return (
    <div className="space-y-4 max-w-screen-xl">
      <PageHeader
        title="Discovery Reports"
        description={`${runs.length} analysis run${runs.length !== 1 ? 's' : ''}`}
      />

      {runs.length === 0 ? (
        <EmptyState icon={Search} title="No discovery runs" description="Run schema analysis from a connector to see results here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Run list */}
          <div className="space-y-2 lg:col-span-1">
            {runs.map((run) => (
              <button
                key={run.analysisId}
                onClick={() => setSelected(run)}
                className={[
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  selected?.analysisId === run.analysisId
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{run.database}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(run.generatedAt)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Badge variant="primary">{run.summary.entitiesIdentified} entities</Badge>
                  <Badge variant={run.summary.hasRisks ? 'warning' : 'success'}>
                    {run.summary.hasRisks ? 'Has risks' : 'No risks'}
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2 space-y-4">
            {!selected ? (
              <EmptyState icon={Search} title="Select a run" description="Click a discovery run to see details." />
            ) : (
              <>
                {/* Summary */}
                <Card>
                  <CardHeader><CardTitle>Summary — {selected.database}</CardTitle></CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                      {[
                        ['Tables', selected.summary.tablesFound],
                        ['Columns', selected.summary.columnsFound],
                        ['Entities', selected.summary.entitiesIdentified],
                        ['Relationships', selected.summary.relationshipsFound],
                        ['Confidence', `${selected.summary.overallConfidence}%`],
                        ['Duration', `${selected.durationMs}ms`],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <dt className="text-slate-500 text-xs uppercase tracking-wide">{label}</dt>
                          <dd className="font-semibold text-slate-900 tabular-nums">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>

                {/* Entities */}
                {entitiesQuery.data && entitiesQuery.data.entities.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Entities ({entitiesQuery.data.total})</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {entitiesQuery.data.entities.map((e) => (
                          <DiscoveryCard
                            key={e.table}
                            table={e.table}
                            entity={e.entity}
                            confidence={e.confidence}
                            fieldCount={Object.keys(e.fieldRoles).length}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Suggestions */}
                {suggestionsQuery.data && suggestionsQuery.data.suggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Integration Suggestions ({suggestionsQuery.data.total})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {suggestionsQuery.data.suggestions.map((s, i) => (
                        <div key={i} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={s.priority === 1 ? 'primary' : s.priority === 2 ? 'warning' : 'muted'}>
                              P{s.priority}
                            </Badge>
                            <span className="font-medium text-sm">{s.entity}</span>
                            <span className="text-xs text-slate-400 font-mono">{s.table}</span>
                          </div>
                          <p className="text-sm text-slate-600">{s.reason}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Risks */}
                {selected.risks.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Risks ({selected.risks.length})</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {selected.risks.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <Badge variant={r.level === 'critical' ? 'danger' : r.level === 'high' ? 'warning' : 'muted'}>
                            {r.level}
                          </Badge>
                          <div>
                            <p className="font-medium">{r.category}</p>
                            <p className="text-slate-500">{r.description}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
