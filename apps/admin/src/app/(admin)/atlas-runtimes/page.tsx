'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { KeyRound, Lock, Plus, RotateCw, ShieldOff, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { LoadingTable } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  useAtlasRuntimes,
  useBlockAtlasRuntime,
  useReactivateAtlasRuntime,
  useRevokeAtlasRuntimeCredentials,
  useActivationKeys,
  useIssueActivationKey,
  useRevokeActivationKey,
} from '@/hooks/use-atlas-runtimes';
import type { ActivationKey, AtlasRuntime } from '@/types/erp-platform';

const STATUS_VARIANT: Record<AtlasRuntime['status'], 'success' | 'warning' | 'danger' | 'default'> =
  {
    PENDING: 'default',
    REGISTERED: 'warning',
    ACTIVE: 'success',
    BLOCKED: 'warning',
    REVOKED: 'danger',
  };

function RuntimesTable(): ReactElement {
  const { data, isLoading, isError, refetch } = useAtlasRuntimes();
  const block = useBlockAtlasRuntime();
  const reactivate = useReactivateAtlasRuntime();
  const revoke = useRevokeAtlasRuntimeCredentials();
  const [pendingRevoke, setPendingRevoke] = useState<AtlasRuntime | null>(null);

  const columns: Column<AtlasRuntime>[] = [
    {
      key: 'runtimeId',
      header: 'Runtime',
      cell: (r) => <span className="font-mono text-xs">{r.runtimeId.slice(0, 8)}…</span>,
    },
    { key: 'organizationId', header: 'Organização', cell: (r) => r.organizationId },
    { key: 'hostname', header: 'Host', cell: (r) => r.hostname || '—' },
    {
      key: 'version',
      header: 'Versão',
      cell: (r) => <span className="font-mono text-xs">{r.version}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>,
    },
    {
      key: 'capabilities',
      header: 'Capabilities',
      cell: (r) =>
        r.capabilities.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {r.capabilities.map((c) => (
              <Badge key={c} variant="default">
                {c}
              </Badge>
            ))}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'lastHeartbeat',
      header: 'Último heartbeat',
      cell: (r) => (r.lastHeartbeat ? new Date(r.lastHeartbeat).toLocaleString('pt-BR') : '—'),
    },
    {
      key: 'registeredAt',
      header: 'Enrollment',
      cell: (r) => new Date(r.registeredAt).toLocaleString('pt-BR'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {r.status === 'BLOCKED' ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => reactivate.mutate(r.runtimeId)}
              aria-label={`Reativar ${r.runtimeId}`}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              disabled={r.status === 'REVOKED'}
              onClick={() => block.mutate(r.runtimeId)}
              aria-label={`Bloquear ${r.runtimeId}`}
            >
              <Lock className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            disabled={r.status === 'REVOKED'}
            onClick={() => setPendingRevoke(r)}
            aria-label={`Revogar ${r.runtimeId}`}
          >
            <ShieldOff className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={5} cols={8} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar Runtimes" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(r) => r.runtimeId}
          emptyMessage="Nenhum Runtime registrado ainda."
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title="Revogar credenciais do Runtime"
        description="Isso revoga permanentemente o certificado e todas as sessões deste Runtime. Não pode ser desfeito."
        confirmLabel="Revogar"
        variant="danger"
        loading={revoke.isPending}
        onConfirm={() => {
          if (pendingRevoke)
            revoke.mutate(pendingRevoke.runtimeId, { onSuccess: () => setPendingRevoke(null) });
        }}
      />
    </div>
  );
}

function ActivationKeysPanel(): ReactElement {
  const { data, isLoading } = useActivationKeys();
  const issue = useIssueActivationKey();
  const revoke = useRevokeActivationKey();
  const [createOpen, setCreateOpen] = useState(false);
  const [organizationCode, setOrganizationCode] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const result = await issue.mutateAsync(organizationCode);
    setNewKey(result.activationKey.code);
    setOrganizationCode('');
    setCreateOpen(false);
  };

  const columns: Column<ActivationKey>[] = [
    {
      key: 'code',
      header: 'Código',
      cell: (k) => <span className="font-mono text-xs">{k.code}</span>,
    },
    { key: 'organizationCode', header: 'Organização', cell: (k) => k.organizationCode },
    {
      key: 'status',
      header: 'Status',
      cell: (k) =>
        k.revoked ? (
          <Badge variant="danger">REVOGADA</Badge>
        ) : k.used ? (
          <Badge variant="default">USADA</Badge>
        ) : new Date(k.expiresAt).getTime() < Date.now() ? (
          <Badge variant="warning">EXPIRADA</Badge>
        ) : (
          <Badge variant="success">DISPONÍVEL</Badge>
        ),
    },
    {
      key: 'expiresAt',
      header: 'Expira em',
      cell: (k) => new Date(k.expiresAt).toLocaleDateString('pt-BR'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (k) => (
        <Button
          variant="ghost"
          size="icon"
          disabled={k.used || k.revoked}
          onClick={() => revoke.mutate(k.id)}
          aria-label={`Revogar chave ${k.code}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Activation Keys</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Gerar chave
        </Button>
      </div>

      {isLoading ? (
        <LoadingTable rows={3} cols={5} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(k) => k.id}
          emptyMessage="Nenhuma activation key emitida."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={(e) => void handleCreate(e)}>
            <DialogHeader>
              <DialogTitle>Gerar activation key</DialogTitle>
              <DialogDescription>
                A chave vincula um único Runtime ao código de organização informado — o Runtime
                nunca escolhe seu próprio tenant.
              </DialogDescription>
            </DialogHeader>
            <div className="py-3">
              <Input
                placeholder="Código da organização (ex: ORG-0001)"
                value={organizationCode}
                onChange={(e) => setOrganizationCode(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={issue.isPending}>
                Gerar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(newKey)} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Chave gerada
            </DialogTitle>
            <DialogDescription>
              Entregue este código ao instalador do Runtime. Ele é de uso único.
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-md border border-border bg-muted p-3 text-xs">
            {newKey}
          </code>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AtlasRuntimesContent(): ReactElement {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Atlas Runtimes"
        description="Runtimes ERP instalados nos clientes — enrollment, identidade e ciclo de vida (Sprint 46.3–46.9)."
      />
      <RuntimesTable />
      <ActivationKeysPanel />
    </div>
  );
}

export default function AtlasRuntimesPage(): ReactElement {
  return (
    <RequirePermission permission="runtime-registration.read">
      <AtlasRuntimesContent />
    </RequirePermission>
  );
}
