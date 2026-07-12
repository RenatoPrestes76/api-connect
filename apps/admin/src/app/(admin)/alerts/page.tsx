'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Check, Radio, Send, X } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { DataTable, type Column } from '@/components/common/data-table';
import { LoadingTable } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequirePermission } from '@/components/auth/require-permission';
import { useAcknowledgeAlert, useAlerts, useResolveAlert } from '@/hooks/use-alerts';
import { useLiveNotifications } from '@/hooks/use-live-notifications';
import { useSendTestNotification } from '@/hooks/use-notifications';
import type { RuntimeAlert, NotificationChannel } from '@/types/fleet';

const SEVERITY_VARIANT: Record<RuntimeAlert['severity'], 'default' | 'warning' | 'danger'> = {
  INFO: 'default',
  WARNING: 'warning',
  CRITICAL: 'danger',
};

const STATUS_VARIANT: Record<RuntimeAlert['status'], 'danger' | 'warning' | 'success'> = {
  ACTIVE: 'danger',
  ACKNOWLEDGED: 'warning',
  RESOLVED: 'success',
};

function LiveFeed(): ReactElement {
  const { messages, connected } = useLiveNotifications();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className={`h-4 w-4 ${connected ? 'text-success' : 'text-muted-foreground'}`} />
          Feed em tempo real (WebSocket)
          <Badge variant={connected ? 'success' : 'default'}>
            {connected ? 'conectado' : 'conectando…'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-56 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma notificação recebida ainda nesta sessão.
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className="rounded-md border border-border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{m.subject ?? m.type}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.receivedAt).toLocaleTimeString('pt-BR')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{m.body}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TestNotificationCard(): ReactElement {
  const sendTest = useSendTestNotification();
  const [channel, setChannel] = useState<NotificationChannel>('EMAIL');
  const [target, setTarget] = useState('ops-team@atlasconnect.com.br');
  const [body, setBody] = useState('Teste de notificação do Atlas Control Plane.');
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const notification = await sendTest.mutateAsync({ channel, target, body });
    setResult(`${notification.status}${notification.error ? ` — ${notification.error}` : ''}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-4 w-4" /> Testar canal de notificação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as NotificationChannel)}
            className="h-9 w-full rounded border border-input bg-card px-3 text-sm text-foreground"
          >
            <option value="EMAIL">E-mail</option>
            <option value="SLACK">Slack</option>
            <option value="TEAMS">Microsoft Teams</option>
            <option value="WEBHOOK">Webhook</option>
            <option value="WEBSOCKET">WebSocket (broadcast)</option>
          </select>
          <Input
            placeholder="Destino (e-mail ou URL)"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Input placeholder="Mensagem" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button type="submit" size="sm" loading={sendTest.isPending} className="w-full">
            Enviar teste
          </Button>
          {result && <p className="text-xs text-muted-foreground">Resultado: {result}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function AlertCenterContent(): ReactElement {
  const { data, isLoading, isError, refetch } = useAlerts();
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();

  const columns: Column<RuntimeAlert>[] = [
    {
      key: 'severity',
      header: 'Severidade',
      cell: (a) => <Badge variant={SEVERITY_VARIANT[a.severity]}>{a.severity}</Badge>,
    },
    {
      key: 'type',
      header: 'Tipo',
      cell: (a) => <span className="font-mono text-xs">{a.type}</span>,
    },
    { key: 'message', header: 'Mensagem', cell: (a) => a.message },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Criado em',
      cell: (a) => new Date(a.createdAt).toLocaleString('pt-BR'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (a) =>
        a.status === 'ACTIVE' ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => acknowledge.mutate(a.id)}
              aria-label="Reconhecer"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => resolve.mutate(a.id)}
              aria-label="Resolver"
            >
              <X className="h-4 w-4 text-success" />
            </Button>
          </div>
        ) : a.status === 'ACKNOWLEDGED' ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => resolve.mutate(a.id)}
            aria-label="Resolver"
          >
            <X className="h-4 w-4 text-success" />
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert Center"
        description="Runtime offline, alto consumo de CPU/memória, falhas de sincronização, deploys e tokens expirando."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <LiveFeed />
        <TestNotificationCard />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card">
          <LoadingTable rows={4} cols={6} />
        </div>
      ) : isError ? (
        <ErrorState message="Falha ao carregar alertas" onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          keyFn={(a) => a.id}
          emptyMessage="Nenhum alerta no momento."
        />
      )}
    </div>
  );
}

export default function AlertsPage(): ReactElement {
  return (
    <RequirePermission permission="dashboard.view">
      <AlertCenterContent />
    </RequirePermission>
  );
}
