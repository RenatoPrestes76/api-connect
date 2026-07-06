/**
 * @seltriva/ai-core/context-builder
 * Context Builder — assembles rich AI context for each analysis request
 *
 * The quality of AI reasoning depends entirely on the quality of context.
 * This module defines how ATHENA assembles the right context for each task:
 *   - Schema structure summaries (compact, token-efficient)
 *   - Relevant semantic mappings from the registry
 *   - ERP profile hints
 *   - Performance history (when relevant)
 *   - Memory recalls from similar past cases
 *   - Dependency relationships between entities
 *
 * Context is always bounded by a token budget to keep LLM costs predictable.
 */

import type {
  AIResult, AgentId, AITaskType, AIModelId,
} from '../providers/index';
import type { MemoryEntry } from '../memory/index';

// ─── Context Builder ──────────────────────────────────────────────────────

export interface AIContextBuilder {
  /**
   * Build context for a schema analysis task
   */
  forSchemaAnalysis(input: SchemaContextInput): Promise<AIResult<AIContext>>;

  /**
   * Build context for a mapping analysis task
   */
  forMappingAnalysis(input: MappingContextInput): Promise<AIResult<AIContext>>;

  /**
   * Build context for ERP recognition
   */
  forERPRecognition(input: ERPContextInput): Promise<AIResult<AIContext>>;

  /**
   * Build context for sync analysis
   */
  forSyncAnalysis(input: SyncContextInput): Promise<AIResult<AIContext>>;

  /**
   * Build context for a generic agent task
   */
  forAgent(agentId: AgentId, taskType: AITaskType, raw: Record<string, unknown>): Promise<AIResult<AIContext>>;

  /**
   * Estimate the token cost of a context before building it
   */
  estimateTokens(input: ContextBuildInput): number;

  /**
   * Register a custom context enricher plugin
   */
  registerEnricher(enricher: ContextEnricher): void;
}

// ─── AI Context ───────────────────────────────────────────────────────────

/**
 * The assembled context passed to every AI agent invocation.
 * Bounded by tokenBudget so prompts never overflow context windows.
 */
export interface AIContext {
  readonly id: string;
  readonly taskType: AITaskType;
  readonly agentId?: AgentId;

  /** Structured sections that compose the context */
  readonly sections: AIContextSection[];

  /** Flat text representation for prompt injection */
  readonly text: string;

  /** Estimated token count */
  readonly estimatedTokens: number;

  /** Token budget used during assembly */
  readonly tokenBudget: number;

  /** Memory entries that were recalled and included */
  readonly recalledMemory: MemoryEntry[];

  /** Whether context was truncated to fit the budget */
  readonly wasTruncated: boolean;

  /** What was omitted due to token budget */
  readonly omitted?: string[];

  readonly builtAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface AIContextSection {
  readonly id: string;
  readonly label: string;
  readonly content: string;
  readonly tokens: number;
  readonly priority: number;
  readonly isRequired: boolean;
}

// ─── Context Build Inputs ─────────────────────────────────────────────────

export interface ContextBuildInput {
  readonly taskType: AITaskType;
  readonly tokenBudget?: number;
  readonly targetModel?: AIModelId;
  readonly includeMemory?: boolean;
  readonly includeERPProfile?: boolean;
  readonly includeExamples?: boolean;
  readonly language?: string;
}

export interface SchemaContextInput extends ContextBuildInput {
  readonly taskType: 'schema-analysis' | 'change-analysis';
  readonly schemaName: string;
  readonly entityName: string;
  readonly fieldNames: string[];
  readonly fieldTypes: string[];
  readonly foreignKeyTargets?: string[];
  readonly namespace?: string;
  readonly erpProfileId?: string;
  readonly contextEntities?: string[];
  readonly priorMappings?: PriorMappingHint[];
}

export interface MappingContextInput extends ContextBuildInput {
  readonly taskType: 'mapping-analysis';
  readonly sourceEntityName: string;
  readonly targetEntityName: string;
  readonly sourceFields: FieldContextHint[];
  readonly targetFields: FieldContextHint[];
  readonly erpProfileId?: string;
  readonly priorConflicts?: string[];
}

export interface ERPContextInput extends ContextBuildInput {
  readonly taskType: 'erp-recognition';
  readonly schemaName: string;
  readonly entityNames: string[];
  readonly sampleFieldNames: string[];
  readonly knownVendorHints?: string[];
  readonly versionHints?: string[];
}

export interface SyncContextInput extends ContextBuildInput {
  readonly taskType: 'sync-analysis';
  readonly entityKind: string;
  readonly sourceConnectorId: string;
  readonly targetConnectorId: string;
  readonly priorConflicts?: SyncConflictHint[];
  readonly recordCountEstimate?: number;
  readonly lastSyncedAt?: Date;
}

// ─── Context Hints ────────────────────────────────────────────────────────

export interface PriorMappingHint {
  readonly sourceName: string;
  readonly cblTerm: string;
  readonly confidence: number;
  readonly isConfirmed: boolean;
}

export interface FieldContextHint {
  readonly name: string;
  readonly type: string;
  readonly isPrimaryKey?: boolean;
  readonly isForeignKey?: boolean;
  readonly nullable?: boolean;
  readonly knownCBLTerm?: string;
}

export interface SyncConflictHint {
  readonly conflictType: string;
  readonly frequency: number;
  readonly lastResolution?: string;
}

// ─── Context Enricher (plugin) ────────────────────────────────────────────

/**
 * Context enrichers add domain-specific information to the assembled context.
 * Register custom enrichers to inject organization-specific knowledge.
 */
export interface ContextEnricher {
  readonly id: string;
  readonly name: string;
  readonly applicableTaskTypes: AITaskType[];
  readonly priority: number;
  readonly estimatedTokenCost: number;

  enrich(context: AIContext, input: ContextBuildInput): Promise<AIContextSection[]>;
}

// ─── Token Budget ─────────────────────────────────────────────────────────

export const DEFAULT_TOKEN_BUDGETS: Readonly<Record<AITaskType, number>> = {
  'schema-analysis':       4000,
  'mapping-analysis':      4000,
  'erp-recognition':       2000,
  'sync-analysis':         3000,
  'security-analysis':     2000,
  'performance-analysis':  2000,
  'change-analysis':       3000,
  'validation':            2000,
  'embedding':             8000,
  'reasoning':             6000,
};

// ─── Context Serializer ───────────────────────────────────────────────────

export interface ContextSerializer {
  toText(context: AIContext): string;
  toMarkdown(context: AIContext): string;
  toPromptMessages(context: AIContext): Array<{ role: string; content: string }>;
  estimateTokens(text: string): number;
}

// ─── Context Cache ────────────────────────────────────────────────────────

export interface ContextCache {
  get(key: string): AIContext | null;
  set(key: string, context: AIContext, ttlSeconds?: number): void;
  invalidate(key: string): void;
  clear(): void;
}
