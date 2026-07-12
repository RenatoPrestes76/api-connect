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
  useCreateFeatureFlag,
  useDeleteFeatureFlag,
  useFeatureFlags,
  useToggleFeatureFlag,
} from '@/hooks/use-feature-flags';
import { useOrganizations } from '@/hooks/use-organizations';
import type { FeatureFlag } from '@/types/control-plane';

function FeatureFlagsContent(): ReactElement {
  const { data, isLoading, isError, refetch } = useFeatureFlags();
  const { data: organizations } = useOrganizations();
  const toggle = useToggleFeatureFlag();
  const createFlag = useCreateFeatureFlag();
  const deleteFlag = useDeleteFeatureFlag();

  const [createOpen, setCreateOpen] = useState(false);
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [pendingDelete, setPendingDelete] = useState<FeatureFlag | null>(null);

  const scopeLabel = (flag: FeatureFlag): string => {
    if (!flag.organizationId) return 'Global';
    return (
      organizations?.find((o) => o.id === flag.organizationId)?.name ??
      flag.organizationId.slice(0, 8)
    );
  };

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await createFlag.mutateAsync({
      key,
      description: description || undefined,
      organizationId: organizationId || undefined,
    });
    setCreateOpen(false);
    setKey('');
    setDescription('');
    setOrganizationId('');
  };

  const columns: Column<FeatureFlag>[] = [
    {
      key: 'key',
      header: 'Chave',
      cell: (f) => <span className="font-mono text-sm text-foreground">{f.key}</span>,
    },
    { key: 'scope', header: 'Escopo', cell: (f) => scopeLabel(f) },
    { key: 'description', header: 'Descrição', cell: (f) => f.description ?? '—' },
    {
      key: 'enabled',
      header: 'Status',
      cell: (f) => (
        <button onClick={() => toggle.mutate(f.id)} className="inline-block">
          <Badge variant={f.enabled ? 'success' : 'default'}>
            {f.enabled ? 'Ativa' : 'Inativa'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (f) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPendingDelete(f)}
          aria-label={`Excluir ${f.key}`}
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags"
        description="Flags globais ou escopadas por organization/ambiente. Clique no status para alternar."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Flag
          </Button>
        }
      />

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={4} cols={5} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar feature flags" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(f) => f.id}
          emptyMessage="Nenhuma feature flag cadastrada."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Feature Flag</DialogTitle>
            <DialogDescription>
              Deixe a organization em branco para uma flag global.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <Input
              placeholder="chave-da-flag"
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <Input
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
            >
              <option value="">Global (todas as organizations)</option>
              {organizations?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createFlag.isPending}>
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Excluir a flag "${pendingDelete?.key}"?`}
        variant="danger"
        loading={deleteFlag.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteFlag.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

export default function FeatureFlagsPage(): ReactElement {
  return (
    <RequirePermission permission="settings.manage">
      <FeatureFlagsContent />
    </RequirePermission>
  );
}
