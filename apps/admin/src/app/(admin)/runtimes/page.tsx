'use client';
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { KeyRound, Power, RotateCw } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RequirePermission } from '@/components/auth/require-permission';
import { useIssueRuntimeToken, useRestartRuntime, useRuntimes } from '@/hooks/use-runtimes';
import type { Runtime } from '@/types/control-plane';

const STATUS_VARIANT: Record<Runtime['status'], 'success' | 'warning' | 'danger' | 'default'> = {
  ONLINE: 'success',
  DEGRADED: 'warning',
  OFFLINE: 'danger',
  UNRESPONSIVE: 'danger',
  RETIRED: 'default',
};

function RuntimesContent(): ReactElement {
  const { data, isLoading, isError, refetch } = useRuntimes();
  const restart = useRestartRuntime();
  const issueToken = useIssueRuntimeToken();
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const columns: Column<Runtime>[] = [
    {
      key: 'name',
      header: 'Nome',
      cell: (r) => (
        <Link
          href={`/runtimes/${r.id}`}
          className="font-medium text-foreground hover:text-accent hover:underline"
        >
          {r.name}
        </Link>
      ),
    },
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
    { key: 'hostname', header: 'Host', cell: (r) => r.hostname ?? '—' },
    {
      key: 'lastSeen',
      header: 'Último contato',
      cell: (r) => (r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString('pt-BR') : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={r.status === 'RETIRED'}
            onClick={() => restart.mutate(r.id)}
            aria-label={`Reiniciar ${r.name}`}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={r.status === 'RETIRED'}
            onClick={() =>
              issueToken.mutate(r.id, { onSuccess: (data) => setIssuedToken(data.token) })
            }
            aria-label={`Emitir token para ${r.name}`}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runtimes"
        description="Gestão dos runtimes distribuídos do Atlas Connect."
      />

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={5} cols={6} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar runtimes" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(r) => r.id}
          emptyMessage="Nenhum runtime registrado."
        />
      )}

      <Dialog open={Boolean(issuedToken)} onOpenChange={(open) => !open && setIssuedToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Power className="h-4 w-4" /> Novo token de acesso
            </DialogTitle>
            <DialogDescription>
              Copie este token agora — ele não poderá ser visualizado novamente. Qualquer token
              anterior foi revogado.
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-md border border-border bg-muted p-3 text-xs">
            {issuedToken}
          </code>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RuntimesPage(): ReactElement {
  return (
    <RequirePermission permission="runtime.read">
      <RuntimesContent />
    </RequirePermission>
  );
}
