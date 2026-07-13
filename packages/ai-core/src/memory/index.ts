/**
 * @seltriva/ai-core/memory
 * AI Memory — persistent knowledge store for ATHENA
 *
 * Memory stores ONLY structural metadata. Never stores:
 *   - Business data values (prices, names, quantities)
 *   - Customer or supplier information
 *   - Transaction records
 *   - PII of any kind
 *
 * What is stored:
 *   - Schema structures (entity/field names and types)
 *   - Confirmed semantic mappings
 *   - ERP recognition patterns
 *   - Performance baselines (timing, throughput statistics)
 *   - Sync topology and conflict resolution patterns
 *   - Reasoning chains and their outcomes
 */

import type { AIResult, MemoryEntryId, AgentId, AITaskType } from '../providers/index';

// ─── AI Memory ────────────────────────────────────────────────────────────

export interface AIMemory {
  /**
   * Store a memory entry
   */
  store(entry: MemoryEntryInput): Promise<AIResult<MemoryEntry>>;

  /**
   * Retrieve a memory entry by ID
   */
  get(id: MemoryEntryId): Promise<MemoryEntry | null>;

  /**
   * Search memory by query and filters
   */
  search(query: MemoryQuery): Promise<MemorySearchResult>;

  /**
   * Find entries relevant to a given context
   */
  findRelevant(context: MemoryContext, limit?: number): Promise<MemoryEntry[]>;

  /**
   * Reinforce a memory entry (increases confidence/priority)
   */
  reinforce(id: MemoryEntryId, strength?: number): Promise<void>;

  /**
   * Mark a memory entry as contradicted by new information
   */
  contradict(id: MemoryEntryId, reason: string): Promise<void>;

  /**
   * Permanently remove a memory entry
   */
  forget(id: MemoryEntryId): Promise<void>;

  /**
   * Purge entries older than a threshold or with low confidence
   */
  consolidate(options?: ConsolidationOptions): Promise<ConsolidationResult>;

  /**
   * Export memory for inspection or backup
   */
  export(filter?: MemoryFilter): Promise<MemoryExport>;

  /**
   * Stats about current memory state
   */
  getStats(): MemoryStats;
}

// ─── Memory Entry ─────────────────────────────────────────────────────────

export interface MemoryEntry {
  readonly id: MemoryEntryId;
  readonly kind: MemoryEntryKind;
  readonly domain: MemoryDomain;
  readonly subject: string;
  readonly payload: MemoryPayload;
  readonly confidence: number;
  readonly reinforcementCount: number;
  readonly sourceAgentId?: AgentId;
  readonly taskType?: AITaskType;
  readonly tags: string[];
  readonly isContradicted: boolean;
  readonly contradictionReason?: string;
  readonly storedAt: Date;
  readonly lastAccessedAt: Date;
  readonly expiresAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface MemoryEntryInput {
  readonly kind: MemoryEntryKind;
  readonly domain: MemoryDomain;
  readonly subject: string;
  readonly payload: MemoryPayload;
  readonly confidence: number;
  readonly sourceAgentId?: AgentId;
  readonly taskType?: AITaskType;
  readonly tags?: string[];
  readonly ttlSeconds?: number;
  readonly metadata?: Record<string, unknown>;
}

// ─── Memory Kinds ─────────────────────────────────────────────────────────

export type MemoryEntryKind =
  | 'schema-structure' // entity/field structure knowledge
  | 'semantic-mapping' // confirmed CBL term → source name
  | 'erp-pattern' // ERP naming/structural conventions
  | 'performance-baseline' // timing/throughput statistics
  | 'sync-pattern' // sync topology and strategy
  | 'conflict-resolution' // how a conflict type was resolved
  | 'validation-rule' // a rule learned from corrections
  | 'security-classification' // data sensitivity classification
  | 'reasoning-outcome' // a reasoning chain and its result
  | 'agent-feedback' // feedback from a specialist agent
  | 'change-pattern'; // schema change patterns

export type MemoryDomain =
  | 'schema'
  | 'mapping'
  | 'erp'
  | 'sync'
  | 'performance'
  | 'security'
  | 'validation'
  | 'reasoning'
  | 'general';

// ─── Memory Payload (discriminated by kind) ───────────────────────────────

export type MemoryPayload =
  | SchemaStructureMemory
  | SemanticMappingMemory
  | ERPPatternMemory
  | PerformanceBaselineMemory
  | SyncPatternMemory
  | ConflictResolutionMemory
  | ValidationRuleMemory
  | SecurityClassificationMemory
  | ReasoningOutcomeMemory
  | AgentFeedbackMemory
  | ChangePatternMemory;

export interface SchemaStructureMemory {
  readonly kind: 'schema-structure';
  readonly entityName: string;
  readonly fieldNames: string[];
  readonly fieldTypes: string[];
  readonly relationshipTargets: string[];
  readonly entityCount: number;
  readonly schemaChecksum: string;
}

export interface SemanticMappingMemory {
  readonly kind: 'semantic-mapping';
  readonly sourceName: string;
  readonly cblTerm: string;
  readonly entityKind?: string;
  readonly fieldKind?: string;
  readonly erpProfileId?: string;
  readonly confirmedBy: string;
  readonly confirmedAt: Date;
}

export interface ERPPatternMemory {
  readonly kind: 'erp-pattern';
  readonly erpProfileId: string;
  readonly erpName: string;
  readonly patternType: 'naming-prefix' | 'naming-suffix' | 'module-indicator' | 'structural';
  readonly pattern: string;
  readonly associatedEntity?: string;
  readonly observedCount: number;
}

export interface PerformanceBaselineMemory {
  readonly kind: 'performance-baseline';
  readonly connectorId: string;
  readonly operationType: string;
  readonly avgDurationMs: number;
  readonly p95DurationMs: number;
  readonly avgRecordsPerSecond: number;
  readonly sampleCount: number;
  readonly measuredAt: Date;
}

export interface SyncPatternMemory {
  readonly kind: 'sync-pattern';
  readonly entityKind: string;
  readonly strategyKind: string;
  readonly conflictRate: number;
  readonly avgSyncDurationMs: number;
  readonly recommendedBatchSize: number;
  readonly knownConflictPatterns: string[];
}

export interface ConflictResolutionMemory {
  readonly kind: 'conflict-resolution';
  readonly conflictType: string;
  readonly entityKind: string;
  readonly resolutionStrategy: string;
  readonly appliedBy: string;
  readonly successRate: number;
}

export interface ValidationRuleMemory {
  readonly kind: 'validation-rule';
  readonly ruleDescription: string;
  readonly entityKinds: string[];
  readonly fieldKinds: string[];
  readonly severity: string;
  readonly learnedFromCorrections: number;
}

export interface SecurityClassificationMemory {
  readonly kind: 'security-classification';
  readonly fieldKind: string;
  readonly sensitivityLevel: string;
  readonly requiresEncryption: boolean;
  readonly requiresMasking: boolean;
  readonly regulatoryBasis: string[];
}

export interface ReasoningOutcomeMemory {
  readonly kind: 'reasoning-outcome';
  readonly taskType: AITaskType;
  readonly contextSummary: string;
  readonly conclusionSummary: string;
  readonly confidenceScore: number;
  readonly wasConfirmedByHuman: boolean;
}

export interface AgentFeedbackMemory {
  readonly kind: 'agent-feedback';
  readonly agentId: AgentId;
  readonly taskType: AITaskType;
  readonly recommendation: string;
  readonly feedbackType: 'positive' | 'negative' | 'correction';
  readonly correctedValue?: string;
}

export interface ChangePatternMemory {
  readonly kind: 'change-pattern';
  readonly changeType: string;
  readonly entityKind: string;
  readonly frequency: 'rare' | 'occasional' | 'frequent';
  readonly typicalImpact: 'low' | 'medium' | 'high' | 'critical';
  readonly recommendedAction: string;
}

// ─── Memory Query ─────────────────────────────────────────────────────────

export interface MemoryQuery {
  readonly kinds?: MemoryEntryKind[];
  readonly domains?: MemoryDomain[];
  readonly subject?: string;
  readonly tags?: string[];
  readonly minConfidence?: number;
  readonly includeContradicted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'confidence' | 'storedAt' | 'reinforcementCount' | 'lastAccessedAt';
  readonly sortOrder?: 'asc' | 'desc';
}

export interface MemoryContext {
  readonly entityName?: string;
  readonly fieldNames?: string[];
  readonly erpProfileId?: string;
  readonly taskType?: AITaskType;
  readonly domain?: MemoryDomain;
  readonly tags?: string[];
}

export interface MemorySearchResult {
  readonly entries: MemoryEntry[];
  readonly total: number;
  readonly hasMore: boolean;
}

// ─── Memory Filter ────────────────────────────────────────────────────────

export interface MemoryFilter {
  readonly kinds?: MemoryEntryKind[];
  readonly domains?: MemoryDomain[];
  readonly agentIds?: AgentId[];
  readonly minConfidence?: number;
  readonly storedAfter?: Date;
  readonly storedBefore?: Date;
}

// ─── Consolidation ────────────────────────────────────────────────────────

export interface ConsolidationOptions {
  readonly removeExpired?: boolean;
  readonly removeBelow?: number;
  readonly olderThanDays?: number;
  readonly dryRun?: boolean;
}

export interface ConsolidationResult {
  readonly removedCount: number;
  readonly keptCount: number;
  readonly dryRun: boolean;
  readonly removedEntryIds: MemoryEntryId[];
}

// ─── Export ───────────────────────────────────────────────────────────────

export interface MemoryExport {
  readonly exportedAt: Date;
  readonly totalEntries: number;
  readonly entries: MemoryEntry[];
  readonly stats: MemoryStats;
}

// ─── Stats ────────────────────────────────────────────────────────────────

export interface MemoryStats {
  readonly totalEntries: number;
  readonly entriesByKind: Readonly<Record<MemoryEntryKind, number>>;
  readonly entriesByDomain: Readonly<Record<MemoryDomain, number>>;
  readonly averageConfidence: number;
  readonly contradictedCount: number;
  readonly expiredCount: number;
  readonly oldestEntryAt?: Date;
  readonly newestEntryAt?: Date;
}

// ─── Memory Store (persistence port) ─────────────────────────────────────

export interface MemoryStore {
  save(entry: MemoryEntry): Promise<void>;
  getById(id: MemoryEntryId): Promise<MemoryEntry | null>;
  findByKind(kind: MemoryEntryKind, limit?: number): Promise<MemoryEntry[]>;
  findBySubject(subject: string): Promise<MemoryEntry[]>;
  delete(id: MemoryEntryId): Promise<void>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

// ─── Embedding Memory (semantic similarity search) ────────────────────────

export interface EmbeddingMemoryStore {
  storeWithEmbedding(entry: MemoryEntry, embedding: readonly number[]): Promise<void>;
  findSimilar(
    embedding: readonly number[],
    limit?: number,
    threshold?: number
  ): Promise<MemoryEntry[]>;
}
