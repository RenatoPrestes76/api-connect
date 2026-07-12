'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Plus, Rocket, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { LoadingTable } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RequirePermission } from '@/components/auth/require-permission';
import {
  useConnectors,
  useConnectorVersions,
  useCreateConnectorVersion,
  usePublishConnectorVersion,
} from '@/hooks/use-connectors';
import { useDeployments, useRollbackDeployment } from '@/hooks/use-deployments';
import { useOrganizations } from '@/hooks/use-organizations';
import {
  useConnectorLogs,
  useInstallConnector,
  useRemoveConnector,
  useRestartConnector,
} from '@/hooks/use-fleet';
import type { Connector, ConnectorVersion, Deployment } from '@/types/control-plane';

const STATUS_VARIANT: Record<Connector['status'], 'success' | 'default' | 'warning' | 'danger'> = {
  PUBLISHED: 'success',
  DRAFT: 'default',
  DEPRECATED: 'warning',
  ARCHIVED: 'danger',
};

const DEPLOYMENT_VARIANT: Record<
  Deployment['status'],
  'success' | 'warning' | 'danger' | 'default'
> = {
  SUCCEEDED: 'success',
  IN_PROGRESS: 'warning',
  PENDING: 'default',
  FAILED: 'danger',
  ROLLED_BACK: 'default',
};

function ConnectorOperations({ connector }: { connector: Connector }): ReactElement {
  const { data: organizations } = useOrganizations();
  const [organizationId, setOrganizationId] = useState('');
  const { data: logs } = useConnectorLogs(connector.id, organizationId || undefined);
  const install = useInstallConnector();
  const restart = useRestartConnector();
  const remove = useRemoveConnector();

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Operações</p>
      <select
        value={organizationId}
        onChange={(e) => setOrganizationId(e.target.value)}
        className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
      >
        <option value="">Selecione uma organization</option>
        {organizations?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {organizationId && (
        <>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={install.isPending}
              onClick={() =>
                install.mutate({
                  connectorId: connector.id,
                  organizationId,
                  version: connector.version,
                })
              }
            >
              Instalar
            </Button>
            <Button
              size="sm"
              variant="outline"
              loading={restart.isPending}
              onClick={() => restart.mutate({ connectorId: connector.id, organizationId })}
            >
              Reiniciar
            </Button>
            <Button
              size="sm"
              variant="danger-outline"
              loading={remove.isPending}
              onClick={() => remove.mutate({ connectorId: connector.id, organizationId })}
            >
              Remover
            </Button>
          </div>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border p-2 font-mono text-xs">
            {(logs ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhum log para esta organization ainda.</p>
            ) : (
              logs?.map((l) => (
                <div key={l.id}>
                  <span className="text-muted-foreground">
                    {new Date(l.createdAt).toLocaleTimeString('pt-BR')}
                  </span>{' '}
                  <span className="text-foreground">
                    [{l.action}] {l.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function VersionsDialog({
  connector,
  onClose,
}: {
  connector: Connector;
  onClose: () => void;
}): ReactElement {
  const { data: versions, isLoading } = useConnectorVersions(connector.id);
  const createVersion = useCreateConnectorVersion();
  const publishVersion = usePublishConnectorVersion();
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await createVersion.mutateAsync({
      connectorId: connector.id,
      input: { version, changelog: changelog || undefined },
    });
    setVersion('');
    setChangelog('');
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{connector.name} — versões</DialogTitle>
          <DialogDescription>{connector.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            versions?.map((v: ConnectorVersion) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-md border border-border p-2 text-sm"
              >
                <div>
                  <span className="font-mono">{v.version}</span>
                  {v.changelog && (
                    <span className="ml-2 text-xs text-muted-foreground">{v.changelog}</span>
                  )}
                </div>
                {v.published ? (
                  <Badge variant="success">Publicada</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={publishVersion.isPending}
                    onClick={() =>
                      publishVersion.mutate({ connectorId: connector.id, versionId: v.id })
                    }
                  >
                    Publicar
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => void handleCreate(e)}
          className="space-y-2 border-t border-border pt-3"
        >
          <p className="text-xs font-medium text-muted-foreground">Nova versão</p>
          <Input
            placeholder="1.0.0"
            required
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <Input
            placeholder="Changelog (opcional)"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
          />
          <Button type="submit" size="sm" loading={createVersion.isPending}>
            <Plus className="h-4 w-4" /> Adicionar versão
          </Button>
        </form>

        <ConnectorOperations connector={connector} />
      </DialogContent>
    </Dialog>
  );
}

function RegistryTab(): ReactElement {
  const { data, isLoading, isError, refetch } = useConnectors();
  const [selected, setSelected] = useState<Connector | null>(null);

  const columns: Column<Connector>[] = [
    {
      key: 'name',
      header: 'Connector',
      cell: (c) => <span className="font-medium text-foreground">{c.name}</span>,
    },
    { key: 'category', header: 'Categoria', cell: (c) => c.category },
    {
      key: 'version',
      header: 'Versão atual',
      cell: (c) => <span className="font-mono text-xs">{c.version}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <Button variant="outline" size="sm" onClick={() => setSelected(c)}>
          Versões
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <LoadingTable rows={4} cols={5} />
      </div>
    );
  }
  if (isError)
    return <ErrorState message="Falha ao carregar connectors" onRetry={() => void refetch()} />;

  return (
    <>
      <DataTable
        columns={columns}
        data={data ?? []}
        keyFn={(c) => c.id}
        emptyMessage="Nenhum connector cadastrado."
      />
      {selected && <VersionsDialog connector={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function DeploymentsTab(): ReactElement {
  const { data, isLoading, isError, refetch } = useDeployments();
  const rollback = useRollbackDeployment();

  const columns: Column<Deployment>[] = [
    {
      key: 'organizationId',
      header: 'Organization',
      cell: (d) => <span className="font-mono text-xs">{d.organizationId.slice(0, 8)}</span>,
    },
    {
      key: 'environmentId',
      header: 'Ambiente',
      cell: (d) => <span className="font-mono text-xs">{d.environmentId.slice(0, 8)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (d) => <Badge variant={DEPLOYMENT_VARIANT[d.status]}>{d.status}</Badge>,
    },
    { key: 'error', header: 'Erro', cell: (d) => d.error ?? '—' },
    {
      key: 'createdAt',
      header: 'Criado em',
      cell: (d) => new Date(d.createdAt).toLocaleString('pt-BR'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (d) =>
        d.status === 'SUCCEEDED' ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => rollback.mutate(d.id)}
            aria-label="Reverter deployment"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <LoadingTable rows={4} cols={6} />
      </div>
    );
  }
  if (isError)
    return <ErrorState message="Falha ao carregar deployments" onRetry={() => void refetch()} />;

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      keyFn={(d) => d.id}
      emptyMessage="Nenhum deployment registrado."
    />
  );
}

function ConnectorsContent(): ReactElement {
  const [tab, setTab] = useState<'registry' | 'deployments'>('registry');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description="Registro de connectors, versionamento e deployments por ambiente."
      />

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ['registry', 'Registro & Versões'],
            ['deployments', 'Deployments'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === value
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {value === 'deployments' && <Rocket className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {tab === 'registry' ? <RegistryTab /> : <DeploymentsTab />}
    </div>
  );
}

export default function MarketplacePage(): ReactElement {
  return (
    <RequirePermission permission="marketplace.review">
      <ConnectorsContent />
    </RequirePermission>
  );
}
