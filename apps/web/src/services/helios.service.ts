import type {
  Topic,
  EventMessage,
  MeshCluster,
  StreamMetrics,
  TopicMetric,
  CatalogEntry,
  SchemaVersion,
  ReplayJob,
  DLQEntry,
  SecurityPolicy,
  SecurityAuditEntry,
  GovernancePolicy,
  AIInsight,
  TrafficForecast,
  TwinNode,
  TwinEdge,
  TwinFlow,
  MarketplaceEvent,
  ExternalBridge,
} from '@/types/helios';

const BASE = '/api/v1';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export const heliosService = {
  // Bus
  getTopics: (params?: { tenantId?: string; status?: string; limit?: number }) => {
    const q = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)])
    );
    return api<{ topics: Topic[]; total: number }>(
      `${BASE}/helios/bus/topics${q.toString() ? `?${q}` : ''}`
    );
  },
  getTopicById: (id: string) => api<Topic>(`${BASE}/helios/bus/topics/${id}`),
  publishEvent: (
    id: string,
    body: { eventType: string; payload: Record<string, unknown>; producer: string }
  ) =>
    api<EventMessage>(`${BASE}/helios/bus/topics/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getTopicMessages: (id: string, limit = 20) =>
    api<{ messages: EventMessage[]; total: number }>(
      `${BASE}/helios/bus/topics/${id}/messages?limit=${limit}`
    ),
  getClusters: () =>
    api<{ clusters: MeshCluster[]; total: number }>(`${BASE}/helios/mesh/clusters`),

  // Analytics
  getStreamMetrics: () => api<StreamMetrics>(`${BASE}/helios/analytics/stream`),
  getTopicMetrics: () =>
    api<{ metrics: TopicMetric[]; total: number }>(`${BASE}/helios/analytics/topics`),

  // Catalog
  getCatalog: (params?: { producer?: string; classification?: string; criticality?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => [k, v as string])
    );
    return api<{ entries: CatalogEntry[]; total: number }>(
      `${BASE}/helios/catalog${q.toString() ? `?${q}` : ''}`
    );
  },
  getCatalogEntry: (eventType: string) =>
    api<CatalogEntry>(`${BASE}/helios/catalog/${encodeURIComponent(eventType)}`),

  // Schema Registry
  getSchemas: (status?: string) =>
    api<{ schemas: SchemaVersion[]; total: number }>(
      `${BASE}/helios/schema${status ? `?status=${status}` : ''}`
    ),
  getSchemaVersions: (eventType: string) =>
    api<{ eventType: string; versions: SchemaVersion[]; total: number }>(
      `${BASE}/helios/schema/${encodeURIComponent(eventType)}/versions`
    ),
  rollbackSchema: (eventType: string, version: string) =>
    api<SchemaVersion>(`${BASE}/helios/schema/${encodeURIComponent(eventType)}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    }),

  // Replay
  getReplayJobs: (params?: { status?: string; tenantId?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => [k, v as string])
    );
    return api<{ jobs: ReplayJob[]; total: number }>(
      `${BASE}/helios/replay${q.toString() ? `?${q}` : ''}`
    );
  },
  getReplayJob: (id: string) => api<ReplayJob>(`${BASE}/helios/replay/${id}`),
  createReplayJob: (body: {
    topicId: string;
    tenantId: string;
    startTime: string;
    endTime: string;
    workflowId?: string;
  }) => api<ReplayJob>(`${BASE}/helios/replay`, { method: 'POST', body: JSON.stringify(body) }),

  // DLQ
  getDLQEntries: (status?: string) =>
    api<{ entries: DLQEntry[]; total: number }>(
      `${BASE}/helios/dlq${status ? `?status=${status}` : ''}`
    ),
  requeueDLQ: (id: string) => api<DLQEntry>(`${BASE}/helios/dlq/${id}/requeue`, { method: 'POST' }),
  discardDLQ: (id: string) => api<DLQEntry>(`${BASE}/helios/dlq/${id}/discard`, { method: 'POST' }),

  // Security
  getSecurityPolicies: (topicId?: string) =>
    api<{ policies: SecurityPolicy[]; total: number }>(
      `${BASE}/helios/security/policies${topicId ? `?topicId=${topicId}` : ''}`
    ),
  getSecurityAudit: (params?: { topicId?: string; result?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => [k, v as string])
    );
    return api<{ entries: SecurityAuditEntry[]; total: number }>(
      `${BASE}/helios/security/audit${q.toString() ? `?${q}` : ''}`
    );
  },

  // Governance
  getGovernancePolicies: (params?: { classification?: string; criticality?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => [k, v as string])
    );
    return api<{ policies: GovernancePolicy[]; total: number }>(
      `${BASE}/helios/governance${q.toString() ? `?${q}` : ''}`
    );
  },

  // AI
  getAIInsights: (type?: string) =>
    api<{ insights: AIInsight[]; total: number }>(
      `${BASE}/helios/ai/insights${type ? `?type=${type}` : ''}`
    ),
  getForecasts: (topicId?: string) =>
    api<{ forecasts: TrafficForecast[]; total: number }>(
      `${BASE}/helios/ai/forecast${topicId ? `?topicId=${topicId}` : ''}`
    ),

  // Twin
  getTwinTopology: () =>
    api<{ nodes: TwinNode[]; edges: TwinEdge[] }>(`${BASE}/helios/twin/topology`),
  getTwinFlow: (orderId: string) => api<TwinFlow>(`${BASE}/helios/twin/flow/${orderId}`),

  // Marketplace
  getMarketplaceEvents: (params?: { category?: string; tags?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => [k, v as string])
    );
    return api<{ events: MarketplaceEvent[]; total: number }>(
      `${BASE}/helios/marketplace${q.toString() ? `?${q}` : ''}`
    );
  },
  getMarketplaceEvent: (id: string) => api<MarketplaceEvent>(`${BASE}/helios/marketplace/${id}`),

  // Gateway
  getBridges: (params?: { status?: string; platform?: string }) => {
    const q = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => [k, v as string])
    );
    return api<{ bridges: ExternalBridge[]; total: number }>(
      `${BASE}/helios/gateway/bridges${q.toString() ? `?${q}` : ''}`
    );
  },
  reconnectBridge: (id: string) =>
    api<ExternalBridge>(`${BASE}/helios/gateway/bridges/${id}/reconnect`, { method: 'POST' }),
};
