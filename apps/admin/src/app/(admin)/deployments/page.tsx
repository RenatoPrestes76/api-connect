'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { CheckCircle2, Plus, Undo2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { LoadingTable } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RequirePermission } from '@/components/auth/require-permission';
import {
  useApproveDeploymentJob,
  useCreateDeploymentJob,
  useDeploymentJobs,
  useRejectDeploymentJob,
  useRollbackDeploymentJob,
} from '@/hooks/use-deployment-jobs';
import { useOrganizations } from '@/hooks/use-organizations';
import { useEnvironments } from '@/hooks/use-environments';
import { useConnectors, useConnectorVersions } from '@/hooks/use-connectors';
import type { DeploymentJob, DeploymentMode } from '@/types/fleet';

const STATUS_VARIANT: Record<
  DeploymentJob['status'],
  'success' | 'warning' | 'danger' | 'default'
> = {
  PENDING_APPROVAL: 'warning',
  SCHEDULED: 'default',
  APPROVED: 'default',
  IN_PROGRESS: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  REJECTED: 'danger',
  ROLLED_BACK: 'default',
};

const MODE_LABEL: Record<DeploymentMode, string> = {
  MANUAL: 'Manual',
  AUTOMATIC: 'Automático',
  SCHEDULED: 'Agendado',
};

function CreateJobDialog({ open, onClose }: { open: boolean; onClose: () => void }): ReactElement {
  const { data: organizations } = useOrganizations();
  const [organizationId, setOrganizationId] = useState('');
  const { data: environments } = useEnvironments(organizationId || undefined);
  const { data: connectors } = useConnectors();
  const [pluginId, setPluginId] = useState('');
  const { data: versions } = useConnectorVersions(pluginId || undefined);
  const [environmentId, setEnvironmentId] = useState('');
  const [pluginVersionId, setPluginVersionId] = useState('');
  const [mode, setMode] = useState<DeploymentMode>('MANUAL');
  const [scheduledAt, setScheduledAt] = useState('');
  const createJob = useCreateDeploymentJob();

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!organizationId || !environmentId || !pluginId || !pluginVersionId) return;
    await createJob.mutateAsync({
      organizationId,
      environmentId,
      pluginId,
      pluginVersionId,
      mode,
      scheduledAt: mode === 'SCHEDULED' ? new Date(scheduledAt).toISOString() : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Deployment</DialogTitle>
          <DialogDescription>
            Manual requer aprovação, automático executa imediatamente, agendado aguarda o horário
            definido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            required
            className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
          >
            <option value="">Organization</option>
            {organizations?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select
            value={environmentId}
            onChange={(e) => setEnvironmentId(e.target.value)}
            required
            disabled={!organizationId}
            className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground disabled:opacity-50"
          >
            <option value="">Ambiente</option>
            {environments?.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
          <select
            value={pluginId}
            onChange={(e) => setPluginId(e.target.value)}
            required
            className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
          >
            <option value="">Connector</option>
            {connectors?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={pluginVersionId}
            onChange={(e) => setPluginVersionId(e.target.value)}
            required
            disabled={!pluginId}
            className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground disabled:opacity-50"
          >
            <option value="">Versão</option>
            {versions?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.version}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {(['MANUAL', 'AUTOMATIC', 'SCHEDULED'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded border px-3 py-1.5 text-sm ${
                  mode === m
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {mode === 'SCHEDULED' && (
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={createJob.isPending}>
              Criar Deployment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeployCenterContent(): ReactElement {
  const { data, isLoading, isError, refetch } = useDeploymentJobs();
  const approve = useApproveDeploymentJob();
  const reject = useRejectDeploymentJob();
  const rollback = useRollbackDeploymentJob();
  const [createOpen, setCreateOpen] = useState(false);

  const columns: Column<DeploymentJob>[] = [
    {
      key: 'id',
      header: 'Job',
      cell: (j) => <span className="font-mono text-xs">{j.id.slice(0, 8)}</span>,
    },
    { key: 'mode', header: 'Modo', cell: (j) => MODE_LABEL[j.mode] },
    {
      key: 'status',
      header: 'Status',
      cell: (j) => <Badge variant={STATUS_VARIANT[j.status]}>{j.status}</Badge>,
    },
    {
      key: 'scheduledAt',
      header: 'Agendado para',
      cell: (j) => (j.scheduledAt ? new Date(j.scheduledAt).toLocaleString('pt-BR') : '—'),
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      cell: (j) => new Date(j.createdAt).toLocaleString('pt-BR'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (j) => (
        <div className="flex justify-end gap-1">
          {j.status === 'PENDING_APPROVAL' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => approve.mutate(j.id)}
                aria-label="Aprovar"
              >
                <CheckCircle2 className="h-4 w-4 text-success" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => reject.mutate(j.id)}
                aria-label="Rejeitar"
              >
                <XCircle className="h-4 w-4 text-danger" />
              </Button>
            </>
          )}
          {j.status === 'SUCCEEDED' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => rollback.mutate(j.id)}
              aria-label="Reverter"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deploy Center"
        description="Deploy manual, automático e agendado — com fluxo de aprovação e rollback."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Deployment
          </Button>
        }
      />

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={4} cols={6} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar deployments" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(j) => j.id}
          emptyMessage="Nenhum deployment criado ainda."
        />
      )}

      <CreateJobDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export default function DeploymentsPage(): ReactElement {
  return (
    <RequirePermission permission="marketplace.review">
      <DeployCenterContent />
    </RequirePermission>
  );
}
