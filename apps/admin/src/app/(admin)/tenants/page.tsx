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
import { useCreateTenant, useDeleteTenant, useTenants } from '@/hooks/use-tenants';
import type { Tenant } from '@/types/control-plane';

const STATUS_VARIANT: Record<Tenant['status'], 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CHURNED: 'danger',
};

function TenantsContent(): ReactElement {
  const { data, isLoading, isError, refetch } = useTenants();
  const createTenant = useCreateTenant();
  const deleteTenant = useDeleteTenant();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Tenant | null>(null);

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await createTenant.mutateAsync({ name, slug, primaryContactEmail: email || undefined });
    setCreateOpen(false);
    setName('');
    setSlug('');
    setEmail('');
  };

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (t) => <span className="font-medium text-foreground">{t.name}</span>,
    },
    {
      key: 'slug',
      header: 'Slug',
      cell: (t) => <span className="font-mono text-xs text-muted-foreground">{t.slug}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (t) => <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>,
    },
    { key: 'contact', header: 'Contato', cell: (t) => t.primaryContactEmail ?? '—' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (t) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPendingDelete(t)}
          aria-label={`Excluir ${t.name}`}
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Contas comerciais de topo — cada tenant pode conter uma ou mais organizations."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Tenant
          </Button>
        }
      />

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={4} cols={5} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar tenants" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(t) => t.id}
          emptyMessage="Nenhum tenant cadastrado."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Tenant</DialogTitle>
            <DialogDescription>Cria uma nova conta comercial de topo.</DialogDescription>
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
            <Input
              placeholder="E-mail de contato (opcional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createTenant.isPending}>
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
        loading={deleteTenant.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteTenant.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

export default function TenantsPage(): ReactElement {
  return (
    <RequirePermission permission="companies.read">
      <TenantsContent />
    </RequirePermission>
  );
}
