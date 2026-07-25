'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
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
  useRegistryConnectors,
  useCreateRegistryConnector,
  useSetRegistryConnectorActive,
  useDeleteRegistryConnector,
} from '@/hooks/use-connector-registry';
import type { RegistryConnector, ConnectorCategory } from '@/types/connector-registry';

const CATEGORIES: ConnectorCategory[] = [
  'DATABASE',
  'ERP',
  'REST_API',
  'SOAP',
  'FTP_SFTP',
  'MESSAGING',
  'FILES',
  'WEBHOOK',
  'CUSTOM',
];

const STATUS_VARIANT: Record<RegistryConnector['status'], 'success' | 'warning' | 'default'> = {
  active: 'success',
  beta: 'warning',
  deprecated: 'default',
};

function ConnectorRegistryContent(): ReactElement {
  const [categoryFilter, setCategoryFilter] = useState('');
  const {
    data: connectors,
    isLoading,
    isError,
    refetch,
  } = useRegistryConnectors({
    category: (categoryFilter as ConnectorCategory) || undefined,
  });
  const createConnector = useCreateRegistryConnector();
  const setActive = useSetRegistryConnectorActive();
  const deleteConnector = useDeleteRegistryConnector();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    identifier: '',
    name: '',
    category: 'DATABASE' as ConnectorCategory,
    vendor: '',
    description: '',
    minRuntimeVersion: '1.0.0',
  });
  const [pendingDelete, setPendingDelete] = useState<RegistryConnector | null>(null);

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await createConnector.mutateAsync(form);
    setCreateOpen(false);
    setForm({
      identifier: '',
      name: '',
      category: 'DATABASE',
      vendor: '',
      description: '',
      minRuntimeVersion: '1.0.0',
    });
  };

  const columns: Column<RegistryConnector>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (c) => (
        <Link
          href={`/connector-registry/${c.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {c.name}
        </Link>
      ),
    },
    {
      key: 'identifier',
      header: 'Identificador',
      cell: (c) => <code className="text-xs">{c.identifier}</code>,
    },
    { key: 'category', header: 'Categoria', cell: (c) => c.category },
    { key: 'vendor', header: 'Fabricante', cell: (c) => c.vendor },
    { key: 'version', header: 'Versão', cell: (c) => c.currentVersion ?? '—' },
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
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void setActive.mutateAsync({ id: c.id, active: c.status !== 'active' })}
          >
            {c.status === 'active' ? 'Desativar' : 'Ativar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPendingDelete(c)}>
            Excluir
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connector Registry"
        description="Catálogo central de conectores — cadastro, versões, parâmetros e templates."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Conector
          </Button>
        }
      />

      <select
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        className="h-9 rounded border border-input bg-card px-3 text-sm text-foreground"
      >
        <option value="">Todas as categorias</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={4} cols={6} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar conectores" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={connectors ?? []}
          keyFn={(c) => c.id}
          emptyMessage="Nenhum conector cadastrado."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Conector</DialogTitle>
            <DialogDescription>
              Registra um novo conector no catálogo. Comece com status Beta e publique uma versão
              estável para ativá-lo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <Input
              placeholder="Identificador único (ex: sap-ecc)"
              required
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            />
            <Input
              placeholder="Nome"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ConnectorCategory })}
              className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Input
              placeholder="Fabricante"
              required
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
            />
            <Input
              placeholder="Descrição"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Input
              placeholder="Compatibilidade mínima do Runtime (ex: 1.0.0)"
              required
              value={form.minRuntimeVersion}
              onChange={(e) => setForm({ ...form, minRuntimeVersion: e.target.value })}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createConnector.isPending}>
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
        loading={deleteConnector.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteConnector.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

export default function ConnectorRegistryPage(): ReactElement {
  return (
    <RequirePermission permission="connector-registry.read">
      <ConnectorRegistryContent />
    </RequirePermission>
  );
}
