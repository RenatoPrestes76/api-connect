'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RequirePermission } from '@/components/auth/require-permission';
import { useDiscoveryRequests, useRequestDiscovery } from '@/hooks/use-erp-metadata';
import type { DiscoveryRequest } from '@/types/erp-platform';

const STATUS_VARIANT: Record<
  DiscoveryRequest['status'],
  'success' | 'warning' | 'danger' | 'default'
> = {
  REQUESTED: 'default',
  CLAIMED: 'warning',
  SCANNING: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
  TIMEOUT: 'danger',
  REJECTED: 'danger',
};

function DiscoveryContent(): ReactElement {
  const { data, isLoading, isError, refetch } = useDiscoveryRequests();
  const request = useRequestDiscovery();
  const [createOpen, setCreateOpen] = useState(false);
  const [runtimeId, setRuntimeId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [profileId, setProfileId] = useState('');

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await request.mutateAsync({ runtimeId, organizationId, profileId });
    setCreateOpen(false);
    setRuntimeId('');
    setOrganizationId('');
    setProfileId('');
  };

  const columns: Column<DiscoveryRequest>[] = [
    {
      key: 'id',
      header: 'Job',
      cell: (r) => <span className="font-mono text-xs">{r.id.slice(0, 8)}…</span>,
    },
    { key: 'organizationId', header: 'Organização', cell: (r) => r.organizationId },
    {
      key: 'runtimeId',
      header: 'Runtime',
      cell: (r) => <span className="font-mono text-xs">{r.runtimeId.slice(0, 8)}…</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>,
    },
    { key: 'attempts', header: 'Tentativas', cell: (r) => `${r.attempts}/${r.maxAttempts}` },
    { key: 'error', header: 'Erro', cell: (r) => r.error ?? '—' },
    {
      key: 'createdAt',
      header: 'Criado em',
      cell: (r) => new Date(r.createdAt).toLocaleString('pt-BR'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discovery"
        description="Jobs de descoberta de schema ERP (Sprint 46.9)."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Solicitar descoberta
          </Button>
        }
      />

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={5} cols={7} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar jobs de discovery" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(r) => r.id}
          emptyMessage="Nenhum job de discovery ainda."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={(e) => void handleCreate(e)}>
            <DialogHeader>
              <DialogTitle>Solicitar nova descoberta</DialogTitle>
              <DialogDescription>
                O Atlas cria o job; o Runtime executa a descoberta local e reporta o resultado — a
                UI nunca executa a descoberta diretamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <Input
                placeholder="Runtime ID"
                value={runtimeId}
                onChange={(e) => setRuntimeId(e.target.value)}
                required
              />
              <Input
                placeholder="Organization ID"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                required
              />
              <Input
                placeholder="Profile ID (conexão ERP)"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={request.isPending}>
                Solicitar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DiscoveryPage(): ReactElement {
  return (
    <RequirePermission permission="erp-metadata.read">
      <DiscoveryContent />
    </RequirePermission>
  );
}
