'use client';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Plus, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import {
  IncidentStatusBadge,
  IncidentSeverityBadge,
} from '@/components/observatory/incident-badge';
import { useIncidents, useUpdateIncidentStatus, useCreateIncident } from '@/hooks/use-observatory';
import type { Incident, IncidentStatus } from '@/types/observatory';

const STATUS_ORDER: IncidentStatus[] = ['OPEN', 'INVESTIGATING', 'FIXED', 'RESOLVED', 'CLOSED'];

function IncidentRow({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateIncidentStatus();

  const advance = async () => {
    const idx = STATUS_ORDER.indexOf(incident.status);
    const next = STATUS_ORDER[idx + 1];
    if (!next) return;
    try {
      await update.mutateAsync({ id: incident.id, status: next });
      toast.success(`Incident moved to ${next}`);
    } catch {
      toast.error('Failed to update incident');
    }
  };

  const nextStatus = STATUS_ORDER[STATUS_ORDER.indexOf(incident.status) + 1];

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        className="w-full flex items-center gap-4 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{incident.title}</span>
            <IncidentStatusBadge status={incident.status} />
            <IncidentSeverityBadge severity={incident.severity} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{incident.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(incident.openedAt), { addSuffix: true })}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {incident.cause && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Root Cause
              </p>
              <p className="text-sm mt-1">{incident.cause}</p>
            </div>
          )}
          {incident.resolution && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Resolution
              </p>
              <p className="text-sm mt-1">{incident.resolution}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Timeline
            </p>
            <div className="space-y-2">
              {incident.events.map((ev) => (
                <div key={ev.id} className="flex gap-3 text-xs">
                  <IncidentStatusBadge status={ev.status} />
                  <span className="flex-1">{ev.message}</span>
                  <span className="text-muted-foreground">{ev.author}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {nextStatus && incident.status !== 'CLOSED' && (
            <button
              onClick={advance}
              disabled={update.isPending}
              className="text-xs rounded-lg border border-border px-3 py-1.5 hover:bg-muted transition-colors"
            >
              Advance to {nextStatus}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  const { data, isLoading, isError, error, refetch } = useIncidents(undefined, true);
  const create = useCreateIncident();

  if (isLoading) return <PageLoading message="Loading incidents…" />;
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load incidents'}
        onRetry={refetch}
      />
    );

  const incidents = data?.items ?? [];
  const open = incidents.filter((i) => i.status === 'OPEN').length;
  const inv = incidents.filter((i) => i.status === 'INVESTIGATING').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Management"
        description="Track and resolve platform incidents through a structured lifecycle."
        actions={
          <button
            onClick={async () => {
              try {
                await create.mutateAsync({
                  title: 'New Incident',
                  severity: 'MEDIUM',
                  description: 'Describe the incident...',
                });
                toast.success('Incident created');
              } catch {
                toast.error('Failed to create incident');
              }
            }}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Incident
          </button>
        }
      />

      <div className="flex gap-4">
        {[
          { label: 'Open', val: open, color: 'text-red-600 dark:text-red-400' },
          { label: 'Investigating', val: inv, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Total', val: incidents.length, color: '' },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-4 py-3">
            <div className={`text-xl font-bold tabular-nums ${color}`}>{val}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 opacity-30" />
          <p className="text-sm">No incidents found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <IncidentRow key={inc.id} incident={inc} />
          ))}
        </div>
      )}
    </div>
  );
}
