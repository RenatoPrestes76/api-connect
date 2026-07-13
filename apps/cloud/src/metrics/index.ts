/**
 * @seltriva/cloud — metrics
 * Metrics collection, aggregation, and time-series querying.
 */

import type { OrganizationId, AgentId, MetricSnapshotId, DomainResult } from '../domain/index';

export interface IMetricsService {
  record(snapshot: MetricSnapshotInput): Promise<void>;
  recordBatch(snapshots: MetricSnapshotInput[]): Promise<void>;
  query(filter: MetricQueryFilter): Promise<MetricQueryResult>;
  getSummary(orgId: OrganizationId, window: MetricWindow): Promise<OrgMetricSummary>;
  getAgentMetrics(agentId: AgentId, window: MetricWindow): Promise<AgentMetricSummary>;
  prune(olderThan: Date): Promise<number>;
}

export interface MetricSnapshotInput {
  readonly organizationId?: OrganizationId;
  readonly agentId?: AgentId;
  readonly name: string;
  readonly value: number;
  readonly labels?: Record<string, string>;
  readonly recordedAt?: Date;
}

export interface MetricSnapshot {
  readonly id: MetricSnapshotId;
  readonly organizationId?: OrganizationId;
  readonly agentId?: AgentId;
  readonly name: string;
  readonly value: number;
  readonly labels?: Record<string, string>;
  readonly recordedAt: Date;
}

export interface MetricQueryFilter {
  readonly organizationId?: OrganizationId;
  readonly agentId?: AgentId;
  readonly name?: string;
  readonly names?: string[];
  readonly since: Date;
  readonly until?: Date;
  readonly aggregation?: MetricAggregation;
  readonly bucketMs?: number;
  readonly limit?: number;
}

export type MetricAggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p50' | 'p95' | 'p99';

export interface MetricQueryResult {
  readonly name: string;
  readonly aggregation: MetricAggregation;
  readonly points: MetricDataPoint[];
  readonly totalPoints: number;
}

export interface MetricDataPoint {
  readonly timestamp: Date;
  readonly value: number;
  readonly labels?: Record<string, string>;
}

export type MetricWindow = '1h' | '6h' | '24h' | '7d' | '30d';

export interface OrgMetricSummary {
  readonly organizationId: OrganizationId;
  readonly window: MetricWindow;
  readonly agentCount: number;
  readonly onlineAgentCount: number;
  readonly avgCpuPercent: number;
  readonly avgMemPercent: number;
  readonly jobsProcessed: number;
  readonly jobsSucceeded: number;
  readonly jobsFailed: number;
  readonly syncOperations: number;
  readonly syncErrors: number;
}

export interface AgentMetricSummary {
  readonly agentId: AgentId;
  readonly window: MetricWindow;
  readonly avgCpuPercent: number;
  readonly maxCpuPercent: number;
  readonly avgMemPercent: number;
  readonly maxMemPercent: number;
  readonly diskPercent: number;
  readonly heartbeatCount: number;
  readonly missedHeartbeats: number;
  readonly syncCount: number;
  readonly errorCount: number;
  readonly uptimePercent: number;
}

export const METRIC_NAMES = {
  AGENT_CPU_PCT: 'agent.cpu.percent',
  AGENT_MEM_PCT: 'agent.memory.percent',
  AGENT_DISK_PCT: 'agent.disk.percent',
  AGENT_LATENCY_MS: 'agent.latency.ms',
  AGENT_SYNC_DURATION: 'agent.sync.duration_ms',
  AGENT_SYNC_ERRORS: 'agent.sync.errors',
  API_REQUESTS: 'api.requests.total',
  API_LATENCY_MS: 'api.latency.ms',
  API_ERRORS: 'api.errors.total',
  JOB_DURATION_MS: 'job.duration_ms',
  JOB_QUEUE_DEPTH: 'job.queue.depth',
} as const;
