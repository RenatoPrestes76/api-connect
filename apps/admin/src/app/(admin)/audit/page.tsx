'use client';
import { useState, type ReactElement } from 'react';
import { List, GitCommitHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { LoadingTable } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RequirePermission } from '@/components/auth/require-permission';
import { useAuditLog } from '@/hooks/use-audit-log';
import type { AuditEntry } from '@/services/audit.service';

const ACTION_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  LOGIN: 'success',
  LOGOUT: 'default',
  LOGIN_FAILED: 'danger',
  ACCOUNT_LOCKED: 'danger',
  REFRESH_TOKEN: 'default',
  PASSWORD_CHANGED: 'warning',
  DEPLOY_FAILED: 'danger',
  CREATE_DEPLOYMENT_JOB: 'default',
  APPROVE_DEPLOYMENT_JOB: 'success',
  REJECT_DEPLOYMENT_JOB: 'danger',
  ROLLBACK_DEPLOYMENT_JOB: 'warning',
};

const COLUMNS: Column<AuditEntry>[] = [
  {
    key: 'createdAt',
    header: 'Data/Hora',
    cell: (row) => new Date(row.createdAt).toLocaleString('pt-BR'),
  },
  {
    key: 'action',
    header: 'Ação',
    cell: (row) => <Badge variant={ACTION_VARIANT[row.action] ?? 'default'}>{row.action}</Badge>,
  },
  { key: 'actorEmail', header: 'Ator', cell: (row) => row.actorEmail },
  { key: 'ip', header: 'IP', cell: (row) => row.ip ?? '—' },
  { key: 'target', header: 'Alvo', cell: (row) => row.target ?? '—' },
];

function groupByDay(entries: AuditEntry[]): Array<[string, AuditEntry[]]> {
  const groups = new Map<string, AuditEntry[]>();
  for (const entry of entries) {
    const day = new Date(entry.createdAt).toLocaleDateString('pt-BR');
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(entry);
  }
  return [...groups.entries()];
}

function Timeline({ entries }: { entries: AuditEntry[] }): ReactElement {
  return (
    <div className="space-y-6">
      {groupByDay(entries).map(([day, items]) => (
        <div key={day}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {day}
          </p>
          <div className="space-y-0 border-l border-border pl-4">
            {items.map((entry) => (
              <div key={entry.id} className="relative pb-4 last:pb-0">
                <span className="absolute -left-5.25 top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ACTION_VARIANT[entry.action] ?? 'default'}>{entry.action}</Badge>
                  <span className="text-sm text-foreground">{entry.actorEmail}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                {(entry.target || entry.ip) && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {entry.target && <>alvo: {entry.target} </>}
                    {entry.ip && <>· ip: {entry.ip}</>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditLogContent(): ReactElement {
  const { data, isLoading, isError, refetch } = useAuditLog(200);
  const [view, setView] = useState<'table' | 'timeline'>('timeline');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="Linha do tempo completa: login, deploy, instalação, atualização, exclusão, rollback e alterações de configuração."
        actions={
          <div className="flex gap-1 rounded-md border border-border p-0.5">
            <Button
              variant={view === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('timeline')}
            >
              <GitCommitHorizontal className="h-4 w-4" /> Timeline
            </Button>
            <Button
              variant={view === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('table')}
            >
              <List className="h-4 w-4" /> Tabela
            </Button>
          </div>
        }
      />
      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={6} cols={5} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar o log de auditoria" onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum evento de auditoria registrado ainda.
        </p>
      ) : view === 'timeline' ? (
        <Timeline entries={data} />
      ) : (
        <DataTable
          columns={COLUMNS}
          data={data}
          keyFn={(row) => row.id}
          emptyMessage="Nenhum evento de auditoria registrado ainda."
        />
      )}
    </div>
  );
}

export default function AuditPage(): ReactElement {
  return (
    <RequirePermission permission="audit.read">
      <AuditLogContent />
    </RequirePermission>
  );
}
