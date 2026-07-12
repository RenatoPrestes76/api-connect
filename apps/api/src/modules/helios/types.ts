// ─── Event Bus ───────────────────────────────────────────────────────────────

export type TopicStatus = 'active' | 'paused' | 'archived';
export type MessageStatus = 'delivered' | 'pending' | 'failed';

export interface Topic {
  id: string;
  name: string;
  description: string;
  eventType: string;
  partitions: number;
  replication: number;
  retentionDays: number;
  tenantId: string;
  status: TopicStatus;
  messagesTotal: number;
  currentEps: number;
  createdAt: string;
}

export interface EventMessage {
  id: string;
  topicId: string;
  tenantId: string;
  producer: string;
  eventType: string;
  version: string;
  payload: Record<string, unknown>;
  signature: string;
  timestamp: string;
  status: MessageStatus;
}

// ─── Event Mesh ──────────────────────────────────────────────────────────────

export type ClusterStatus = 'healthy' | 'degraded' | 'offline';

export interface MeshCluster {
  id: string;
  name: string;
  region: string;
  status: ClusterStatus;
  topicsReplicated: number;
  latencyMs: number;
  eventsLast24h: number;
}

// ─── Streaming Analytics ─────────────────────────────────────────────────────

export interface StreamMetrics {
  eventsPerSecond: number;
  throughputMbps: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  activeConsumers: number;
  activeTopics: number;
  totalEventsToday: number;
}

export interface TopicMetric {
  topicId: string;
  name: string;
  eventsPerSecond: number;
  errorRate: number;
  consumerLag: number;
  avgLatencyMs: number;
}

// ─── Event Catalog ───────────────────────────────────────────────────────────

export type EventClassification = 'public' | 'internal' | 'confidential' | 'restricted';
export type EventCriticality = 'low' | 'medium' | 'high' | 'critical';

export interface CatalogChangelogEntry {
  version: string;
  date: string;
  changes: string;
  author: string;
}

export interface CatalogEntry {
  id: string;
  eventType: string;
  description: string;
  currentVersion: string;
  producer: string;
  consumers: string[];
  schema: Record<string, unknown>;
  examplePayload: Record<string, unknown>;
  classification: EventClassification;
  criticality: EventCriticality;
  retentionDays: number;
  changelog: CatalogChangelogEntry[];
  createdAt: string;
  updatedAt: string;
}

// ─── Schema Registry ─────────────────────────────────────────────────────────

export type SchemaCompatibility = 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE';
export type SchemaStatus = 'active' | 'deprecated' | 'draft';

export interface SchemaVersion {
  id: string;
  eventType: string;
  version: string;
  schema: Record<string, unknown>;
  compatibility: SchemaCompatibility;
  status: SchemaStatus;
  createdAt: string;
  deprecatedAt?: string;
}

// ─── Event Replay ─────────────────────────────────────────────────────────────

export type ReplayStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ReplayJob {
  id: string;
  topicId: string;
  tenantId: string;
  workflowId?: string;
  startTime: string;
  endTime: string;
  status: ReplayStatus;
  eventsReplayed: number;
  totalEvents: number;
  createdAt: string;
  completedAt?: string;
}

// ─── Dead Letter Queue ────────────────────────────────────────────────────────

export type DLQStatus = 'pending' | 'resolved' | 'discarded';

export interface DLQEntry {
  id: string;
  originalTopicId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  error: string;
  retries: number;
  firstFailedAt: string;
  lastRetryAt: string;
  status: DLQStatus;
  resolvedAt?: string;
}

// ─── Event Security ───────────────────────────────────────────────────────────

export interface SecurityPolicy {
  id: string;
  topicId: string;
  name: string;
  allowedProducers: string[];
  allowedConsumers: string[];
  encryptionEnabled: boolean;
  signatureRequired: boolean;
  createdAt: string;
}

export interface SecurityAuditEntry {
  id: string;
  topicId: string;
  eventId: string;
  action: 'publish' | 'subscribe' | 'replay';
  actor: string;
  result: 'allowed' | 'denied';
  reason?: string;
  timestamp: string;
}

// ─── Event Governance ────────────────────────────────────────────────────────

export interface GovernancePolicy {
  id: string;
  eventType: string;
  owner: string;
  team: string;
  classification: EventClassification;
  criticality: EventCriticality;
  retentionDays: number;
  archiveAfterDays: number;
  complianceFrameworks: string[];
  createdAt: string;
}

// ─── Event AI ────────────────────────────────────────────────────────────────

export type AIInsightType =
  | 'bottleneck'
  | 'redundancy'
  | 'growth_prediction'
  | 'consolidation'
  | 'new_consumer';

export interface AIInsight {
  id: string;
  type: AIInsightType;
  eventType?: string;
  topicId?: string;
  description: string;
  confidence: number;
  recommendation: string;
  detectedAt: string;
}

export interface TrafficForecast {
  topicId: string;
  topicName: string;
  currentEps: number;
  forecast7d: number;
  forecast30d: number;
  forecast90d: number;
  trend: 'growing' | 'stable' | 'declining';
}

// ─── Digital Twin ─────────────────────────────────────────────────────────────

export type TwinNodeType =
  | 'erp'
  | 'workflow'
  | 'connector'
  | 'ai_engine'
  | 'analytics'
  | 'external'
  | 'customer'
  | 'wms'
  | 'tms';

export interface TwinNode {
  id: string;
  name: string;
  type: TwinNodeType;
  status: 'active' | 'idle' | 'error';
  lastEventAt: string;
  eventsLast24h: number;
}

export interface TwinEdge {
  from: string;
  to: string;
  eventType: string;
  latencyMs: number;
  eventsLast24h: number;
}

export interface TwinFlowStep {
  nodeId: string;
  nodeName: string;
  eventType: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
  durationMs: number;
}

export interface TwinFlow {
  orderId: string;
  status: 'in_progress' | 'completed' | 'failed';
  steps: TwinFlowStep[];
  startedAt: string;
  completedAt?: string;
}

// ─── Event Marketplace ────────────────────────────────────────────────────────

export interface MarketplaceEvent {
  id: string;
  eventType: string;
  description: string;
  producer: string;
  category: string;
  subscriberCount: number;
  version: string;
  tags: string[];
  lastPublished: string;
}

// ─── External Gateway ────────────────────────────────────────────────────────

export type ExternalPlatform =
  | 'kafka'
  | 'rabbitmq'
  | 'mqtt'
  | 'nats'
  | 'azure_event_hubs'
  | 'google_pubsub'
  | 'aws_eventbridge'
  | 'pulsar';
export type BridgeDirection = 'inbound' | 'outbound' | 'bidirectional';
export type BridgeStatus = 'connected' | 'disconnected' | 'error';

export interface ExternalBridge {
  id: string;
  name: string;
  platform: ExternalPlatform;
  direction: BridgeDirection;
  status: BridgeStatus;
  topicsLinked: string[];
  eventsTransferred: number;
  errorMessage?: string;
  createdAt: string;
  lastConnectedAt?: string;
}
