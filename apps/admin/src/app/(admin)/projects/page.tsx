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
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/hooks/use-projects';
import { useOrganizations } from '@/hooks/use-organizations';
import type { Project } from '@/types/control-plane';

const STATUS_VARIANT: Record<Project['status'], 'success' | 'warning' | 'default'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  ARCHIVED: 'default',
};

function ProjectsContent(): ReactElement {
  const { data: organizations } = useOrganizations();
  const [orgFilter, setOrgFilter] = useState('');
  const { data, isLoading, isError, refetch } = useProjects(orgFilter || undefined);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  const organizationName = (id: string): string =>
    organizations?.find((o) => o.id === id)?.name ?? '—';

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await createProject.mutateAsync({ name, slug, organizationId });
    setCreateOpen(false);
    setName('');
    setSlug('');
    setOrganizationId('');
  };

  const toggleStatus = async (project: Project): Promise<void> => {
    const next = project.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await updateProject.mutateAsync({ id: project.id, patch: { status: next } });
  };

  const columns: Column<Project>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (p) => <span className="font-medium text-foreground">{p.name}</span>,
    },
    { key: 'organization', header: 'Organização', cell: (p) => organizationName(p.organizationId) },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      cell: (p) => new Date(p.createdAt).toLocaleDateString('pt-BR'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={p.status === 'ARCHIVED'}
            onClick={() => void toggleStatus(p)}
          >
            {p.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPendingDelete(p)}
            aria-label={`Excluir ${p.name}`}
          >
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Agrupamento de trabalho dentro de uma organization."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Project
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
        <ErrorState message="Falha ao carregar projects" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(p) => p.id}
          emptyMessage="Nenhum project encontrado."
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Project</DialogTitle>
            <DialogDescription>
              Um project pertence a uma organization e agrupa o trabalho relacionado a ela.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <select
              required
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={createProject.isPending}>
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
        loading={deleteProject.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteProject.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

export default function ProjectsPage(): ReactElement {
  return (
    <RequirePermission permission="projects.read">
      <ProjectsContent />
    </RequirePermission>
  );
}
