'use client';
import { useState, type ReactElement } from 'react';
import { Hammer, Search } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequirePermission } from '@/components/auth/require-permission';
import { useBuildCanonicalModel, useCanonicalModel } from '@/hooks/use-canonical-model';
import type { CanonicalEntity } from '@/types/erp-platform';

function CanonicalModelContent(): ReactElement {
  const [input, setInput] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const model = useCanonicalModel(organizationId, 'latest');
  const build = useBuildCanonicalModel();

  const columns: Column<CanonicalEntity>[] = [
    {
      key: 'sourceName',
      header: 'Origem (ERP)',
      cell: (e) => <span className="font-mono text-xs">{e.sourceName}</span>,
    },
    {
      key: 'entityKind',
      header: 'CBL Entity Kind',
      cell: (e) => <Badge variant="default">{e.entityKind}</Badge>,
    },
    {
      key: 'cblTerm',
      header: 'CBL Term',
      cell: (e) => <span className="font-mono text-xs">{e.cblTerm}</span>,
    },
    { key: 'domain', header: 'Domínio', cell: (e) => e.domain },
    { key: 'confidence', header: 'Confiança', cell: (e) => `${e.confidence}%` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canonical Model"
        description="ERP Entity → Business Entity → Canonical Entity → CBL (Sprint 46.11)."
      />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setOrganizationId(input.trim());
        }}
      >
        <Input
          placeholder="Organization ID"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit">
          <Search className="mr-1.5 h-4 w-4" /> Buscar
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!organizationId || build.isPending}
          onClick={() => organizationId && build.mutate(organizationId)}
        >
          <Hammer className="mr-1.5 h-4 w-4" /> Construir modelo
        </Button>
      </form>

      {!organizationId ? (
        <p className="text-sm text-muted-foreground">
          Informe um Organization ID para ver o modelo canônico.
        </p>
      ) : model.isError ? (
        <ErrorState message="Nenhum modelo canônico construído para esta organização ainda." />
      ) : (
        <div className="space-y-4">
          {model.data && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Versão:</span>{' '}
                <span className="font-mono">{model.data.model.version}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Entidades mapeadas:</span>{' '}
                {model.data.model.statistics.mappedEntities}/
                {model.data.model.statistics.totalEntities}
              </p>
              <p>
                <span className="text-muted-foreground">Confiança média:</span>{' '}
                {model.data.model.confidence}%
              </p>
            </div>
          )}
          <DataTable
            columns={columns}
            data={model.data?.model.entities ?? []}
            keyFn={(e) => e.id}
            emptyMessage="Nenhuma entidade canônica ainda."
          />
        </div>
      )}
    </div>
  );
}

export default function CanonicalModelPage(): ReactElement {
  return (
    <RequirePermission permission="canonical-model.read">
      <CanonicalModelContent />
    </RequirePermission>
  );
}
