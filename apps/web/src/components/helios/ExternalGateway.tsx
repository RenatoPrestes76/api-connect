'use client';
import type { ExternalBridge } from '@/types/helios';

const PLATFORM_LABELS: Record<string, string> = {
  kafka: 'Apache Kafka',
  rabbitmq: 'RabbitMQ',
  mqtt: 'MQTT',
  nats: 'NATS',
  azure_event_hubs: 'Azure Event Hubs',
  google_pubsub: 'Google Pub/Sub',
  aws_eventbridge: 'Amazon EventBridge',
  pulsar: 'Apache Pulsar',
};

const STATUS_STYLES: Record<string, string> = {
  connected: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  disconnected: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  error: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const DIR_LABELS: Record<string, string> = {
  inbound: '← Inbound',
  outbound: '→ Outbound',
  bidirectional: '↔ Bidirectional',
};

interface Props {
  bridges: ExternalBridge[];
  onReconnect: (id: string) => void;
}

export function ExternalGateway({ bridges, onReconnect }: Props) {
  const connected = bridges.filter((b) => b.status === 'connected').length;
  const errorCount = bridges.filter((b) => b.status === 'error').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Bridges', value: bridges.length },
          { label: 'Connected', value: connected, color: 'text-emerald-400' },
          {
            label: 'Errors',
            value: errorCount,
            color: errorCount > 0 ? 'text-red-400' : 'text-zinc-400',
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-center"
          >
            <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
            <p className={`text-xl font-semibold tabular-nums ${k.color ?? 'text-zinc-200'}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {bridges.map((b) => (
          <div key={b.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-zinc-200 text-sm">
                    {PLATFORM_LABELS[b.platform]}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[b.status]}`}
                  >
                    {b.status}
                  </span>
                  <span className="text-xs text-zinc-500">{DIR_LABELS[b.direction]}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  {b.topicsLinked.length} topic{b.topicsLinked.length !== 1 ? 's' : ''} linked ·{' '}
                  {b.eventsTransferred.toLocaleString()} events transferred
                </p>
                {b.errorMessage && <p className="text-xs text-red-400 mt-1">{b.errorMessage}</p>}
              </div>
              {b.status !== 'connected' && (
                <button
                  onClick={() => onReconnect(b.id)}
                  className="rounded px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors shrink-0"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
