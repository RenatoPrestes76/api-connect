/**
 * @seltriva/ai-core/performance
 * AI Performance Monitor — metrics, profiling, and optimization recommendations
 *
 * Two responsibilities:
 *   1. Monitor ATHENA's own performance (latency, token usage, costs)
 *   2. Analyze integration performance and recommend improvements
 *      via the PerformanceAnalystAgent
 *
 * ATHENA never modifies runtime behavior — it only recommends.
 */

import type { AIResult, AgentId, AITaskType, AIProviderId } from '../providers/index';

// ─── ATHENA Performance Monitor ───────────────────────────────────────────

export interface ATHENAPerformanceMonitor {
  /**
   * Record metrics for an agent invocation
   */
  record(metrics: AgentInvocationMetrics): void;

  /**
   * Get aggregated metrics for a time period
   */
  getMetrics(filter?: MetricsFilter): MetricsReport;

  /**
   * Get metrics for a specific agent
   */
  getAgentMetrics(agentId: AgentId, period?: DateRange): AgentMetricsSummary;

  /**
   * Get cost report across providers
   */
  getCostReport(period?: DateRange): CostReport;

  /**
   * Detect performance degradation
   */
  detectDegradation(): PerformanceDegradation[];

  /**
   * Get SLO compliance status
   */
  getSLOStatus(): SLOStatus;
}

// ─── Agent Invocation Metrics ─────────────────────────────────────────────

export interface AgentInvocationMetrics {
  readonly agentId: AgentId;
  readonly taskType: AITaskType;
  readonly providerId: AIProviderId;
  readonly sessionId?: string;
  readonly success: boolean;

  readonly durationMs: number;
  readonly waitTimeMs: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly cachedTokens?: number;

  readonly recommendationCount: number;
  readonly averageConfidence: number;
  readonly autoApprovedCount: number;

  readonly retryCount: number;
  readonly errorCode?: string;

  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

// ─── Metrics Filter ───────────────────────────────────────────────────────

export interface MetricsFilter {
  readonly agentIds?: AgentId[];
  readonly taskTypes?: AITaskType[];
  readonly providerIds?: AIProviderId[];
  readonly successOnly?: boolean;
  readonly period?: DateRange;
  readonly granularity?: 'minute' | 'hour' | 'day';
}

// ─── Metrics Report ───────────────────────────────────────────────────────

export interface MetricsReport {
  readonly period?: DateRange;
  readonly totalInvocations: number;
  readonly successfulInvocations: number;
  readonly failedInvocations: number;
  readonly successRate: number;
  readonly averageDurationMs: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
  readonly p99DurationMs: number;
  readonly totalTokensUsed: number;
  readonly totalEstimatedCostUsd: number;
  readonly averageConfidence: number;
  readonly byAgent: Partial<Record<string, AgentMetricsSummary>>;
  readonly byProvider: Partial<Record<string, ProviderMetricsSummary>>;
}

export interface AgentMetricsSummary {
  readonly agentId: AgentId;
  readonly invocationCount: number;
  readonly successRate: number;
  readonly avgDurationMs: number;
  readonly avgTokensPerInvocation: number;
  readonly avgConfidence: number;
  readonly totalCostUsd: number;
  readonly trend: 'improving' | 'stable' | 'degrading';
}

export interface ProviderMetricsSummary {
  readonly providerId: AIProviderId;
  readonly invocationCount: number;
  readonly successRate: number;
  readonly avgDurationMs: number;
  readonly totalTokensUsed: number;
  readonly totalCostUsd: number;
  readonly rateLimitHits: number;
}

// ─── Cost Report ──────────────────────────────────────────────────────────

export interface CostReport {
  readonly period?: DateRange;
  readonly totalCostUsd: number;
  readonly byProvider: Partial<Record<string, number>>;
  readonly byAgent: Partial<Record<string, number>>;
  readonly byTaskType: Partial<Record<AITaskType, number>>;
  readonly projectedMonthlyUsd: number;
  readonly topCostDrivers: Array<{ description: string; costUsd: number; percentage: number }>;
}

// ─── SLO ──────────────────────────────────────────────────────────────────

export interface SLOStatus {
  readonly overallCompliant: boolean;
  readonly objectives: SLOObjectiveStatus[];
  readonly lastEvaluatedAt: Date;
}

export interface SLOObjectiveStatus {
  readonly name: string;
  readonly target: number;
  readonly current: number;
  readonly isCompliant: boolean;
  readonly unit: string;
}

export const DEFAULT_SLOS = {
  AGENT_P95_LATENCY_MS:     15000,
  AGENT_SUCCESS_RATE:       0.98,
  AUTO_APPROVAL_RATE:       0.70,
  AVG_CONFIDENCE:           0.80,
} as const;

// ─── Performance Degradation ──────────────────────────────────────────────

export interface PerformanceDegradation {
  readonly agentId?: AgentId;
  readonly metric: string;
  readonly currentValue: number;
  readonly baselineValue: number;
  readonly degradationPercent: number;
  readonly severity: 'critical' | 'high' | 'medium';
  readonly detectedAt: Date;
}

// ─── Integration Performance Analyst ─────────────────────────────────────

/**
 * AI-powered integration performance analysis.
 * Used by PerformanceAnalystAgent.
 */
export interface IntegrationPerformanceAnalyst {
  /**
   * Analyze sync execution telemetry and produce optimization recommendations
   */
  analyzeSync(input: SyncPerformanceInput): Promise<AIResult<SyncPerformanceAnalysis>>;

  /**
   * Detect bottlenecks in a sync configuration
   */
  detectBottlenecks(input: SyncPerformanceInput): Promise<AIResult<Bottleneck[]>>;

  /**
   * Recommend optimal batch size for a given entity
   */
  recommendBatchSize(entityKind: string, recordCount: number, avgRecordSizeBytes: number): number;
}

export interface SyncPerformanceInput {
  readonly entityKind: string;
  readonly connectorId: string;
  readonly observedDurationMs: number;
  readonly recordCount: number;
  readonly batchSize: number;
  readonly errorRate: number;
  readonly retryCount: number;
  readonly avgRecordSizeBytes?: number;
  readonly networkLatencyMs?: number;
  readonly memoryUsageMb?: number;
}

export interface SyncPerformanceAnalysis {
  readonly entityKind: string;
  readonly bottlenecks: Bottleneck[];
  readonly optimizations: PerformanceOptimization[];
  readonly estimatedImprovementPercent: number;
  readonly summary: string;
}

export interface Bottleneck {
  readonly area: 'batch-size' | 'network' | 'serialization' | 'rate-limiting' | 'memory' | 'retries';
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly description: string;
  readonly evidence: string[];
}

export interface PerformanceOptimization {
  readonly area: string;
  readonly action: string;
  readonly currentValue?: number;
  readonly recommendedValue?: number;
  readonly expectedImprovementPercent: number;
  readonly confidence: number;
}

// ─── Date Range ───────────────────────────────────────────────────────────

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}
