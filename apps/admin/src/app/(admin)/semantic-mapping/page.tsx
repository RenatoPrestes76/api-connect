'use client';
import { useState, type ReactElement } from 'react';
import { AlertTriangle, Check, Play, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { LoadingTable } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequirePermission } from '@/components/auth/require-permission';
import {
  useAnalyzeProfile,
  useDecideMapping,
  useMappingEntities,
} from '@/hooks/use-semantic-mapping';
import type { SemanticMapping } from '@/types/erp-platform';

const STATUS_VARIANT: Record<SemanticMapping['status'], 'success' | 'warning' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

function MappingCard({ mapping }: { mapping: SemanticMapping }): ReactElement {
  const decide = useDecideMapping();

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-sm text-foreground">
            {mapping.schema}.{mapping.table}
          </p>
          <p className="text-xs text-muted-foreground">
            ATHENA: {mapping.athenaEntity} → Sugestão: <strong>{mapping.suggestedEntity}</strong> (
            {mapping.suggestedConfidence}% confiança)
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[mapping.status]}>{mapping.status}</Badge>
      </div>

      <p className="text-xs text-muted-foreground">{mapping.reasoning}</p>

      {mapping.conflicts.length > 0 && (
        <div className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            {mapping.conflicts.map((c, i) => (
              <p key={i}>{c.detail}</p>
            ))}
          </div>
        </div>
      )}

      {mapping.status === 'PENDING' && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            disabled={decide.isPending}
            onClick={() =>
              decide.mutate({
                profileId: mapping.profileId,
                schema: mapping.schema,
                table: mapping.table,
                decision: 'APPROVE',
              })
            }
          >
            <Check className="mr-1.5 h-4 w-4" /> Aprovar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={decide.isPending}
            onClick={() =>
              decide.mutate({
                profileId: mapping.profileId,
                schema: mapping.schema,
                table: mapping.table,
                decision: 'REJECT',
              })
            }
          >
            <X className="mr-1.5 h-4 w-4" /> Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}

function SemanticMappingContent(): ReactElement {
  const [input, setInput] = useState('');
  const [profileId, setProfileId] = useState('');
  const entities = useMappingEntities(profileId);
  const analyze = useAnalyzeProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Semantic Mapping"
        description="Sugestões de entidade de negócio, confiança, conflitos e revisão humana (Sprint 46.10)."
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
        <Button
          type="button"
          variant="ghost"
          disabled={!profileId || analyze.isPending}
          onClick={() => profileId && analyze.mutate(profileId)}
        >
          <Play className="mr-1.5 h-4 w-4" /> Reanalisar
        </Button>
      </form>

      {!profileId ? (
        <p className="text-sm text-muted-foreground">
          Informe um Profile ID para ver as sugestões.
        </p>
      ) : entities.isError ? (
        <ErrorState message="Falha ao carregar sugestões semânticas." />
      ) : entities.isLoading ? (
        <LoadingTable rows={4} cols={1} />
      ) : (entities.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma sugestão ainda — clique em &quot;Reanalisar&quot; após uma descoberta concluída.
        </p>
      ) : (
        <div className="space-y-3">
          {(entities.data ?? []).map((m) => (
            <MappingCard key={`${m.schema}.${m.table}`} mapping={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SemanticMappingPage(): ReactElement {
  return (
    <RequirePermission permission="semantic-mapping.read">
      <SemanticMappingContent />
    </RequirePermission>
  );
}
