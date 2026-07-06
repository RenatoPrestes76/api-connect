'use client';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Database, Clock, Zap, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { StatusBadge } from '@/components/common/status-badge';
import { ConnectorActions } from '@/components/connectors/connector-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConnector, useInvalidateConnectors } from '@/hooks/use-connectors';
import { formatRelative, formatDateTime, formatNumber } from '@/lib/utils';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ConnectorDetailPage({ params }: Props) {
  const { id } = use(params);
  const { data: connector, isLoading, error, refetch } = useConnector(id);
  const invalidate = useInvalidateConnectors();

  const refresh = () => { void refetch(); invalidate(); };

  if (isLoading) return <PageLoading />;
  if (error || !connector) {
    return <ErrorState message="Connector not found." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/connectors" className="hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Connectors
        </Link>
      </div>

      <PageHeader
        title={connector.name}
        description={`${connector.driver} · v${connector.version}`}
        actions={<ConnectorActions connector={connector} onRefresh={refresh} />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Connection */}
        <Card>
          <CardHeader><CardTitle>Connection</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Host"     value={connector.host} mono />
            <Row label="Database" value={connector.database} mono />
            <Row label="Driver"   value={connector.driver} />
            <Row label="Version"  value={`v${connector.version}`} />
            <Row label="Status">
              <StatusBadge status={connector.status} />
            </Row>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total Syncs"  value={formatNumber(connector.syncCount)} />
            <Row label="Error Count"  value={connector.errorCount.toString()} />
            <Row label="Last Sync"    value={connector.lastSync ? formatRelative(connector.lastSync) : 'Never'} />
            {connector.agentId && (
              <Row label="Agent ID" value={connector.agentId} mono />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label, value, mono, children,
}: {
  label:     string;
  value?:    string;
  mono?:     boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500 shrink-0">{label}</span>
      {children ?? (
        <span className={mono ? 'font-mono text-xs text-slate-700' : 'text-slate-700'}>
          {value}
        </span>
      )}
    </div>
  );
}
