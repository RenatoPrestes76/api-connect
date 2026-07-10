'use client';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { TimelineView } from '@/components/observatory/timeline-view';
import { useTimeline } from '@/hooks/use-observatory';

export default function TimelinePage() {
  const { data, isLoading, isError, error, refetch } = useTimeline({ limit: 50 });

  if (isLoading) return <PageLoading message="Loading timeline…" />;
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load timeline'}
        onRetry={refetch}
      />
    );

  const events = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Execution Timeline"
        description="Step-by-step execution trace for workflow runs — retries, conditions, and durations."
      />

      <div className="rounded-xl border border-border bg-card p-6">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No timeline events found.
          </p>
        ) : (
          <TimelineView events={events} />
        )}
      </div>
    </div>
  );
}
