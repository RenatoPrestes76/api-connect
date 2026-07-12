'use client';

import {
  useTopics,
  useClusters,
  useStreamMetrics,
  useTopicMetrics,
  useDLQ,
  useRequeueDLQ,
  useDiscardDLQ,
  useReplayJobs,
  useBridges,
  useReconnectBridge,
  useTwinTopology,
  useTwinFlow,
  useAIInsights,
  useForecasts,
} from '@/hooks/use-helios';
import { EventBusOverview } from '@/components/helios/EventBusOverview';
import { EventMesh } from '@/components/helios/EventMesh';
import { StreamingAnalytics } from '@/components/helios/StreamingAnalytics';
import { DeadLetterQueue } from '@/components/helios/DeadLetterQueue';
import { ReplayCenter } from '@/components/helios/ReplayCenter';
import { ExternalGateway } from '@/components/helios/ExternalGateway';
import { DigitalTwin } from '@/components/helios/DigitalTwin';
import { EventAI } from '@/components/helios/EventAI';
import { EventStudio } from '@/components/helios/EventStudio';
import { useState } from 'react';

const TABS = ['Overview', 'Analytics', 'DLQ', 'Replay', 'Digital Twin', 'AI', 'Gateway'] as const;
type Tab = (typeof TABS)[number];

export default function HeliosPage() {
  const [tab, setTab] = useState<Tab>('Overview');

  const topics = useTopics();
  const clusters = useClusters();
  const streamM = useStreamMetrics();
  const topicM = useTopicMetrics();
  const dlq = useDLQ();
  const requeue = useRequeueDLQ();
  const discard = useDiscardDLQ();
  const replayJobs = useReplayJobs();
  const bridges = useBridges();
  const reconnect = useReconnectBridge();
  const twin = useTwinTopology();
  const flow = useTwinFlow('order-001');
  const aiInsights = useAIInsights();
  const forecasts = useForecasts();

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          HELIOS — Enterprise Event Mesh
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Enterprise Data Fabric · Event Bus · Event Mesh · Streaming Analytics · Digital Twin
        </p>
      </div>

      {/* Studio KPI strip */}
      {topics.data && dlq.data && replayJobs.data && (
        <EventStudio
          topics={topics.data.topics}
          dlqEntries={dlq.data.entries}
          replayJobs={replayJobs.data.jobs}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${tab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'Overview' && topics.data && streamM.data && (
        <div className="space-y-5">
          <EventBusOverview topics={topics.data.topics} metrics={streamM.data} />
          {clusters.data && <EventMesh clusters={clusters.data.clusters} />}
        </div>
      )}

      {tab === 'Analytics' && streamM.data && topicM.data && (
        <StreamingAnalytics metrics={streamM.data} topicMetrics={topicM.data.metrics} />
      )}

      {tab === 'DLQ' && dlq.data && (
        <DeadLetterQueue
          entries={dlq.data.entries}
          onRequeue={(id) => requeue.mutate(id)}
          onDiscard={(id) => discard.mutate(id)}
        />
      )}

      {tab === 'Replay' && replayJobs.data && topics.data && (
        <ReplayCenter jobs={replayJobs.data.jobs} topics={topics.data.topics} />
      )}

      {tab === 'Digital Twin' && twin.data && (
        <DigitalTwin nodes={twin.data.nodes} edges={twin.data.edges} flow={flow.data} />
      )}

      {tab === 'AI' && aiInsights.data && forecasts.data && (
        <EventAI insights={aiInsights.data.insights} forecasts={forecasts.data.forecasts} />
      )}

      {tab === 'Gateway' && bridges.data && (
        <ExternalGateway
          bridges={bridges.data.bridges}
          onReconnect={(id) => reconnect.mutate(id)}
        />
      )}
    </div>
  );
}
