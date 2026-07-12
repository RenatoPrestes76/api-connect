'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  useCreateOrganization,
  useDeleteOrganization,
  useOrganizations,
} from '@/hooks/use-organizations';
import { useTenants } from '@/hooks/use-tenants';
import type { Organization } from '@/types/control-plane';

const STATUS_VARIANT: Record<Organization['status'], 'success' | 'warning' | 'danger' | 'default'> =
  {
    ACTIVE: 'success',
    SUSPENDED: 'warning',
    PENDING_VERIFICATION: 'default',
    DELETED: 'danger',
  };

const TIER_VARIANT: Record<Organization['tier'], 'default' | 'primary' | 'success'> = {
  FREE: 'default',
  STARTER: 'default',
  PRO: 'primary',
  ENTERPRISE: 'success',
};

function OrganizationsContent(): ReactElement {
  const { data: tenants } = useTenants();
  const [tenantFilter, setTenantFilter] = useState('');
  const { data, isLoading, isError, refetch } = useOrganizations({
    tenantId: tenantFilter || undefined,
  });
  const createOrg = useCreateOrganization();
  const deleteOrg = useDeleteOrganization();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Organization | null>(null);

  const tenantName = (id?: string): string => tenants?.find((t) => t.id === id)?.name ?? '—';

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await createOrg.mutateAsync({ name, slug, tenantId: tenantId || undefined });
    setCreateOpen(false);
    setName('');
    setSlug('');
    setTenantId('');
  };

  const columns: Column<Organization>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (o) => <span className="font-medium text-foreground">{o.name}</span>,
    },
    { key: 'tenant', header: 'Tenant', cell: (o) => tenantName(o.tenantId) },
    {
      key: 'tier',
      header: 'Plano',
      cell: (o) => <Badge variant={TIER_VARIANT[o.tier]}>{o.tier}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (o) => <Badge variant={STATUS_VARIANT[o.status]}>{o.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (o) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPendingDelete(o)}
          aria-label={`Excluir ${o.name}`}
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Contas de clientes — cada organization possui seus próprios ambientes, runtimes e connectors."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Organization
          </Button>
        }
      />

      <select
        value={tenantFilter}
        onChange={(e) => setTenantFilter(e.target.value)}
        className="h-9 rounded border border-input bg-card px-3 text-sm text-foreground"
      >
        <option value="">Todos os tenants</option>
        {tenants?.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={4} cols={5} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar organizations" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(o) => o.id}
          emptyMessage="Nenhuma organization encontrada."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Organization</DialogTitle>
            <DialogDescription>
              Cria uma organization com um workspace padrão e os três ambientes (dev/staging/prod).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <Input
              placeholder="Nome"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
            >
              <option value="">Sem tenant</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createOrg.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Excluir ${pendingDelete?.name}?`}
        description="Esta ação não pode ser desfeita."
        variant="danger"
        loading={deleteOrg.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteOrg.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

export default function CompaniesPage(): ReactElement {
  return (
    <RequirePermission permission="companies.read">
      <OrganizationsContent />
    </RequirePermission>
  );
}
