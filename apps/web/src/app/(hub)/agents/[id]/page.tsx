'use client';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { StatusBadge } from '@/components/common/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAgent } from '@/hooks/use-agents';
import { formatRelative, formatNumber } from '@/lib/utils';

interface Props {
  params: Promise<{ id: string }>;
}

export default function AgentDetailPage({ params }: Props) {
  const { id } = use(params);
  const { data: agent, isLoading, error, refetch } = useAgent(id);

  if (isLoading) return <PageLoading />;
  if (error || !agent) {
    return <ErrorState message="Agent not found." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/agents" className="hover:text-slate-700 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Agents
        </Link>
      </div>

      <PageHeader
        title={agent.hostname}
        description={`${agent.os} · v${agent.version}`}
        actions={<StatusBadge status={agent.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>System</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Hostname"  value={agent.hostname} mono />
            <Row label="IP"        value={agent.ip} mono />
            <Row label="OS"        value={agent.os} />
            <Row label="Version"   value={`v${agent.version}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status"     ><StatusBadge status={agent.status} /></Row>
            <Row label="Last Seen"  value={formatRelative(agent.lastSeen)} />
            <Row label="Connectors" value={agent.connectors.toString()} />
            <Row label="Syncs"      value={formatNumber(agent.syncCount)} />
            <Row label="Errors"     value={agent.errorCount.toString()} />
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
