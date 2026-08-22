'use client';
import { useState, type ReactElement } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { LoadingTable } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequirePermission } from '@/components/auth/require-permission';
import { useErpMetadataSchemaCache, useErpMetadataTables } from '@/hooks/use-erp-metadata';
import type { ErpMetadataTableSummary } from '@/types/erp-platform';

function ErpMetadataContent(): ReactElement {
  const [input, setInput] = useState('');
  const [profileId, setProfileId] = useState('');

  const tables = useErpMetadataTables(profileId);
  const cache = useErpMetadataSchemaCache(profileId);

  const columns: Column<ErpMetadataTableSummary>[] = [
    {
      key: 'table',
      header: 'Tabela',
      cell: (t) => <span className="font-mono text-xs">{t.table}</span>,
    },
    {
      key: 'entity',
      header: 'Entidade ATHENA',
      cell: (t) => <Badge variant="default">{t.entity}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="ERP Metadata"
        description="Último catálogo estrutural descoberto pelo ATHENA para um perfil de conexão (Sprint 46.9)."
      />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setProfileId(input.trim());
        }}
      >
        <Input
          placeholder="Profile ID da conexão ERP"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit">
          <Search className="mr-1.5 h-4 w-4" /> Buscar
        </Button>
      </form>

      {!profileId ? (
        <p className="text-sm text-muted-foreground">Informe um Profile ID para ver o catálogo.</p>
      ) : cache.isError ? (
        <ErrorState message="Nenhuma descoberta encontrada para este perfil ainda." />
      ) : (
        <div className="space-y-4">
          {cache.data && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Versão do cache:</span>{' '}
                <span className="font-mono">{cache.data.cache.version}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Última descoberta:</span>{' '}
                {new Date(cache.data.cache.lastDiscoveredAt).toLocaleString('pt-BR')}
              </p>
            </div>
          )}

          {tables.isLoading ? (
            <LoadingTable rows={5} cols={2} />
          ) : (
            <DataTable
              columns={columns}
              data={tables.data ?? []}
              keyFn={(t) => t.table}
              emptyMessage="Nenhuma tabela encontrada para este perfil."
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function ErpMetadataPage(): ReactElement {
  return (
    <RequirePermission permission="erp-metadata.read">
      <ErpMetadataContent />
    </RequirePermission>
  );
}
