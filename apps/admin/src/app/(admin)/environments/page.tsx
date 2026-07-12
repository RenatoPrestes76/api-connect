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
  useCreateEnvironment,
  useDeleteEnvironment,
  useEnvironments,
} from '@/hooks/use-environments';
import { useOrganizations } from '@/hooks/use-organizations';
import type { Environment } from '@/types/control-plane';

const KIND_VARIANT: Record<Environment['kind'], 'default' | 'warning' | 'success'> = {
  DEVELOPMENT: 'default',
  STAGING: 'warning',
  PRODUCTION: 'success',
};

function EnvironmentsContent(): ReactElement {
  const { data: organizations } = useOrganizations();
  const [orgFilter, setOrgFilter] = useState('');
  const { data, isLoading, isError, refetch } = useEnvironments(orgFilter || undefined);
  const createEnv = useCreateEnvironment();
  const deleteEnv = useDeleteEnvironment();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState<Environment['kind']>('DEVELOPMENT');
  const [organizationId, setOrganizationId] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Environment | null>(null);

  const orgName = (id: string): string => organizations?.find((o) => o.id === id)?.name ?? '—';

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!organizationId) return;
    await createEnv.mutateAsync({ organizationId, name, slug, kind });
    setCreateOpen(false);
    setName('');
    setSlug('');
  };

  const columns: Column<Environment>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (e) => <span className="font-medium text-foreground">{e.name}</span>,
    },
    { key: 'organization', header: 'Organization', cell: (e) => orgName(e.organizationId) },
    {
      key: 'kind',
      header: 'Tipo',
      cell: (e) => <Badge variant={KIND_VARIANT[e.kind]}>{e.kind}</Badge>,
    },
    { key: 'status', header: 'Status', cell: (e) => e.status },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (e) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPendingDelete(e)}
          aria-label={`Excluir ${e.name}`}
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ambientes"
        description="Development, Staging e Production por organization."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Ambiente
          </Button>
        }
      />

      <select
        value={orgFilter}
        onChange={(e) => setOrgFilter(e.target.value)}
        className="h-9 rounded border border-input bg-card px-3 text-sm text-foreground"
      >
        <option value="">Todas as organizations</option>
        {organizations?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={4} cols={5} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar ambientes" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(e) => e.id}
          emptyMessage="Nenhum ambiente encontrado."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Ambiente</DialogTitle>
            <DialogDescription>
              Adiciona um ambiente extra a uma organization existente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              required
              className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
            >
              <option value="">Selecione a organization</option>
              {organizations?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
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
              value={kind}
              onChange={(e) => setKind(e.target.value as Environment['kind'])}
              className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
            >
              <option value="DEVELOPMENT">Development</option>
              <option value="STAGING">Staging</option>
              <option value="PRODUCTION">Production</option>
            </select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createEnv.isPending}>
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
        variant="danger"
        loading={deleteEnv.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteEnv.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

export default function EnvironmentsPage(): ReactElement {
  return (
    <RequirePermission permission="companies.read">
      <EnvironmentsContent />
    </RequirePermission>
  );
}
