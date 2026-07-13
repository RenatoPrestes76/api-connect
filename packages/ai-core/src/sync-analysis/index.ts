/**
 * @seltriva/ai-core/sync-analysis
 * Sync Analysis — AI-powered synchronization strategy and conflict resolution
 *
 * The SyncAnalystAgent uses this module to:
 *   - Recommend optimal sync strategies per entity kind
 *   - Detect and resolve data synchronization conflicts
 *   - Diagnose slow or failing synchronizations
 *   - Recommend retry strategies and error handling patterns
 *   - Assess risks of bidirectional sync configurations
 *
 * ATHENA recommends. It never triggers, schedules, or executes syncs.
 */

import type { AIResult, AIConfidenceValue } from '../providers/index';
import type { AIRecommendation } from '../recommendations/index';

// ─── Sync Analysis Engine ──────────────────────────────────────────────────

export interface SyncAnalysisEngine {
  /**
   * Recommend the optimal sync strategy for an entity
   */
  recommendStrategy(input: SyncStrategyInput): Promise<AIResult<SyncStrategyRecommendation>>;

  /**
   * Resolve a data conflict using AI reasoning
   */
  resolveConflict(input: SyncConflictInput): Promise<AIResult<SyncConflictResolution>>;

  /**
   * Diagnose a slow or failing sync
   */
  diagnoseProblem(input: SyncDiagnosisInput): Promise<AIResult<SyncDiagnosisResult>>;

  /**
   * Assess risks of a sync configuration
   */
  assessRisk(input: SyncRiskInput): Promise<AIResult<SyncRiskAssessment>>;

  /**
   * Analyze historical sync patterns and recommend improvements
   */
  analyzePatterns(input: SyncPatternAnalysisInput): Promise<AIResult<SyncPatternAnalysisResult>>;
}

// ─── Sync Strategy ────────────────────────────────────────────────────────

export interface SyncStrategyInput {
  readonly entityKind: string;
  readonly sourceConnectorId: string;
  readonly targetConnectorId: string;
  readonly recordCountEstimate?: number;
  readonly avgRecordSizeBytes?: number;
  readonly updateFrequency?: 'realtime' | 'high' | 'medium' | 'low' | 'rare';
  readonly priorConflictRate?: number;
  readonly hasDeleteSupport?: boolean;
  readonly hasTimestampField?: boolean;
  readonly hasSoftDelete?: boolean;
  readonly networkType?: 'internal' | 'cloud' | 'cross-cloud' | 'on-premise-to-cloud';
}

export interface SyncStrategyRecommendation {
  readonly entityKind: string;
  readonly strategy: SyncStrategyKind;
  readonly conflictResolutionStrategy: ConflictResolutionStrategy;
  readonly recommendedBatchSize: number;
  readonly recommendedIntervalMs?: number;
  readonly recommendedRetryPolicy: RetryPolicy;
  readonly estimatedThroughputRecordsPerSecond?: number;
  readonly confidence: AIConfidenceValue;
  readonly rationale: string;
  readonly tradeoffs: string[];
  readonly risks: string[];
  readonly recommendation: AIRecommendation;
}

export type SyncStrategyKind =
  | 'full-sync' // copy everything, every time
  | 'incremental' // only changed records since last sync
  | 'delta' // based on a delta/change log
  | 'event-driven' // triggered by source events
  | 'scheduled-batch' // timed batch operations
  | 'real-time-stream'; // continuous streaming

// ─── Conflict Resolution Strategy ────────────────────────────────────────

export type ConflictResolutionStrategy =
  | 'source-wins' // always take the source value
  | 'target-wins' // always keep the target value
  | 'latest-timestamp' // most recently updated wins
  | 'field-level-merge' // merge field by field
  | 'manual-review' // flag for human decision
  | 'custom'; // custom logic (expressed in rules)

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly initialDelayMs: number;
  readonly backoffMultiplier: number;
  readonly maxDelayMs: number;
  readonly retryableErrorCodes: string[];
}

// ─── Conflict Resolution ──────────────────────────────────────────────────

export interface SyncConflictInput {
  readonly entityKind: string;
  readonly sourceConnectorId: string;
  readonly targetConnectorId: string;
  readonly conflictType: SyncConflictType;
  readonly sourceRecord: SyncRecordMetadata;
  readonly targetRecord: SyncRecordMetadata;
  readonly conflictingFields: SyncFieldConflict[];
  readonly priorResolutions?: PriorResolutionHint[];
}

export interface SyncRecordMetadata {
  readonly entityId?: string;
  readonly updatedAt?: Date;
  readonly version?: number;
  readonly source?: string;
}

export interface SyncFieldConflict {
  readonly fieldName: string;
  readonly cblTerm?: string;
  readonly sourceValue: string;
  readonly targetValue: string;
}

export interface PriorResolutionHint {
  readonly conflictType: SyncConflictType;
  readonly resolution: string;
  readonly appliedAt: Date;
}

export type SyncConflictType =
  | 'concurrent-update' // both sides updated the same record
  | 'delete-update' // one side deleted, other updated
  | 'orphaned-reference' // FK target no longer exists
  | 'duplicate-insert' // same logical record inserted twice
  | 'type-conversion-fail' // transformation failed on actual data
  | 'validation-fail' // target rejected the record
  | 'constraint-violation'; // target DB constraint failed

export interface SyncConflictResolution {
  readonly conflictType: SyncConflictType;
  readonly strategy: ConflictResolutionStrategy;
  readonly resolution:
    | 'use-source'
    | 'use-target'
    | 'merge'
    | 'skip'
    | 'flag-for-review'
    | 'custom';
  readonly fieldResolutions?: Array<{
    fieldName: string;
    resolution: 'use-source' | 'use-target' | 'calculate';
    calculationHint?: string;
  }>;
  readonly confidence: AIConfidenceValue;
  readonly rationale: string;
  readonly preventionRecommendation: string;
  readonly recommendation: AIRecommendation;
}

// ─── Sync Diagnosis ───────────────────────────────────────────────────────

export interface SyncDiagnosisInput {
  readonly entityKind: string;
  readonly connectorId: string;
  readonly symptom: SyncSymptom;
  readonly observations: SyncObservation[];
  readonly errorMessages?: string[];
  readonly executionHistory?: SyncExecutionSummary[];
}

export type SyncSymptom =
  | 'slow-sync'
  | 'high-error-rate'
  | 'missing-records'
  | 'duplicate-records'
  | 'stale-data'
  | 'memory-exhaustion'
  | 'rate-limit-exceeded'
  | 'timeout';

export interface SyncObservation {
  readonly metric: string;
  readonly value: number;
  readonly unit: string;
  readonly isAbormal?: boolean;
}

export interface SyncExecutionSummary {
  readonly startedAt: Date;
  readonly durationMs: number;
  readonly recordsProcessed: number;
  readonly errorCount: number;
  readonly retryCount: number;
}

export interface SyncDiagnosisResult {
  readonly symptom: SyncSymptom;
  readonly rootCauses: RootCause[];
  readonly immediateActions: string[];
  readonly longTermRecommendations: string[];
  readonly estimatedResolutionTime?: string;
  readonly confidence: AIConfidenceValue;
  readonly summary: string;
  readonly recommendations: AIRecommendation[];
}

export interface RootCause {
  readonly id: string;
  readonly hypothesis: string;
  readonly evidence: string[];
  readonly confidence: AIConfidenceValue;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly fix: string;
}

// ─── Sync Risk Assessment ─────────────────────────────────────────────────

export interface SyncRiskInput {
  readonly entityKind: string;
  readonly sourceConnectorId: string;
  readonly targetConnectorId: string;
  readonly direction: 'source-to-target' | 'target-to-source' | 'bidirectional';
  readonly strategy: SyncStrategyKind;
  readonly entityCount?: number;
  readonly hasDeleteSync?: boolean;
  readonly hasOverwriteProtection?: boolean;
}

export interface SyncRiskAssessment {
  readonly overallRisk: 'critical' | 'high' | 'medium' | 'low';
  readonly risks: SyncRisk[];
  readonly mitigations: SyncMitigation[];
  readonly isBidirectionalSafe: boolean;
  readonly summary: string;
  readonly recommendation: AIRecommendation;
}

export interface SyncRisk {
  readonly id: string;
  readonly kind: SyncRiskKind;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly description: string;
  readonly likelihood: 'certain' | 'likely' | 'possible' | 'unlikely';
}

export type SyncRiskKind =
  | 'data-loss'
  | 'data-duplication'
  | 'infinite-loop'
  | 'race-condition'
  | 'partial-sync'
  | 'cascade-delete'
  | 'inconsistent-state'
  | 'performance-overload';

export interface SyncMitigation {
  readonly riskId: string;
  readonly action: string;
  readonly effort: 'minimal' | 'moderate' | 'significant';
  readonly priority: 'immediate' | 'high' | 'medium' | 'low';
}

// ─── Pattern Analysis ─────────────────────────────────────────────────────

export interface SyncPatternAnalysisInput {
  readonly entityKind: string;
  readonly connectorId: string;
  readonly executions: SyncExecutionSummary[];
  readonly conflictHistory?: Array<{
    conflictType: SyncConflictType;
    occurrences: number;
    resolution: string;
  }>;
}

export interface SyncPatternAnalysisResult {
  readonly patterns: SyncPattern[];
  readonly recommendations: AIRecommendation[];
  readonly summary: string;
}

export interface SyncPattern {
  readonly id: string;
  readonly kind:
    | 'performance-cycle'
    | 'conflict-cluster'
    | 'error-spike'
    | 'throughput-degradation'
    | 'success-pattern';
  readonly description: string;
  readonly frequency: 'recurring' | 'occasional' | 'one-time';
  readonly confidence: AIConfidenceValue;
  readonly actionable: boolean;
  readonly suggestedAction?: string;
}
