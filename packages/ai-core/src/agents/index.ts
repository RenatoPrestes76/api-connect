/**
 * @seltriva/ai-core/agents
 * AI Specialist Agents — domain experts within ATHENA
 *
 * Each agent is a stateless plugin that:
 *   1. Receives an AIContext
 *   2. Selects and renders the appropriate prompt
 *   3. Calls the AI provider
 *   4. Parses and validates the response
 *   5. Returns typed AIRecommendation objects with full explanations
 *
 * 8 Specialist Agents:
 *   SchemaAnalystAgent     — classifies entities and fields using CBL
 *   MappingAnalystAgent    — analyzes and resolves field mapping conflicts
 *   ERPSpecialistAgent     — identifies ERP systems, modules, and conventions
 *   PerformanceAnalystAgent — detects bottlenecks and recommends optimizations
 *   SyncAnalystAgent       — recommends sync strategies and resolves conflicts
 *   SecurityAnalystAgent   — classifies data sensitivity and flags risks
 *   ChangeAnalystAgent     — assesses impact of schema changes
 *   ValidationAnalystAgent — recommends validation rules
 *
 * DI: all agents declare dependencies as interfaces — no concrete imports.
 */

import type { AIResult, AgentId, AITaskType, AIProviderId, SessionId } from '../providers/index';
import type { AIContext } from '../context-builder/index';
import type { AIRecommendation } from '../recommendations/index';
import type { ReasoningChain } from '../reasoning/index';
import type { Explanation } from '../explainability/index';

// ─── Agent IDs ────────────────────────────────────────────────────────────

export const AGENT_IDS = {
  SCHEMA_ANALYST: 'agent-schema-analyst' as AgentId,
  MAPPING_ANALYST: 'agent-mapping-analyst' as AgentId,
  ERP_SPECIALIST: 'agent-erp-specialist' as AgentId,
  PERFORMANCE_ANALYST: 'agent-performance-analyst' as AgentId,
  SYNC_ANALYST: 'agent-sync-analyst' as AgentId,
  SECURITY_ANALYST: 'agent-security-analyst' as AgentId,
  CHANGE_ANALYST: 'agent-change-analyst' as AgentId,
  VALIDATION_ANALYST: 'agent-validation-analyst' as AgentId,
} as const;

export type BuiltInAgentId = (typeof AGENT_IDS)[keyof typeof AGENT_IDS];

// ─── Agent Specialization ─────────────────────────────────────────────────

export type AgentSpecialization =
  | 'schema-analysis'
  | 'mapping-analysis'
  | 'erp-recognition'
  | 'performance-analysis'
  | 'sync-analysis'
  | 'security-analysis'
  | 'change-analysis'
  | 'validation';

// ─── Base Agent Interface ─────────────────────────────────────────────────

/**
 * The universal AI agent port.
 * Every specialist implements this interface.
 */
export interface AIAgent {
  readonly id: AgentId;
  readonly name: string;
  readonly specialization: AgentSpecialization;
  readonly description: string;
  readonly supportedTaskTypes: AITaskType[];
  readonly capabilities: AgentCapabilities;

  /**
   * Analyze context and return typed recommendations
   */
  analyze(context: AIContext, session: AgentSession): Promise<AIResult<AgentAnalysisResult>>;

  /**
   * Whether this agent can handle the given task type
   */
  canHandle(taskType: AITaskType): boolean;

  /**
   * Self-reported confidence about handling this specific context
   */
  estimateConfidence(context: AIContext): number;

  /**
   * Health check
   */
  isHealthy(): Promise<boolean>;
}

// ─── Agent Capabilities ───────────────────────────────────────────────────

export interface AgentCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsBatchAnalysis: boolean;
  readonly supportsInteractiveRefinement: boolean;
  readonly maxContextTokens: number;
  readonly typicalResponseTokens: number;
  readonly avgDurationMs: number;
}

// ─── Agent Session ────────────────────────────────────────────────────────

export interface AgentSession {
  readonly id: SessionId;
  readonly preferredProviderId?: AIProviderId;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly language?: string;
  readonly requestedBy?: string;
  readonly metadata?: Record<string, unknown>;
}

// ─── Agent Analysis Result ────────────────────────────────────────────────

export interface AgentAnalysisResult {
  readonly agentId: AgentId;
  readonly sessionId: SessionId;
  readonly recommendations: AIRecommendation[];
  readonly reasoningChain: ReasoningChain;
  readonly summary: string;
  readonly overallConfidence: number;
  readonly analysisReport?: AgentAnalysisReport;
  readonly tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  readonly durationMs: number;
}

export interface AgentAnalysisReport {
  readonly agentId: AgentId;
  readonly taskType: AITaskType;
  readonly subject: string;
  readonly findings: AgentFinding[];
  readonly summary: string;
  readonly confidence: number;
  readonly generatedAt: Date;
}

export interface AgentFinding {
  readonly severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  readonly category: string;
  readonly finding: string;
  readonly evidence: string[];
  readonly recommendation?: string;
}

// ─── Specialist Agent Interfaces ──────────────────────────────────────────

export interface SchemaAnalystAgent extends AIAgent {
  readonly id: typeof AGENT_IDS.SCHEMA_ANALYST;
  readonly specialization: 'schema-analysis';

  classifyEntity(
    entityName: string,
    fields: string[],
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
  classifyField(
    fieldName: string,
    entityName: string,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
  detectAnomalies(context: AIContext, session: AgentSession): Promise<AIResult<AIRecommendation[]>>;
}

export interface MappingAnalystAgent extends AIAgent {
  readonly id: typeof AGENT_IDS.MAPPING_ANALYST;
  readonly specialization: 'mapping-analysis';

  suggestMapping(
    sourceField: string,
    targetField: string,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
  resolveConflict(
    conflict: MappingConflictInput,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
  validateTransformation(
    transformation: string,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
}

export interface ERPSpecialistAgent extends AIAgent {
  readonly id: typeof AGENT_IDS.ERP_SPECIALIST;
  readonly specialization: 'erp-recognition';

  identifyERP(context: AIContext, session: AgentSession): Promise<AIResult<AIRecommendation>>;
  identifyModule(
    erpProfileId: string,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
  analyzeConventions(
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation[]>>;
}

export interface PerformanceAnalystAgent extends AIAgent {
  readonly id: typeof AGENT_IDS.PERFORMANCE_ANALYST;
  readonly specialization: 'performance-analysis';

  detectBottleneck(
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation[]>>;
  recommendOptimization(
    area: string,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
}

export interface SyncAnalystAgent extends AIAgent {
  readonly id: typeof AGENT_IDS.SYNC_ANALYST;
  readonly specialization: 'sync-analysis';

  recommendStrategy(context: AIContext, session: AgentSession): Promise<AIResult<AIRecommendation>>;
  resolveConflict(context: AIContext, session: AgentSession): Promise<AIResult<AIRecommendation>>;
  diagnoseSlowSync(
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation[]>>;
}

export interface SecurityAnalystAgent extends AIAgent {
  readonly id: typeof AGENT_IDS.SECURITY_ANALYST;
  readonly specialization: 'security-analysis';

  classifyDataSensitivity(
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation[]>>;
  assessRisk(context: AIContext, session: AgentSession): Promise<AIResult<AIRecommendation[]>>;
}

export interface ChangeAnalystAgent extends AIAgent {
  readonly id: typeof AGENT_IDS.CHANGE_ANALYST;
  readonly specialization: 'change-analysis';

  assessImpact(
    change: SchemaChangeInput,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
  planMigration(
    change: SchemaChangeInput,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AIRecommendation>>;
}

export interface ValidationAnalystAgent extends AIAgent {
  readonly id: typeof AGENT_IDS.VALIDATION_ANALYST;
  readonly specialization: 'validation';

  generateRules(context: AIContext, session: AgentSession): Promise<AIResult<AIRecommendation[]>>;
  detectAnomalies(context: AIContext, session: AgentSession): Promise<AIResult<AIRecommendation[]>>;
}

// ─── Specialist Input Types ───────────────────────────────────────────────

export interface MappingConflictInput {
  readonly sourceFieldName: string;
  readonly targetFieldName: string;
  readonly conflictType: 'type-mismatch' | 'name-ambiguity' | 'multiple-candidates' | 'no-match';
  readonly candidates: Array<{ cblTerm: string; confidence: number }>;
}

export interface SchemaChangeInput {
  readonly changeType:
    | 'add-field'
    | 'remove-field'
    | 'rename-field'
    | 'change-type'
    | 'add-entity'
    | 'remove-entity';
  readonly entityName: string;
  readonly fieldName?: string;
  readonly previousValue?: string;
  readonly newValue?: string;
  readonly affectedMappings?: string[];
}

// ─── Agent Registry ───────────────────────────────────────────────────────

/**
 * Plugin registry — agents are registered at startup and selected by task type.
 */
export interface AIAgentRegistry {
  register(agent: AIAgent): void;
  unregister(agentId: AgentId): void;
  get(agentId: AgentId): AIAgent | null;
  getAll(): AIAgent[];
  getBySpecialization(specialization: AgentSpecialization): AIAgent[];
  getForTaskType(taskType: AITaskType): AIAgent[];
  has(agentId: AgentId): boolean;
}

// ─── Agent Orchestrator ───────────────────────────────────────────────────

/**
 * Coordinates multiple agents for a complex analysis.
 * Runs agents in parallel where possible, serializes where dependencies exist.
 */
export interface AIAgentOrchestrator {
  /**
   * Run a single agent
   */
  run(
    agentId: AgentId,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AgentAnalysisResult>>;

  /**
   * Run multiple agents in parallel
   */
  runAll(
    agentIds: AgentId[],
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AgentAnalysisResult[]>>;

  /**
   * Run all agents suitable for a task type
   */
  runForTaskType(
    taskType: AITaskType,
    context: AIContext,
    session: AgentSession
  ): Promise<AIResult<AgentAnalysisResult[]>>;

  /**
   * Run agents in a pipeline — output of each feeds the next
   */
  runPipeline(
    pipeline: AgentPipelineStep[],
    session: AgentSession
  ): Promise<AIResult<AgentPipelineResult>>;
}

export interface AgentPipelineStep {
  readonly agentId: AgentId;
  readonly inputTransform?: (previousResult: AgentAnalysisResult) => AIContext;
}

export interface AgentPipelineResult {
  readonly steps: Array<{ agentId: AgentId; result: AgentAnalysisResult }>;
  readonly finalRecommendations: AIRecommendation[];
  readonly totalDurationMs: number;
}
