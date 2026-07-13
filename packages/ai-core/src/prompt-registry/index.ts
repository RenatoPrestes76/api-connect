/**
 * @seltriva/ai-core/prompt-registry
 * Versioned Prompt Registry — prompts as independent, versioned modules
 *
 * Every prompt in ATHENA is a first-class artifact:
 * - Identified by a stable PromptId
 * - Versioned independently of code deployments
 * - Parameterized with typed variables
 * - Tagged by domain and agent specialization
 * - Tracked for performance (which prompt version produces better results?)
 *
 * Prompts are NEVER hardcoded in business logic — they are resolved through
 * this registry at runtime. This allows prompt engineering without code changes.
 */

import type { PromptId, AgentId, AITaskType, AIResult } from '../providers/index';

// ─── Prompt Registry ──────────────────────────────────────────────────────

export interface PromptRegistry {
  /**
   * Register a prompt template
   */
  register(template: PromptTemplate): void;

  /**
   * Register a new version of an existing prompt
   */
  registerVersion(promptId: PromptId, template: PromptTemplate): void;

  /**
   * Get the latest version of a prompt
   */
  get(promptId: PromptId): PromptTemplate | null;

  /**
   * Get a specific version
   */
  getVersion(promptId: PromptId, version: string): PromptTemplate | null;

  /**
   * Get the active (pinned) version for a prompt
   */
  getActive(promptId: PromptId): PromptTemplate | null;

  /**
   * Pin a specific version as the active version
   */
  setActive(promptId: PromptId, version: string): AIResult<void>;

  /**
   * Render a prompt — resolves variables, applies modifiers
   */
  render(promptId: PromptId, variables: PromptVariables): AIResult<RenderedPrompt>;

  /**
   * Render a specific version
   */
  renderVersion(
    promptId: PromptId,
    version: string,
    variables: PromptVariables
  ): AIResult<RenderedPrompt>;

  /**
   * List all registered prompts
   */
  list(filter?: PromptFilter): PromptSummary[];

  /**
   * List all versions of a prompt
   */
  listVersions(promptId: PromptId): PromptVersionInfo[];

  /**
   * Remove a prompt (only non-active versions can be removed)
   */
  unregister(promptId: PromptId, version?: string): AIResult<void>;

  /**
   * Check if a prompt exists
   */
  has(promptId: PromptId): boolean;
}

// ─── Prompt Template ──────────────────────────────────────────────────────

export interface PromptTemplate {
  readonly id: PromptId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly taskType: AITaskType;
  readonly agentId?: AgentId;
  readonly tags: string[];

  /** The raw template string with {{variable}} placeholders */
  readonly systemTemplate?: string;
  readonly userTemplate: string;
  readonly assistantPrefix?: string;

  /** Declared variables with types and descriptions */
  readonly variables: PromptVariable[];

  /** Modifiers applied before rendering */
  readonly modifiers?: PromptModifier[];

  /** Constraints on the expected output */
  readonly outputFormat?: PromptOutputFormat;

  readonly createdAt: Date;
  readonly author?: string;
  readonly changeLog?: string;
  readonly isDeprecated?: boolean;
  readonly metadata?: Record<string, unknown>;
}

// ─── Prompt Variables ─────────────────────────────────────────────────────

export type PromptVariables = Record<string, PromptVariableValue>;
export type PromptVariableValue = string | number | boolean | string[] | Record<string, unknown>;

export interface PromptVariable {
  readonly name: string;
  readonly type: PromptVariableType;
  readonly description: string;
  readonly required: boolean;
  readonly defaultValue?: PromptVariableValue;
  readonly examples?: PromptVariableValue[];
  readonly maxLength?: number;
}

export type PromptVariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string-array'
  | 'json-object'
  | 'schema-summary'
  | 'entity-list'
  | 'field-list'
  | 'mapping-list'
  | 'erp-context';

// ─── Rendered Prompt ──────────────────────────────────────────────────────

export interface RenderedPrompt {
  readonly promptId: PromptId;
  readonly version: string;
  readonly systemPrompt?: string;
  readonly userMessage: string;
  readonly estimatedTokens: number;
  readonly renderedAt: Date;
  readonly variables: PromptVariables;
}

// ─── Prompt Modifiers ─────────────────────────────────────────────────────

/**
 * A modifier transforms the rendered prompt before it is sent.
 * Examples: truncate long context, add language instructions, inject examples.
 */
export interface PromptModifier {
  readonly id: string;
  readonly order: number;
  apply(rendered: RenderedPrompt): RenderedPrompt;
}

// ─── Output Format ────────────────────────────────────────────────────────

export interface PromptOutputFormat {
  readonly type: 'json' | 'markdown' | 'plain' | 'structured';
  readonly schema?: Record<string, unknown>;
  readonly required_fields?: string[];
  readonly example?: string;
}

// ─── Prompt Versioning ────────────────────────────────────────────────────

export interface PromptVersionInfo {
  readonly promptId: PromptId;
  readonly version: string;
  readonly isActive: boolean;
  readonly isDeprecated: boolean;
  readonly createdAt: Date;
  readonly author?: string;
  readonly changeLog?: string;
  readonly performanceMetrics?: PromptPerformanceMetrics;
}

export interface PromptPerformanceMetrics {
  readonly totalInvocations: number;
  readonly successRate: number;
  readonly averageConfidence: number;
  readonly averageTokens: number;
  readonly feedbackScore: number;
  readonly lastUsedAt?: Date;
}

// ─── Prompt Filters / Summaries ───────────────────────────────────────────

export interface PromptFilter {
  readonly taskType?: AITaskType;
  readonly agentId?: AgentId;
  readonly tags?: string[];
  readonly includeDeprecated?: boolean;
}

export interface PromptSummary {
  readonly id: PromptId;
  readonly name: string;
  readonly taskType: AITaskType;
  readonly activeVersion: string;
  readonly versionCount: number;
  readonly tags: string[];
  readonly isDeprecated: boolean;
  readonly lastUpdatedAt: Date;
}

// ─── Built-in Prompt IDs ──────────────────────────────────────────────────

export const PROMPT_IDS = {
  // Schema Analysis
  SCHEMA_ENTITY_CLASSIFICATION: 'prompt-schema-entity-classification' as PromptId,
  SCHEMA_FIELD_MAPPING: 'prompt-schema-field-mapping' as PromptId,
  SCHEMA_ANOMALY_DETECTION: 'prompt-schema-anomaly-detection' as PromptId,
  SCHEMA_CHANGE_IMPACT: 'prompt-schema-change-impact' as PromptId,

  // Mapping Analysis
  MAPPING_SUGGESTION: 'prompt-mapping-suggestion' as PromptId,
  MAPPING_CONFLICT_RESOLUTION: 'prompt-mapping-conflict-resolution' as PromptId,
  MAPPING_TRANSFORMATION: 'prompt-mapping-transformation' as PromptId,

  // ERP Recognition
  ERP_IDENTIFY_SYSTEM: 'prompt-erp-identify-system' as PromptId,
  ERP_IDENTIFY_MODULE: 'prompt-erp-identify-module' as PromptId,
  ERP_PATTERN_ANALYSIS: 'prompt-erp-pattern-analysis' as PromptId,

  // Sync Analysis
  SYNC_STRATEGY_RECOMMENDATION: 'prompt-sync-strategy' as PromptId,
  SYNC_CONFLICT_RESOLUTION: 'prompt-sync-conflict-resolution' as PromptId,
  SYNC_PERFORMANCE_DIAGNOSIS: 'prompt-sync-performance-diagnosis' as PromptId,

  // Security
  SECURITY_DATA_CLASSIFICATION: 'prompt-security-data-classification' as PromptId,
  SECURITY_RISK_ASSESSMENT: 'prompt-security-risk-assessment' as PromptId,

  // Validation
  VALIDATION_RULE_GENERATION: 'prompt-validation-rule-generation' as PromptId,
  VALIDATION_ANOMALY_DETECTION: 'prompt-validation-anomaly-detection' as PromptId,

  // Performance
  PERFORMANCE_BOTTLENECK: 'prompt-performance-bottleneck' as PromptId,
  PERFORMANCE_OPTIMIZATION: 'prompt-performance-optimization' as PromptId,

  // General
  REASONING_CHAIN: 'prompt-reasoning-chain' as PromptId,
  EXPLANATION_GENERATION: 'prompt-explanation-generation' as PromptId,
} as const;

export type BuiltInPromptId = (typeof PROMPT_IDS)[keyof typeof PROMPT_IDS];

// ─── Prompt Loader ────────────────────────────────────────────────────────

/**
 * Loads prompt templates from external sources (files, database, remote API).
 */
export interface PromptLoader {
  loadFromFile(filePath: string): Promise<AIResult<PromptTemplate[]>>;
  loadFromDirectory(dirPath: string): Promise<AIResult<PromptTemplate[]>>;
  loadFromRemote(url: string): Promise<AIResult<PromptTemplate[]>>;
}

// ─── Prompt Renderer ──────────────────────────────────────────────────────

export interface PromptRenderer {
  render(template: PromptTemplate, variables: PromptVariables): AIResult<RenderedPrompt>;
  validateVariables(template: PromptTemplate, variables: PromptVariables): PromptVariableValidation;
}

export interface PromptVariableValidation {
  readonly isValid: boolean;
  readonly missingRequired: string[];
  readonly unknownVariables: string[];
  readonly typeErrors: Array<{ name: string; expected: string; received: string }>;
}
