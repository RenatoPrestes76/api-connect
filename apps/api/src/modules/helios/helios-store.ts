import { randomBytes } from 'node:crypto';
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
} from './types.js';

const MAX_MESSAGES_PER_TOPIC = 10_000;

let _instance: HeliosStore | null = null;

export class HeliosStore {
  private topics: Topic[];
  private messages: Map<string, EventMessage[]>;
  private clusters: MeshCluster[];
  private catalog: CatalogEntry[];
  private schemas: SchemaVersion[];
  private replayJobs: ReplayJob[];
  private dlqEntries: DLQEntry[];
  private securityPolicies: SecurityPolicy[];
  private securityAudit: SecurityAuditEntry[];
  private governancePolicies: GovernancePolicy[];
  private aiInsights: AIInsight[];
  private forecasts: TrafficForecast[];
  private twinNodes: TwinNode[];
  private twinEdges: TwinEdge[];
  private twinFlows: Map<string, TwinFlow>;
  private marketplaceEvents: MarketplaceEvent[];
  private bridges: ExternalBridge[];
  private msgSeq = 100;
  private replaySeq = 10;

  private constructor() {
    this.topics = this._seedTopics();
    this.messages = this._seedMessages();
    this.clusters = this._seedClusters();
    this.catalog = this._seedCatalog();
    this.schemas = this._seedSchemas();
    this.replayJobs = this._seedReplayJobs();
    this.dlqEntries = this._seedDLQ();
    this.securityPolicies = this._seedSecurityPolicies();
    this.securityAudit = this._seedSecurityAudit();
    this.governancePolicies = this._seedGovernancePolicies();
    this.aiInsights = this._seedAIInsights();
    this.forecasts = this._seedForecasts();
    this.twinNodes = this._seedTwinNodes();
    this.twinEdges = this._seedTwinEdges();
    this.twinFlows = this._seedTwinFlows();
    this.marketplaceEvents = this._seedMarketplace();
    this.bridges = this._seedBridges();
  }

  static getInstance(): HeliosStore {
    if (!_instance) _instance = new HeliosStore();
    return _instance;
  }

  // ─── Topics ────────────────────────────────────────────────────────────────

  getTopics(filters: { tenantId?: string; status?: string; limit?: number } = {}): Topic[] {
    let list = [...this.topics];
    if (filters.tenantId) list = list.filter((t) => t.tenantId === filters.tenantId);
    if (filters.status) list = list.filter((t) => t.status === filters.status);
    if (filters.limit) list = list.slice(0, filters.limit);
    return list;
  }

  getTopicById(id: string): Topic | undefined {
    return this.topics.find((t) => t.id === id);
  }

  getTenantIdForTopic(topicId: string): string | undefined {
    return this.topics.find((t) => t.id === topicId)?.tenantId;
  }

  getTenantIdForEventType(eventType: string): string | undefined {
    return this.topics.find((t) => t.eventType === eventType)?.tenantId;
  }

  publishEvent(
    topicId: string,
    eventType: string,
    payload: Record<string, unknown>,
    producer: string
  ): EventMessage | null {
    const topic = this.getTopicById(topicId);
    if (!topic) return null;
    const msg: EventMessage = {
      id: `msg-${String(++this.msgSeq).padStart(3, '0')}`,
      topicId,
      tenantId: topic.tenantId,
      producer,
      eventType,
      version: 'v2',
      payload,
      signature: `sha256:${randomBytes(16).toString('hex')}`,
      timestamp: new Date().toISOString(),
      status: 'delivered',
    };
    const list = this.messages.get(topicId) ?? [];
    list.push(msg);
    if (list.length > MAX_MESSAGES_PER_TOPIC) list.splice(0, list.length - MAX_MESSAGES_PER_TOPIC);
    this.messages.set(topicId, list);
    topic.messagesTotal += 1;
    return msg;
  }

  getTopicMessages(topicId: string, limit = 20): EventMessage[] {
    const list = this.messages.get(topicId) ?? [];
    return list.slice(-limit);
  }

  // ─── Mesh ──────────────────────────────────────────────────────────────────

  getClusters(): MeshCluster[] {
    return [...this.clusters];
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  getStreamMetrics(): StreamMetrics {
    return {
      eventsPerSecond: 1847,
      throughputMbps: 42.3,
      avgLatencyMs: 8.4,
      p99LatencyMs: 34.7,
      errorRate: 0.12,
      activeConsumers: 64,
      activeTopics: 7,
      totalEventsToday: 9_432_810,
    };
  }

  getTopicMetrics(tenantId?: string): TopicMetric[] {
    const topics = tenantId ? this.topics.filter((t) => t.tenantId === tenantId) : this.topics;
    return topics.map((t) => ({
      topicId: t.id,
      name: t.eventType,
      eventsPerSecond: t.currentEps,
      errorRate: t.id === 'topic-008' ? 0.4 : t.id === 'topic-005' ? 0 : 0.05,
      consumerLag: t.id === 'topic-008' ? 12000 : t.id === 'topic-001' ? 340 : 0,
      avgLatencyMs: t.id === 'topic-008' ? 22 : 7,
    }));
  }

  // ─── Catalog ──────────────────────────────────────────────────────────────

  getCatalog(
    filters: {
      producer?: string;
      classification?: string;
      criticality?: string;
      tenantId?: string;
    } = {}
  ): CatalogEntry[] {
    let list = [...this.catalog];
    if (filters.producer) list = list.filter((c) => c.producer === filters.producer);
    if (filters.classification)
      list = list.filter((c) => c.classification === filters.classification);
    if (filters.criticality) list = list.filter((c) => c.criticality === filters.criticality);
    if (filters.tenantId)
      list = list.filter((c) => this.getTenantIdForEventType(c.eventType) === filters.tenantId);
    return list;
  }

  getCatalogEntry(eventType: string): CatalogEntry | undefined {
    return this.catalog.find((c) => c.eventType === eventType);
  }

  // ─── Schema Registry ──────────────────────────────────────────────────────

  getSchemas(filters: { status?: string; tenantId?: string } = {}): SchemaVersion[] {
    let list = [...this.schemas];
    if (filters.status) list = list.filter((s) => s.status === filters.status);
    if (filters.tenantId)
      list = list.filter((s) => this.getTenantIdForEventType(s.eventType) === filters.tenantId);
    return list;
  }

  getSchemaVersions(eventType: string): SchemaVersion[] {
    return this.schemas.filter((s) => s.eventType === eventType);
  }

  rollbackSchema(eventType: string, version: string): SchemaVersion | null | 'VERSION_NOT_FOUND' {
    const versions = this.schemas.filter((s) => s.eventType === eventType);
    if (versions.length === 0) return null;
    const target = versions.find((s) => s.version === version);
    if (!target) return 'VERSION_NOT_FOUND';
    versions.forEach((s) => {
      if (s.status === 'active') {
        s.status = 'deprecated';
        s.deprecatedAt = new Date().toISOString();
      }
    });
    target.status = 'active';
    delete target.deprecatedAt;
    return target;
  }

  // ─── Replay ───────────────────────────────────────────────────────────────

  getReplayJobs(filters: { status?: string; tenantId?: string } = {}): ReplayJob[] {
    let list = [...this.replayJobs];
    if (filters.status) list = list.filter((j) => j.status === filters.status);
    if (filters.tenantId) list = list.filter((j) => j.tenantId === filters.tenantId);
    return list;
  }

  getReplayJobById(id: string): ReplayJob | undefined {
    return this.replayJobs.find((j) => j.id === id);
  }

  createReplayJob(
    topicId: string,
    tenantId: string,
    startTime: string,
    endTime: string,
    workflowId?: string
  ): ReplayJob | 'TOPIC_NOT_FOUND' {
    if (!this.getTopicById(topicId)) return 'TOPIC_NOT_FOUND';
    const job: ReplayJob = {
      id: `replay-${String(++this.replaySeq).padStart(3, '0')}`,
      topicId,
      tenantId,
      workflowId,
      startTime,
      endTime,
      status: 'queued',
      eventsReplayed: 0,
      totalEvents: Math.floor(Math.random() * 50000) + 1000,
      createdAt: new Date().toISOString(),
    };
    this.replayJobs.push(job);
    return job;
  }

  // ─── DLQ ──────────────────────────────────────────────────────────────────

  getDLQEntries(filters: { status?: string; tenantId?: string } = {}): DLQEntry[] {
    let list = [...this.dlqEntries];
    if (filters.status) list = list.filter((d) => d.status === filters.status);
    if (filters.tenantId)
      list = list.filter((d) => this.getTenantIdForTopic(d.originalTopicId) === filters.tenantId);
    return list;
  }

  requeueDLQEntry(id: string): DLQEntry | null | 'ALREADY_RESOLVED' | 'ALREADY_DISCARDED' {
    const entry = this.dlqEntries.find((d) => d.id === id);
    if (!entry) return null;
    if (entry.status === 'resolved') return 'ALREADY_RESOLVED';
    if (entry.status === 'discarded') return 'ALREADY_DISCARDED';
    entry.status = 'resolved';
    entry.resolvedAt = new Date().toISOString();
    return entry;
  }

  discardDLQEntry(id: string): DLQEntry | null | 'ALREADY_RESOLVED' | 'ALREADY_DISCARDED' {
    const entry = this.dlqEntries.find((d) => d.id === id);
    if (!entry) return null;
    if (entry.status === 'resolved') return 'ALREADY_RESOLVED';
    if (entry.status === 'discarded') return 'ALREADY_DISCARDED';
    entry.status = 'discarded';
    return entry;
  }

  // ─── Security ─────────────────────────────────────────────────────────────

  getSecurityPolicies(filters: { topicId?: string; tenantId?: string } = {}): SecurityPolicy[] {
    let list = [...this.securityPolicies];
    if (filters.topicId) list = list.filter((p) => p.topicId === filters.topicId);
    if (filters.tenantId)
      list = list.filter((p) => this.getTenantIdForTopic(p.topicId) === filters.tenantId);
    return list;
  }

  getSecurityAudit(
    filters: { topicId?: string; result?: string; tenantId?: string } = {}
  ): SecurityAuditEntry[] {
    let list = [...this.securityAudit];
    if (filters.topicId) list = list.filter((a) => a.topicId === filters.topicId);
    if (filters.result) list = list.filter((a) => a.result === filters.result);
    if (filters.tenantId)
      list = list.filter((a) => this.getTenantIdForTopic(a.topicId) === filters.tenantId);
    return list;
  }

  // ─── Governance ───────────────────────────────────────────────────────────

  getGovernancePolicies(
    filters: { classification?: string; criticality?: string; tenantId?: string } = {}
  ): GovernancePolicy[] {
    let list = [...this.governancePolicies];
    if (filters.classification)
      list = list.filter((g) => g.classification === filters.classification);
    if (filters.criticality) list = list.filter((g) => g.criticality === filters.criticality);
    if (filters.tenantId)
      list = list.filter((g) => this.getTenantIdForEventType(g.eventType) === filters.tenantId);
    return list;
  }

  // ─── AI ───────────────────────────────────────────────────────────────────

  getAIInsights(filters: { type?: string } = {}): AIInsight[] {
    let list = [...this.aiInsights];
    if (filters.type) list = list.filter((i) => i.type === filters.type);
    return list;
  }

  getForecasts(filters: { topicId?: string } = {}): TrafficForecast[] {
    let list = [...this.forecasts];
    if (filters.topicId) list = list.filter((f) => f.topicId === filters.topicId);
    return list;
  }

  // ─── Studio ───────────────────────────────────────────────────────────────

  getTwinTopology(): { nodes: TwinNode[]; edges: TwinEdge[] } {
    return { nodes: [...this.twinNodes], edges: [...this.twinEdges] };
  }

  getTwinFlow(orderId: string): TwinFlow | undefined {
    return this.twinFlows.get(orderId);
  }

  getMarketplaceEvents(filters: { category?: string; tags?: string } = {}): MarketplaceEvent[] {
    let list = [...this.marketplaceEvents];
    if (filters.category) list = list.filter((m) => m.category === filters.category);
    if (filters.tags) {
      const tag = filters.tags.toLowerCase();
      list = list.filter((m) => m.tags.some((t) => t.toLowerCase().includes(tag)));
    }
    return list;
  }

  getMarketplaceEventById(id: string): MarketplaceEvent | undefined {
    return this.marketplaceEvents.find((m) => m.id === id);
  }

  getBridges(filters: { status?: string; platform?: string } = {}): ExternalBridge[] {
    let list = [...this.bridges];
    if (filters.status) list = list.filter((b) => b.status === filters.status);
    if (filters.platform) list = list.filter((b) => b.platform === filters.platform);
    return list;
  }

  reconnectBridge(id: string): ExternalBridge | null | 'ALREADY_CONNECTED' {
    const bridge = this.bridges.find((b) => b.id === id);
    if (!bridge) return null;
    if (bridge.status === 'connected') return 'ALREADY_CONNECTED';
    bridge.status = 'connected';
    bridge.lastConnectedAt = new Date().toISOString();
    delete bridge.errorMessage;
    return bridge;
  }

  // ─── Seed Data ────────────────────────────────────────────────────────────

  private _seedTopics(): Topic[] {
    return [
      {
        id: 'topic-001',
        name: 'order-created',
        description: 'New orders from all channels',
        eventType: 'Order.Created',
        partitions: 6,
        replication: 3,
        retentionDays: 30,
        tenantId: 'tenant-enterprise',
        status: 'active',
        messagesTotal: 482340,
        currentEps: 42,
        createdAt: '2025-01-10T08:00:00Z',
      },
      {
        id: 'topic-002',
        name: 'invoice-generated',
        description: 'Fiscal documents generated by NF-e connector',
        eventType: 'Invoice.Generated',
        partitions: 3,
        replication: 2,
        retentionDays: 90,
        tenantId: 'tenant-enterprise',
        status: 'active',
        messagesTotal: 211890,
        currentEps: 18,
        createdAt: '2025-01-10T08:05:00Z',
      },
      {
        id: 'topic-003',
        name: 'stock-changed',
        description: 'WMS inventory updates',
        eventType: 'Stock.Changed',
        partitions: 4,
        replication: 2,
        retentionDays: 14,
        tenantId: 'tenant-retail',
        status: 'active',
        messagesTotal: 1023400,
        currentEps: 95,
        createdAt: '2025-01-12T09:00:00Z',
      },
      {
        id: 'topic-004',
        name: 'payment-confirmed',
        description: 'Confirmed payments from payment gateway',
        eventType: 'Payment.Confirmed',
        partitions: 3,
        replication: 3,
        retentionDays: 365,
        tenantId: 'tenant-fintech',
        status: 'active',
        messagesTotal: 98210,
        currentEps: 8,
        createdAt: '2025-01-15T10:00:00Z',
      },
      {
        id: 'topic-005',
        name: 'customer-updated',
        description: 'CRM customer profile changes',
        eventType: 'Customer.Updated',
        partitions: 2,
        replication: 2,
        retentionDays: 60,
        tenantId: 'tenant-enterprise',
        status: 'paused',
        messagesTotal: 54320,
        currentEps: 0,
        createdAt: '2025-01-20T11:00:00Z',
      },
      {
        id: 'topic-006',
        name: 'product-created',
        description: 'New product catalog entries',
        eventType: 'Product.Created',
        partitions: 2,
        replication: 2,
        retentionDays: 30,
        tenantId: 'tenant-retail',
        status: 'active',
        messagesTotal: 12450,
        currentEps: 3,
        createdAt: '2025-02-01T08:00:00Z',
      },
      {
        id: 'topic-007',
        name: 'shipment-dispatched',
        description: 'TMS shipment dispatched events',
        eventType: 'Shipment.Dispatched',
        partitions: 3,
        replication: 2,
        retentionDays: 45,
        tenantId: 'tenant-logistics',
        status: 'active',
        messagesTotal: 78900,
        currentEps: 12,
        createdAt: '2025-02-10T09:00:00Z',
      },
      {
        id: 'topic-008',
        name: 'iot-sensor-reading',
        description: 'High-volume IoT sensor telemetry',
        eventType: 'IoT.SensorReading',
        partitions: 12,
        replication: 3,
        retentionDays: 7,
        tenantId: 'tenant-iot',
        status: 'active',
        messagesTotal: 84320000,
        currentEps: 1650,
        createdAt: '2025-03-01T00:00:00Z',
      },
    ];
  }

  private _seedMessages(): Map<string, EventMessage[]> {
    const map = new Map<string, EventMessage[]>();
    const topics = ['topic-001', 'topic-002', 'topic-003', 'topic-004', 'topic-007', 'topic-008'];
    topics.forEach((tid, ti) => {
      const msgs: EventMessage[] = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${String(ti * 5 + i + 1).padStart(3, '0')}`,
        topicId: tid,
        tenantId: `tenant-${tid === 'topic-004' ? 'fintech' : tid === 'topic-008' ? 'iot' : 'enterprise'}`,
        producer: `producer-${tid}`,
        eventType: this._topicEventType(tid),
        version: 'v2',
        payload: { id: `evt-${ti * 5 + i + 1}`, timestamp: new Date().toISOString() },
        signature: `sha256:abc${ti}${i}`,
        timestamp: new Date(Date.now() - (4 - i) * 60_000).toISOString(),
        status: i === 2 && tid === 'topic-003' ? 'failed' : 'delivered',
      }));
      map.set(tid, msgs);
    });
    return map;
  }

  private _topicEventType(id: string): string {
    const map: Record<string, string> = {
      'topic-001': 'Order.Created',
      'topic-002': 'Invoice.Generated',
      'topic-003': 'Stock.Changed',
      'topic-004': 'Payment.Confirmed',
      'topic-005': 'Customer.Updated',
      'topic-006': 'Product.Created',
      'topic-007': 'Shipment.Dispatched',
      'topic-008': 'IoT.SensorReading',
    };
    return map[id] ?? 'Unknown';
  }

  private _seedClusters(): MeshCluster[] {
    return [
      {
        id: 'cluster-001',
        name: 'São Paulo Cluster',
        region: 'south-america-east-1',
        status: 'healthy',
        topicsReplicated: 8,
        latencyMs: 4,
        eventsLast24h: 6_200_000,
      },
      {
        id: 'cluster-002',
        name: 'Virginia Cluster',
        region: 'us-east-1',
        status: 'healthy',
        topicsReplicated: 6,
        latencyMs: 89,
        eventsLast24h: 2_100_000,
      },
      {
        id: 'cluster-003',
        name: 'Frankfurt Cluster',
        region: 'eu-central-1',
        status: 'degraded',
        topicsReplicated: 4,
        latencyMs: 145,
        eventsLast24h: 1_132_810,
      },
    ];
  }

  private _seedCatalog(): CatalogEntry[] {
    const schema = (props: Record<string, string>) => ({
      type: 'object',
      properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { type: v }])),
      required: Object.keys(props),
    });
    return [
      {
        id: 'cat-001',
        eventType: 'Order.Created',
        description: 'Triggered when a new order is created in any channel',
        currentVersion: 'v2',
        producer: 'order-service',
        consumers: ['invoice-service', 'stock-service', 'workflow-engine', 'analytics'],
        schema: schema({
          orderId: 'string',
          customerId: 'string',
          total: 'number',
          items: 'array',
        }),
        examplePayload: {
          orderId: 'ord-001',
          customerId: 'cust-001',
          total: 299.9,
          items: [{ sku: 'SKU-001', qty: 2 }],
        },
        classification: 'internal',
        criticality: 'critical',
        retentionDays: 30,
        changelog: [
          {
            version: 'v2',
            date: '2025-03-01',
            changes: 'Added items array',
            author: 'dev@company.com',
          },
          {
            version: 'v1',
            date: '2025-01-10',
            changes: 'Initial version',
            author: 'dev@company.com',
          },
        ],
        createdAt: '2025-01-10T08:00:00Z',
        updatedAt: '2025-03-01T00:00:00Z',
      },
      {
        id: 'cat-002',
        eventType: 'Invoice.Generated',
        description: 'Fiscal document (NF-e) generated and sent to SEFAZ',
        currentVersion: 'v1',
        producer: 'nfe-connector',
        consumers: ['erp-service', 'accounting', 'analytics'],
        schema: schema({
          invoiceId: 'string',
          orderId: 'string',
          nfeKey: 'string',
          totalValue: 'number',
        }),
        examplePayload: {
          invoiceId: 'inv-001',
          orderId: 'ord-001',
          nfeKey: '35250112345678000112550010000001231234567890',
          totalValue: 299.9,
        },
        classification: 'confidential',
        criticality: 'critical',
        retentionDays: 90,
        changelog: [
          {
            version: 'v1',
            date: '2025-01-10',
            changes: 'Initial version',
            author: 'dev@company.com',
          },
        ],
        createdAt: '2025-01-10T08:05:00Z',
        updatedAt: '2025-01-10T08:05:00Z',
      },
      {
        id: 'cat-003',
        eventType: 'Stock.Changed',
        description: 'Inventory quantity update from WMS',
        currentVersion: 'v1',
        producer: 'wms-connector',
        consumers: ['order-service', 'product-service', 'analytics'],
        schema: schema({ sku: 'string', warehouseId: 'string', delta: 'number', newQty: 'number' }),
        examplePayload: { sku: 'SKU-001', warehouseId: 'wh-sp-01', delta: -2, newQty: 48 },
        classification: 'internal',
        criticality: 'high',
        retentionDays: 14,
        changelog: [
          {
            version: 'v1',
            date: '2025-01-12',
            changes: 'Initial version',
            author: 'dev@company.com',
          },
        ],
        createdAt: '2025-01-12T09:00:00Z',
        updatedAt: '2025-01-12T09:00:00Z',
      },
      {
        id: 'cat-004',
        eventType: 'Payment.Confirmed',
        description: 'Payment successfully authorized and captured',
        currentVersion: 'v2',
        producer: 'payment-gateway',
        consumers: ['order-service', 'invoice-service', 'analytics', 'fraud-detection'],
        schema: schema({
          paymentId: 'string',
          orderId: 'string',
          amount: 'number',
          method: 'string',
        }),
        examplePayload: {
          paymentId: 'pay-001',
          orderId: 'ord-001',
          amount: 299.9,
          method: 'credit_card',
        },
        classification: 'restricted',
        criticality: 'critical',
        retentionDays: 365,
        changelog: [
          {
            version: 'v2',
            date: '2025-04-01',
            changes: 'Added fraud score field',
            author: 'security@company.com',
          },
          {
            version: 'v1',
            date: '2025-01-15',
            changes: 'Initial version',
            author: 'dev@company.com',
          },
        ],
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-04-01T00:00:00Z',
      },
      {
        id: 'cat-005',
        eventType: 'Customer.Updated',
        description: 'Customer profile changes from CRM',
        currentVersion: 'v3',
        producer: 'crm-connector',
        consumers: ['email-service', 'order-service', 'loyalty-service'],
        schema: schema({
          customerId: 'string',
          field: 'string',
          oldValue: 'string',
          newValue: 'string',
        }),
        examplePayload: {
          customerId: 'cust-001',
          field: 'email',
          oldValue: 'old@email.com',
          newValue: 'new@email.com',
        },
        classification: 'confidential',
        criticality: 'medium',
        retentionDays: 60,
        changelog: [
          {
            version: 'v3',
            date: '2025-05-01',
            changes: 'LGPD compliance fields',
            author: 'dpo@company.com',
          },
          {
            version: 'v2',
            date: '2025-03-01',
            changes: 'Added field tracking',
            author: 'dev@company.com',
          },
          {
            version: 'v1',
            date: '2025-01-20',
            changes: 'Initial version',
            author: 'dev@company.com',
          },
        ],
        createdAt: '2025-01-20T11:00:00Z',
        updatedAt: '2025-05-01T00:00:00Z',
      },
      {
        id: 'cat-006',
        eventType: 'Product.Created',
        description: 'New product added to catalog',
        currentVersion: 'v1',
        producer: 'product-service',
        consumers: ['search-service', 'marketplace', 'analytics'],
        schema: schema({ productId: 'string', sku: 'string', name: 'string', price: 'number' }),
        examplePayload: {
          productId: 'prod-001',
          sku: 'SKU-999',
          name: 'Produto Exemplo',
          price: 49.9,
        },
        classification: 'public',
        criticality: 'low',
        retentionDays: 30,
        changelog: [
          {
            version: 'v1',
            date: '2025-02-01',
            changes: 'Initial version',
            author: 'dev@company.com',
          },
        ],
        createdAt: '2025-02-01T08:00:00Z',
        updatedAt: '2025-02-01T08:00:00Z',
      },
      {
        id: 'cat-007',
        eventType: 'Shipment.Dispatched',
        description: 'Carrier picked up and shipment is in transit',
        currentVersion: 'v1',
        producer: 'tms-connector',
        consumers: ['order-service', 'customer-service', 'analytics'],
        schema: schema({
          shipmentId: 'string',
          orderId: 'string',
          carrier: 'string',
          trackingCode: 'string',
        }),
        examplePayload: {
          shipmentId: 'ship-001',
          orderId: 'ord-001',
          carrier: 'CORREIOS',
          trackingCode: 'AA123456789BR',
        },
        classification: 'internal',
        criticality: 'high',
        retentionDays: 45,
        changelog: [
          {
            version: 'v1',
            date: '2025-02-10',
            changes: 'Initial version',
            author: 'dev@company.com',
          },
        ],
        createdAt: '2025-02-10T09:00:00Z',
        updatedAt: '2025-02-10T09:00:00Z',
      },
      {
        id: 'cat-008',
        eventType: 'IoT.SensorReading',
        description: 'Industrial IoT sensor telemetry readings',
        currentVersion: 'v1',
        producer: 'iot-gateway',
        consumers: ['analytics', 'ai-engine', 'alerting'],
        schema: schema({
          deviceId: 'string',
          sensorType: 'string',
          value: 'number',
          unit: 'string',
        }),
        examplePayload: {
          deviceId: 'sensor-001',
          sensorType: 'temperature',
          value: 23.5,
          unit: 'celsius',
        },
        classification: 'internal',
        criticality: 'medium',
        retentionDays: 7,
        changelog: [
          {
            version: 'v1',
            date: '2025-03-01',
            changes: 'Initial version',
            author: 'iot@company.com',
          },
        ],
        createdAt: '2025-03-01T00:00:00Z',
        updatedAt: '2025-03-01T00:00:00Z',
      },
    ];
  }

  private _seedSchemas(): SchemaVersion[] {
    const mkSchema = (props: string[]) => ({
      type: 'object',
      properties: Object.fromEntries(props.map((p) => [p, { type: 'string' }])),
      required: props,
    });
    return [
      // Order.Created
      {
        id: 'schema-001',
        eventType: 'Order.Created',
        version: 'v1',
        schema: mkSchema(['orderId', 'customerId']),
        compatibility: 'BACKWARD',
        status: 'deprecated',
        createdAt: '2025-01-10T08:00:00Z',
        deprecatedAt: '2025-03-01T00:00:00Z',
      },
      {
        id: 'schema-002',
        eventType: 'Order.Created',
        version: 'v2',
        schema: mkSchema(['orderId', 'customerId', 'total', 'items']),
        compatibility: 'BACKWARD',
        status: 'active',
        createdAt: '2025-03-01T00:00:00Z',
      },
      // Invoice.Generated
      {
        id: 'schema-003',
        eventType: 'Invoice.Generated',
        version: 'v1',
        schema: mkSchema(['invoiceId', 'orderId', 'nfeKey', 'totalValue']),
        compatibility: 'FULL',
        status: 'active',
        createdAt: '2025-01-10T08:05:00Z',
      },
      // Stock.Changed
      {
        id: 'schema-004',
        eventType: 'Stock.Changed',
        version: 'v1',
        schema: mkSchema(['sku', 'delta', 'newQty']),
        compatibility: 'BACKWARD',
        status: 'active',
        createdAt: '2025-01-12T09:00:00Z',
      },
      // Payment.Confirmed
      {
        id: 'schema-005',
        eventType: 'Payment.Confirmed',
        version: 'v1',
        schema: mkSchema(['paymentId', 'orderId', 'amount']),
        compatibility: 'BACKWARD',
        status: 'deprecated',
        createdAt: '2025-01-15T10:00:00Z',
        deprecatedAt: '2025-04-01T00:00:00Z',
      },
      {
        id: 'schema-006',
        eventType: 'Payment.Confirmed',
        version: 'v2',
        schema: mkSchema(['paymentId', 'orderId', 'amount', 'fraudScore']),
        compatibility: 'BACKWARD',
        status: 'active',
        createdAt: '2025-04-01T00:00:00Z',
      },
      // Customer.Updated
      {
        id: 'schema-007',
        eventType: 'Customer.Updated',
        version: 'v1',
        schema: mkSchema(['customerId', 'field']),
        compatibility: 'BACKWARD',
        status: 'deprecated',
        createdAt: '2025-01-20T11:00:00Z',
        deprecatedAt: '2025-03-01T00:00:00Z',
      },
      {
        id: 'schema-008',
        eventType: 'Customer.Updated',
        version: 'v2',
        schema: mkSchema(['customerId', 'field', 'oldValue', 'newValue']),
        compatibility: 'BACKWARD',
        status: 'deprecated',
        createdAt: '2025-03-01T00:00:00Z',
        deprecatedAt: '2025-05-01T00:00:00Z',
      },
      {
        id: 'schema-009',
        eventType: 'Customer.Updated',
        version: 'v3',
        schema: mkSchema(['customerId', 'field', 'oldValue', 'newValue', 'lgpdBasis']),
        compatibility: 'FORWARD',
        status: 'active',
        createdAt: '2025-05-01T00:00:00Z',
      },
      // Product.Created
      {
        id: 'schema-010',
        eventType: 'Product.Created',
        version: 'v1',
        schema: mkSchema(['productId', 'sku', 'name', 'price']),
        compatibility: 'FULL',
        status: 'active',
        createdAt: '2025-02-01T08:00:00Z',
      },
      // Shipment.Dispatched
      {
        id: 'schema-011',
        eventType: 'Shipment.Dispatched',
        version: 'v1',
        schema: mkSchema(['shipmentId', 'orderId', 'carrier']),
        compatibility: 'NONE',
        status: 'draft',
        createdAt: '2025-02-10T09:00:00Z',
      },
      // IoT.SensorReading
      {
        id: 'schema-012',
        eventType: 'IoT.SensorReading',
        version: 'v1',
        schema: mkSchema(['deviceId', 'sensorType', 'value', 'unit']),
        compatibility: 'BACKWARD',
        status: 'active',
        createdAt: '2025-03-01T00:00:00Z',
      },
    ];
  }

  private _seedReplayJobs(): ReplayJob[] {
    return [
      {
        id: 'replay-001',
        topicId: 'topic-001',
        tenantId: 'tenant-enterprise',
        workflowId: 'wf-orders',
        startTime: '2025-06-01T08:00:00Z',
        endTime: '2025-06-01T09:30:00Z',
        status: 'completed',
        eventsReplayed: 12450,
        totalEvents: 12450,
        createdAt: '2025-06-02T10:00:00Z',
        completedAt: '2025-06-02T10:48:00Z',
      },
      {
        id: 'replay-002',
        topicId: 'topic-003',
        tenantId: 'tenant-retail',
        workflowId: 'wf-stock',
        startTime: '2025-06-10T00:00:00Z',
        endTime: '2025-06-10T23:59:59Z',
        status: 'completed',
        eventsReplayed: 82300,
        totalEvents: 82300,
        createdAt: '2025-06-11T08:00:00Z',
        completedAt: '2025-06-11T09:22:00Z',
      },
      {
        id: 'replay-003',
        topicId: 'topic-002',
        tenantId: 'tenant-enterprise',
        startTime: '2025-07-01T00:00:00Z',
        endTime: '2025-07-10T23:59:59Z',
        status: 'running',
        eventsReplayed: 34200,
        totalEvents: 87400,
        createdAt: '2025-07-11T06:00:00Z',
      },
      {
        id: 'replay-004',
        topicId: 'topic-007',
        tenantId: 'tenant-logistics',
        startTime: '2025-07-05T00:00:00Z',
        endTime: '2025-07-07T23:59:59Z',
        status: 'queued',
        eventsReplayed: 0,
        totalEvents: 24100,
        createdAt: '2025-07-11T07:30:00Z',
      },
    ];
  }

  private _seedDLQ(): DLQEntry[] {
    return [
      {
        id: 'dlq-001',
        originalTopicId: 'topic-001',
        eventId: 'msg-err-001',
        eventType: 'Order.Created',
        payload: { orderId: 'ord-fail-001', customerId: 'cust-001', total: 0 },
        error: 'Workflow timeout after 30s',
        retries: 3,
        firstFailedAt: '2025-07-10T14:00:00Z',
        lastRetryAt: '2025-07-10T14:32:00Z',
        status: 'pending',
      },
      {
        id: 'dlq-002',
        originalTopicId: 'topic-002',
        eventId: 'msg-err-002',
        eventType: 'Invoice.Generated',
        payload: { invoiceId: 'inv-err-001', orderId: 'ord-001', nfeKey: 'INVALID' },
        error: 'NF-e key validation failed',
        retries: 5,
        firstFailedAt: '2025-07-09T11:00:00Z',
        lastRetryAt: '2025-07-10T09:00:00Z',
        status: 'pending',
      },
      {
        id: 'dlq-003',
        originalTopicId: 'topic-004',
        eventId: 'msg-err-003',
        eventType: 'Payment.Confirmed',
        payload: { paymentId: 'pay-err-001', orderId: 'ord-002', amount: -50 },
        error: 'Negative amount not allowed',
        retries: 2,
        firstFailedAt: '2025-07-11T08:00:00Z',
        lastRetryAt: '2025-07-11T08:10:00Z',
        status: 'pending',
      },
      {
        id: 'dlq-004',
        originalTopicId: 'topic-003',
        eventId: 'msg-err-004',
        eventType: 'Stock.Changed',
        payload: { sku: 'SKU-MISSING', delta: -100, newQty: -50 },
        error: 'Negative stock not permitted',
        retries: 7,
        firstFailedAt: '2025-07-08T16:00:00Z',
        lastRetryAt: '2025-07-10T16:00:00Z',
        status: 'pending',
      },
      {
        id: 'dlq-005',
        originalTopicId: 'topic-001',
        eventId: 'msg-err-005',
        eventType: 'Order.Created',
        payload: { orderId: 'ord-ok-now', customerId: 'cust-002', total: 120 },
        error: 'Schema validation error (v1)',
        retries: 1,
        firstFailedAt: '2025-07-05T10:00:00Z',
        lastRetryAt: '2025-07-05T10:05:00Z',
        status: 'resolved',
        resolvedAt: '2025-07-06T08:00:00Z',
      },
      {
        id: 'dlq-006',
        originalTopicId: 'topic-008',
        eventId: 'msg-err-006',
        eventType: 'IoT.SensorReading',
        payload: { deviceId: 'offline-01', sensorType: 'unknown', value: 9999 },
        error: 'Unknown sensor type',
        retries: 10,
        firstFailedAt: '2025-07-01T00:00:00Z',
        lastRetryAt: '2025-07-07T00:00:00Z',
        status: 'discarded',
      },
    ];
  }

  private _seedSecurityPolicies(): SecurityPolicy[] {
    return [
      {
        id: 'sec-pol-001',
        topicId: 'topic-001',
        name: 'Order.Created Security Policy',
        allowedProducers: ['order-service', 'marketplace-connector'],
        allowedConsumers: ['invoice-service', 'stock-service', 'workflow-engine', 'analytics'],
        encryptionEnabled: true,
        signatureRequired: true,
        createdAt: '2025-01-10T08:00:00Z',
      },
      {
        id: 'sec-pol-002',
        topicId: 'topic-002',
        name: 'Invoice.Generated Security Policy',
        allowedProducers: ['nfe-connector'],
        allowedConsumers: ['erp-service', 'accounting', 'analytics'],
        encryptionEnabled: true,
        signatureRequired: true,
        createdAt: '2025-01-10T08:05:00Z',
      },
      {
        id: 'sec-pol-003',
        topicId: 'topic-004',
        name: 'Payment.Confirmed Security Policy',
        allowedProducers: ['payment-gateway'],
        allowedConsumers: ['order-service', 'invoice-service', 'fraud-detection', 'analytics'],
        encryptionEnabled: true,
        signatureRequired: true,
        createdAt: '2025-01-15T10:00:00Z',
      },
      {
        id: 'sec-pol-004',
        topicId: 'topic-008',
        name: 'IoT.SensorReading Security Policy',
        allowedProducers: ['iot-gateway'],
        allowedConsumers: ['analytics', 'ai-engine', 'alerting'],
        encryptionEnabled: false,
        signatureRequired: false,
        createdAt: '2025-03-01T00:00:00Z',
      },
      {
        id: 'sec-pol-005',
        topicId: 'topic-003',
        name: 'Stock.Changed Security Policy',
        allowedProducers: ['wms-connector'],
        allowedConsumers: ['order-service', 'product-service', 'analytics'],
        encryptionEnabled: false,
        signatureRequired: true,
        createdAt: '2025-01-12T09:00:00Z',
      },
    ];
  }

  private _seedSecurityAudit(): SecurityAuditEntry[] {
    return [
      {
        id: 'sec-aud-001',
        topicId: 'topic-001',
        eventId: 'msg-001',
        action: 'publish',
        actor: 'order-service',
        result: 'allowed',
        timestamp: '2025-07-11T08:00:00Z',
      },
      {
        id: 'sec-aud-002',
        topicId: 'topic-001',
        eventId: 'msg-002',
        action: 'subscribe',
        actor: 'invoice-service',
        result: 'allowed',
        timestamp: '2025-07-11T08:01:00Z',
      },
      {
        id: 'sec-aud-003',
        topicId: 'topic-001',
        eventId: 'msg-003',
        action: 'publish',
        actor: 'rogue-service',
        result: 'denied',
        reason: 'Producer not in allowlist',
        timestamp: '2025-07-11T08:02:00Z',
      },
      {
        id: 'sec-aud-004',
        topicId: 'topic-004',
        eventId: 'msg-010',
        action: 'publish',
        actor: 'payment-gateway',
        result: 'allowed',
        timestamp: '2025-07-11T09:00:00Z',
      },
      {
        id: 'sec-aud-005',
        topicId: 'topic-004',
        eventId: 'msg-011',
        action: 'subscribe',
        actor: 'unknown-consumer',
        result: 'denied',
        reason: 'Consumer not in allowlist',
        timestamp: '2025-07-11T09:01:00Z',
      },
      {
        id: 'sec-aud-006',
        topicId: 'topic-002',
        eventId: 'msg-020',
        action: 'replay',
        actor: 'admin-replay-job',
        result: 'allowed',
        timestamp: '2025-07-11T10:00:00Z',
      },
      {
        id: 'sec-aud-007',
        topicId: 'topic-003',
        eventId: 'msg-030',
        action: 'publish',
        actor: 'wms-connector',
        result: 'allowed',
        timestamp: '2025-07-11T10:30:00Z',
      },
      {
        id: 'sec-aud-008',
        topicId: 'topic-008',
        eventId: 'msg-040',
        action: 'subscribe',
        actor: 'ai-engine',
        result: 'allowed',
        timestamp: '2025-07-11T11:00:00Z',
      },
      {
        id: 'sec-aud-009',
        topicId: 'topic-001',
        eventId: 'msg-050',
        action: 'subscribe',
        actor: 'legacy-consumer-v1',
        result: 'denied',
        reason: 'Consumer not in allowlist',
        timestamp: '2025-07-11T11:30:00Z',
      },
      {
        id: 'sec-aud-010',
        topicId: 'topic-004',
        eventId: 'msg-060',
        action: 'publish',
        actor: 'payment-gateway',
        result: 'allowed',
        timestamp: '2025-07-11T12:00:00Z',
      },
    ];
  }

  private _seedGovernancePolicies(): GovernancePolicy[] {
    return [
      {
        id: 'gov-001',
        eventType: 'Order.Created',
        owner: 'commerce-team@company.com',
        team: 'Commerce',
        classification: 'internal',
        criticality: 'critical',
        retentionDays: 30,
        archiveAfterDays: 365,
        complianceFrameworks: ['SOX', 'PCI-DSS'],
        createdAt: '2025-01-10T08:00:00Z',
      },
      {
        id: 'gov-002',
        eventType: 'Invoice.Generated',
        owner: 'fiscal-team@company.com',
        team: 'Fiscal',
        classification: 'confidential',
        criticality: 'critical',
        retentionDays: 90,
        archiveAfterDays: 1825,
        complianceFrameworks: ['SOX', 'LGPD', 'NFe-SEFAZ'],
        createdAt: '2025-01-10T08:05:00Z',
      },
      {
        id: 'gov-003',
        eventType: 'Stock.Changed',
        owner: 'logistics-team@company.com',
        team: 'Logistics',
        classification: 'internal',
        criticality: 'high',
        retentionDays: 14,
        archiveAfterDays: 180,
        complianceFrameworks: ['ISO-28000'],
        createdAt: '2025-01-12T09:00:00Z',
      },
      {
        id: 'gov-004',
        eventType: 'Payment.Confirmed',
        owner: 'finance-team@company.com',
        team: 'Finance',
        classification: 'restricted',
        criticality: 'critical',
        retentionDays: 365,
        archiveAfterDays: 2555,
        complianceFrameworks: ['PCI-DSS', 'SOX', 'BACEN'],
        createdAt: '2025-01-15T10:00:00Z',
      },
      {
        id: 'gov-005',
        eventType: 'Customer.Updated',
        owner: 'dpo@company.com',
        team: 'DPO',
        classification: 'confidential',
        criticality: 'medium',
        retentionDays: 60,
        archiveAfterDays: 730,
        complianceFrameworks: ['LGPD', 'GDPR'],
        createdAt: '2025-01-20T11:00:00Z',
      },
      {
        id: 'gov-006',
        eventType: 'Product.Created',
        owner: 'catalog-team@company.com',
        team: 'Catalog',
        classification: 'public',
        criticality: 'low',
        retentionDays: 30,
        archiveAfterDays: 365,
        complianceFrameworks: [],
        createdAt: '2025-02-01T08:00:00Z',
      },
      {
        id: 'gov-007',
        eventType: 'Shipment.Dispatched',
        owner: 'logistics-team@company.com',
        team: 'Logistics',
        classification: 'internal',
        criticality: 'high',
        retentionDays: 45,
        archiveAfterDays: 365,
        complianceFrameworks: ['ANTT', 'ISO-28000'],
        createdAt: '2025-02-10T09:00:00Z',
      },
      {
        id: 'gov-008',
        eventType: 'IoT.SensorReading',
        owner: 'iot-team@company.com',
        team: 'IoT',
        classification: 'internal',
        criticality: 'medium',
        retentionDays: 7,
        archiveAfterDays: 90,
        complianceFrameworks: ['ISO-27001'],
        createdAt: '2025-03-01T00:00:00Z',
      },
    ];
  }

  private _seedAIInsights(): AIInsight[] {
    return [
      {
        id: 'insight-001',
        type: 'bottleneck',
        topicId: 'topic-008',
        eventType: 'IoT.SensorReading',
        description:
          'Consumer lag on IoT.SensorReading exceeds 12,000 messages — partition count may be insufficient for peak load',
        confidence: 96,
        recommendation: 'Increase partitions from 12 to 24 and add 4 more consumer instances',
        detectedAt: '2025-07-11T06:00:00Z',
      },
      {
        id: 'insight-002',
        type: 'bottleneck',
        topicId: 'topic-001',
        eventType: 'Order.Created',
        description:
          'Order.Created processing latency spikes to 340ms consumer lag during 18:00–20:00 window',
        confidence: 88,
        recommendation: 'Add dedicated consumer group for invoice-service during peak hours',
        detectedAt: '2025-07-10T20:00:00Z',
      },
      {
        id: 'insight-003',
        type: 'redundancy',
        eventType: 'Stock.Changed',
        description:
          'Stock.Changed and Product.Created events share 80% of payload fields — may be consolidated into Catalog.Updated',
        confidence: 74,
        recommendation:
          'Evaluate merging into a single Catalog.Updated event; coordinate with catalog and logistics teams',
        detectedAt: '2025-07-09T12:00:00Z',
      },
      {
        id: 'insight-004',
        type: 'growth_prediction',
        topicId: 'topic-008',
        eventType: 'IoT.SensorReading',
        description:
          'IoT traffic projected to reach 3,200 EPS in 30 days based on device onboarding rate (+12 devices/week)',
        confidence: 91,
        recommendation:
          'Pre-provision 8 additional consumer instances and upgrade broker disk capacity by 2TB',
        detectedAt: '2025-07-11T07:00:00Z',
      },
      {
        id: 'insight-005',
        type: 'consolidation',
        eventType: 'Customer.Updated',
        description:
          '67% of Customer.Updated events contain only email field changes — suggest dedicated Customer.EmailUpdated event for better routing',
        confidence: 82,
        recommendation:
          'Create Customer.EmailUpdated as a specialized event type for email changes to reduce consumer noise',
        detectedAt: '2025-07-08T14:00:00Z',
      },
      {
        id: 'insight-006',
        type: 'new_consumer',
        topicId: 'topic-002',
        eventType: 'Invoice.Generated',
        description:
          'AI detects accounting-service reads Order.Created to correlate invoices but does not consume Invoice.Generated directly',
        confidence: 78,
        recommendation:
          'Register accounting-service as a consumer of Invoice.Generated to eliminate the join overhead',
        detectedAt: '2025-07-07T10:00:00Z',
      },
    ];
  }

  private _seedForecasts(): TrafficForecast[] {
    return [
      {
        topicId: 'topic-001',
        topicName: 'Order.Created',
        currentEps: 42,
        forecast7d: 46,
        forecast30d: 58,
        forecast90d: 80,
        trend: 'growing',
      },
      {
        topicId: 'topic-002',
        topicName: 'Invoice.Generated',
        currentEps: 18,
        forecast7d: 19,
        forecast30d: 22,
        forecast90d: 28,
        trend: 'growing',
      },
      {
        topicId: 'topic-003',
        topicName: 'Stock.Changed',
        currentEps: 95,
        forecast7d: 98,
        forecast30d: 105,
        forecast90d: 115,
        trend: 'stable',
      },
      {
        topicId: 'topic-004',
        topicName: 'Payment.Confirmed',
        currentEps: 8,
        forecast7d: 9,
        forecast30d: 11,
        forecast90d: 15,
        trend: 'growing',
      },
      {
        topicId: 'topic-005',
        topicName: 'Customer.Updated',
        currentEps: 0,
        forecast7d: 0,
        forecast30d: 0,
        forecast90d: 5,
        trend: 'declining',
      },
      {
        topicId: 'topic-006',
        topicName: 'Product.Created',
        currentEps: 3,
        forecast7d: 3,
        forecast30d: 4,
        forecast90d: 4,
        trend: 'stable',
      },
      {
        topicId: 'topic-007',
        topicName: 'Shipment.Dispatched',
        currentEps: 12,
        forecast7d: 13,
        forecast30d: 15,
        forecast90d: 18,
        trend: 'growing',
      },
      {
        topicId: 'topic-008',
        topicName: 'IoT.SensorReading',
        currentEps: 1650,
        forecast7d: 1900,
        forecast30d: 2800,
        forecast90d: 4200,
        trend: 'growing',
      },
    ];
  }

  private _seedTwinNodes(): TwinNode[] {
    return [
      {
        id: 'node-erp',
        name: 'ERP Connector',
        type: 'erp',
        status: 'active',
        lastEventAt: '2025-07-11T12:00:00Z',
        eventsLast24h: 48200,
      },
      {
        id: 'node-wf-order',
        name: 'Order Fulfillment Workflow',
        type: 'workflow',
        status: 'active',
        lastEventAt: '2025-07-11T12:00:00Z',
        eventsLast24h: 48200,
      },
      {
        id: 'node-nfe',
        name: 'NF-e Integration',
        type: 'connector',
        status: 'active',
        lastEventAt: '2025-07-11T11:58:00Z',
        eventsLast24h: 21800,
      },
      {
        id: 'node-wms',
        name: 'Warehouse Management',
        type: 'wms',
        status: 'active',
        lastEventAt: '2025-07-11T11:59:00Z',
        eventsLast24h: 102300,
      },
      {
        id: 'node-tms',
        name: 'Transport Management',
        type: 'tms',
        status: 'idle',
        lastEventAt: '2025-07-11T11:30:00Z',
        eventsLast24h: 7890,
      },
      {
        id: 'node-ai',
        name: 'AI Processing Engine',
        type: 'ai_engine',
        status: 'active',
        lastEventAt: '2025-07-11T12:00:00Z',
        eventsLast24h: 12000,
      },
      {
        id: 'node-analytics',
        name: 'Analytics Engine',
        type: 'analytics',
        status: 'active',
        lastEventAt: '2025-07-11T12:00:00Z',
        eventsLast24h: 220000,
      },
      {
        id: 'node-customer',
        name: 'End Customer',
        type: 'customer',
        status: 'idle',
        lastEventAt: '2025-07-11T11:45:00Z',
        eventsLast24h: 7890,
      },
    ];
  }

  private _seedTwinEdges(): TwinEdge[] {
    return [
      {
        from: 'node-erp',
        to: 'node-wf-order',
        eventType: 'Order.Created',
        latencyMs: 12,
        eventsLast24h: 48200,
      },
      {
        from: 'node-wf-order',
        to: 'node-nfe',
        eventType: 'Invoice.Generated',
        latencyMs: 8,
        eventsLast24h: 21800,
      },
      {
        from: 'node-wf-order',
        to: 'node-wms',
        eventType: 'Stock.Changed',
        latencyMs: 5,
        eventsLast24h: 48200,
      },
      {
        from: 'node-wms',
        to: 'node-tms',
        eventType: 'Shipment.Dispatched',
        latencyMs: 6,
        eventsLast24h: 7890,
      },
      {
        from: 'node-tms',
        to: 'node-customer',
        eventType: 'Shipment.Dispatched',
        latencyMs: 4,
        eventsLast24h: 7890,
      },
      {
        from: 'node-wf-order',
        to: 'node-analytics',
        eventType: 'Order.Created',
        latencyMs: 3,
        eventsLast24h: 48200,
      },
      {
        from: 'node-nfe',
        to: 'node-analytics',
        eventType: 'Invoice.Generated',
        latencyMs: 3,
        eventsLast24h: 21800,
      },
      {
        from: 'node-wms',
        to: 'node-analytics',
        eventType: 'Stock.Changed',
        latencyMs: 3,
        eventsLast24h: 102300,
      },
      {
        from: 'node-wf-order',
        to: 'node-ai',
        eventType: 'Order.Created',
        latencyMs: 15,
        eventsLast24h: 12000,
      },
      {
        from: 'node-ai',
        to: 'node-analytics',
        eventType: 'Order.Created',
        latencyMs: 4,
        eventsLast24h: 12000,
      },
    ];
  }

  private _seedTwinFlows(): Map<string, TwinFlow> {
    const map = new Map<string, TwinFlow>();
    map.set('order-001', {
      orderId: 'order-001',
      status: 'completed',
      startedAt: '2025-07-11T09:00:00Z',
      completedAt: '2025-07-11T09:04:32Z',
      steps: [
        {
          nodeId: 'node-erp',
          nodeName: 'ERP Connector',
          eventType: 'Order.Created',
          timestamp: '2025-07-11T09:00:00Z',
          status: 'completed',
          durationMs: 12,
        },
        {
          nodeId: 'node-wf-order',
          nodeName: 'Order Fulfillment Workflow',
          eventType: 'Order.Created',
          timestamp: '2025-07-11T09:00:01Z',
          status: 'completed',
          durationMs: 240,
        },
        {
          nodeId: 'node-nfe',
          nodeName: 'NF-e Integration',
          eventType: 'Invoice.Generated',
          timestamp: '2025-07-11T09:00:08Z',
          status: 'completed',
          durationMs: 1800,
        },
        {
          nodeId: 'node-wms',
          nodeName: 'Warehouse Management',
          eventType: 'Stock.Changed',
          timestamp: '2025-07-11T09:00:13Z',
          status: 'completed',
          durationMs: 85,
        },
        {
          nodeId: 'node-tms',
          nodeName: 'Transport Management',
          eventType: 'Shipment.Dispatched',
          timestamp: '2025-07-11T09:03:00Z',
          status: 'completed',
          durationMs: 92000,
        },
        {
          nodeId: 'node-customer',
          nodeName: 'End Customer',
          eventType: 'Shipment.Dispatched',
          timestamp: '2025-07-11T09:04:32Z',
          status: 'completed',
          durationMs: 0,
        },
      ],
    });
    map.set('order-002', {
      orderId: 'order-002',
      status: 'in_progress',
      startedAt: '2025-07-11T11:55:00Z',
      steps: [
        {
          nodeId: 'node-erp',
          nodeName: 'ERP Connector',
          eventType: 'Order.Created',
          timestamp: '2025-07-11T11:55:00Z',
          status: 'completed',
          durationMs: 11,
        },
        {
          nodeId: 'node-wf-order',
          nodeName: 'Order Fulfillment Workflow',
          eventType: 'Order.Created',
          timestamp: '2025-07-11T11:55:01Z',
          status: 'completed',
          durationMs: 220,
        },
        {
          nodeId: 'node-nfe',
          nodeName: 'NF-e Integration',
          eventType: 'Invoice.Generated',
          timestamp: '2025-07-11T11:55:08Z',
          status: 'pending',
          durationMs: 0,
        },
        {
          nodeId: 'node-wms',
          nodeName: 'Warehouse Management',
          eventType: 'Stock.Changed',
          timestamp: '',
          status: 'pending',
          durationMs: 0,
        },
      ],
    });
    return map;
  }

  private _seedMarketplace(): MarketplaceEvent[] {
    return [
      {
        id: 'mkt-001',
        eventType: 'Order.Created',
        description: 'Reusable commerce order creation event',
        producer: 'order-service',
        category: 'commerce',
        subscriberCount: 12,
        version: 'v2',
        tags: ['order', 'commerce', 'ecommerce'],
        lastPublished: '2025-07-11T06:00:00Z',
      },
      {
        id: 'mkt-002',
        eventType: 'Invoice.Generated',
        description: 'NF-e fiscal invoice generated',
        producer: 'nfe-connector',
        category: 'fiscal',
        subscriberCount: 8,
        version: 'v1',
        tags: ['invoice', 'fiscal', 'nfe', 'brazil'],
        lastPublished: '2025-07-10T12:00:00Z',
      },
      {
        id: 'mkt-003',
        eventType: 'Stock.Low',
        description: 'Inventory below reorder point threshold',
        producer: 'wms-connector',
        category: 'logistics',
        subscriberCount: 6,
        version: 'v1',
        tags: ['stock', 'inventory', 'alert'],
        lastPublished: '2025-07-09T15:00:00Z',
      },
      {
        id: 'mkt-004',
        eventType: 'Payment.Confirmed',
        description: 'Payment authorized and captured',
        producer: 'payment-gateway',
        category: 'finance',
        subscriberCount: 14,
        version: 'v2',
        tags: ['payment', 'finance', 'pci'],
        lastPublished: '2025-07-11T07:00:00Z',
      },
      {
        id: 'mkt-005',
        eventType: 'Customer.Created',
        description: 'New customer registered in CRM',
        producer: 'crm-connector',
        category: 'crm',
        subscriberCount: 9,
        version: 'v1',
        tags: ['customer', 'crm', 'onboarding'],
        lastPublished: '2025-07-08T09:00:00Z',
      },
      {
        id: 'mkt-006',
        eventType: 'Shipment.Dispatched',
        description: 'Package dispatched by carrier',
        producer: 'tms-connector',
        category: 'logistics',
        subscriberCount: 5,
        version: 'v1',
        tags: ['shipment', 'logistics', 'tracking'],
        lastPublished: '2025-07-10T16:00:00Z',
      },
      {
        id: 'mkt-007',
        eventType: 'Product.Updated',
        description: 'Product catalog entry modified',
        producer: 'product-service',
        category: 'catalog',
        subscriberCount: 7,
        version: 'v1',
        tags: ['product', 'catalog', 'ecommerce'],
        lastPublished: '2025-07-07T11:00:00Z',
      },
      {
        id: 'mkt-008',
        eventType: 'Fraud.Detected',
        description: 'Real-time fraud signal from AI engine',
        producer: 'fraud-ai-engine',
        category: 'security',
        subscriberCount: 3,
        version: 'v1',
        tags: ['fraud', 'security', 'ai', 'pci'],
        lastPublished: '2025-07-11T10:00:00Z',
      },
    ];
  }

  private _seedBridges(): ExternalBridge[] {
    return [
      {
        id: 'bridge-001',
        name: 'Apache Kafka Bridge',
        platform: 'kafka',
        direction: 'bidirectional',
        status: 'connected',
        topicsLinked: ['topic-001', 'topic-003', 'topic-008'],
        eventsTransferred: 4_200_000,
        createdAt: '2025-02-01T00:00:00Z',
        lastConnectedAt: '2025-07-11T12:00:00Z',
      },
      {
        id: 'bridge-002',
        name: 'RabbitMQ Bridge',
        platform: 'rabbitmq',
        direction: 'bidirectional',
        status: 'connected',
        topicsLinked: ['topic-002', 'topic-004'],
        eventsTransferred: 890000,
        createdAt: '2025-02-15T00:00:00Z',
        lastConnectedAt: '2025-07-11T11:59:00Z',
      },
      {
        id: 'bridge-003',
        name: 'MQTT IoT Bridge',
        platform: 'mqtt',
        direction: 'inbound',
        status: 'connected',
        topicsLinked: ['topic-008'],
        eventsTransferred: 84_000_000,
        createdAt: '2025-03-01T00:00:00Z',
        lastConnectedAt: '2025-07-11T12:00:00Z',
      },
      {
        id: 'bridge-004',
        name: 'NATS Bridge',
        platform: 'nats',
        direction: 'bidirectional',
        status: 'disconnected',
        topicsLinked: ['topic-005', 'topic-006'],
        eventsTransferred: 210000,
        createdAt: '2025-04-01T00:00:00Z',
      },
      {
        id: 'bridge-005',
        name: 'Azure Event Hubs Bridge',
        platform: 'azure_event_hubs',
        direction: 'outbound',
        status: 'connected',
        topicsLinked: ['topic-001', 'topic-004'],
        eventsTransferred: 1_100_000,
        createdAt: '2025-03-15T00:00:00Z',
        lastConnectedAt: '2025-07-11T11:55:00Z',
      },
      {
        id: 'bridge-006',
        name: 'Google Pub/Sub Bridge',
        platform: 'google_pubsub',
        direction: 'bidirectional',
        status: 'connected',
        topicsLinked: ['topic-001', 'topic-002'],
        eventsTransferred: 650000,
        createdAt: '2025-04-10T00:00:00Z',
        lastConnectedAt: '2025-07-11T11:58:00Z',
      },
      {
        id: 'bridge-007',
        name: 'Amazon EventBridge',
        platform: 'aws_eventbridge',
        direction: 'outbound',
        status: 'connected',
        topicsLinked: ['topic-004', 'topic-007'],
        eventsTransferred: 420000,
        createdAt: '2025-05-01T00:00:00Z',
        lastConnectedAt: '2025-07-11T12:00:00Z',
      },
      {
        id: 'bridge-008',
        name: 'Apache Pulsar Bridge',
        platform: 'pulsar',
        direction: 'bidirectional',
        status: 'error',
        topicsLinked: ['topic-003', 'topic-008'],
        eventsTransferred: 320000,
        errorMessage: 'TLS certificate expired — broker rejecting connections',
        createdAt: '2025-05-20T00:00:00Z',
        lastConnectedAt: '2025-07-09T14:00:00Z',
      },
    ];
  }
}

export const heliosStore = HeliosStore.getInstance();
