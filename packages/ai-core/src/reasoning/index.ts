/**
 * @seltriva/ai-core/reasoning
 * Reasoning Engine — structured chain-of-thought for AI decisions
 *
 * Every AI recommendation in ATHENA is backed by a transparent reasoning chain.
 * This module defines how that chain is structured, executed, and stored.
 *
 * Reasoning patterns supported:
 *   Chain-of-Thought (CoT) — step by step logical progression
 *   Tree-of-Thought (ToT) — parallel branches, best path selected
 *   Decomposition — break problem into sub-questions, compose answer
 *   Analogical — find similar known cases, adapt to current case
 *   Elimination — rank hypotheses, eliminate by evidence
 */

import type {
  AIResult,
  AIProvider,
  AIConfidenceValue,
  AIConfidenceTier,
  AgentId,
  AITaskType,
  confidenceTier,
} from '../providers/index';

// ─── Reasoning Engine ─────────────────────────────────────────────────────

export interface ReasoningEngine {
  /**
   * Execute a reasoning chain for a given problem
   */
  reason(input: ReasoningInput): Promise<AIResult<ReasoningResult>>;

  /**
   * Continue/extend an existing reasoning chain with new evidence
   */
  extend(chainId: string, evidence: Evidence[]): Promise<AIResult<ReasoningResult>>;

  /**
   * Compare two reasoning chains and determine which is stronger
   */
  compare(chainA: ReasoningChain, chainB: ReasoningChain): ReasoningComparison;

  /**
   * Summarize a reasoning chain into a human-readable explanation
   */
  summarize(chain: ReasoningChain): string;

  /**
   * Get a previously stored reasoning chain
   */
  getChain(chainId: string): ReasoningChain | null;

  /**
   * Register a custom reasoning strategy
   */
  registerStrategy(strategy: ReasoningStrategy): void;
}

// ─── Reasoning Input ──────────────────────────────────────────────────────

export interface ReasoningInput {
  readonly problem: string;
  readonly context: string;
  readonly evidence: Evidence[];
  readonly hypotheses?: Hypothesis[];
  readonly strategyId?: ReasoningStrategyId;
  readonly maxSteps?: number;
  readonly temperature?: number;
  readonly requiresConfidenceAbove?: number;
  readonly agentId?: AgentId;
  readonly taskType?: AITaskType;
  readonly metadata?: Record<string, unknown>;
}

// ─── Reasoning Result ─────────────────────────────────────────────────────

export interface ReasoningResult {
  readonly chain: ReasoningChain;
  readonly conclusion: string;
  readonly confidence: AIConfidenceValue;
  readonly confidenceTier: AIConfidenceTier;
  readonly selectedHypothesis?: Hypothesis;
  readonly eliminatedHypotheses: Array<{ hypothesis: Hypothesis; reason: string }>;
  readonly totalSteps: number;
  readonly durationMs: number;
}

// ─── Reasoning Chain ──────────────────────────────────────────────────────

export interface ReasoningChain {
  readonly id: string;
  readonly problem: string;
  readonly strategyId: ReasoningStrategyId;
  readonly steps: ReasoningStep[];
  readonly conclusion: string;
  readonly confidence: AIConfidenceValue;
  readonly createdAt: Date;
  readonly agentId?: AgentId;
}

export interface ReasoningStep {
  readonly stepNumber: number;
  readonly type: ReasoningStepType;
  readonly thought: string;
  readonly evidence: Evidence[];
  readonly intermediate?: string;
  readonly confidence: AIConfidenceValue;
  readonly durationMs?: number;
}

export type ReasoningStepType =
  | 'observation' // observe a fact from evidence
  | 'inference' // infer from observations
  | 'hypothesis' // form a hypothesis
  | 'evaluation' // evaluate a hypothesis against evidence
  | 'elimination' // eliminate a hypothesis
  | 'analogy' // draw analogy from known case
  | 'decomposition' // break problem into sub-problems
  | 'synthesis' // combine sub-results
  | 'conclusion'; // final conclusion

// ─── Evidence ─────────────────────────────────────────────────────────────

export interface Evidence {
  readonly id: string;
  readonly type: EvidenceType;
  readonly content: string;
  readonly weight: number;
  readonly source: string;
  readonly isContradictory?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export type EvidenceType =
  | 'schema-fact' // fact about the schema structure
  | 'naming-pattern' // observed naming convention
  | 'type-constraint' // field type constraint
  | 'relationship-fact' // FK or join relationship
  | 'erp-convention' // known ERP convention
  | 'memory-recall' // recalled from AI memory
  | 'dictionary-match' // matched against business dictionary
  | 'similarity-score' // similarity to known concept
  | 'structural-signature' // structural match
  | 'negative-evidence'; // evidence against a hypothesis

// ─── Hypotheses ───────────────────────────────────────────────────────────

export interface Hypothesis {
  readonly id: string;
  readonly claim: string;
  readonly confidence: AIConfidenceValue;
  readonly supportingEvidence: Evidence[];
  readonly contradictingEvidence: Evidence[];
  readonly status: HypothesisStatus;
}

export type HypothesisStatus =
  | 'proposed'
  | 'supported'
  | 'weakly-supported'
  | 'contested'
  | 'eliminated'
  | 'confirmed';

// ─── Reasoning Strategies ─────────────────────────────────────────────────

export type ReasoningStrategyId =
  | 'chain-of-thought'
  | 'tree-of-thought'
  | 'decomposition'
  | 'analogical'
  | 'elimination';

export interface ReasoningStrategy {
  readonly id: ReasoningStrategyId;
  readonly name: string;
  readonly description: string;

  /**
   * Build the prompt structure for this reasoning strategy
   */
  buildPrompt(input: ReasoningInput): ReasoningPromptPlan;

  /**
   * Parse the raw LLM response into structured steps
   */
  parseResponse(raw: string): ReasoningStep[];

  /**
   * Choose the best strategy for a given task type
   */
  suitabilityScore(taskType: AITaskType): number;
}

export interface ReasoningPromptPlan {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly expectedOutputStructure: string;
}

// ─── Comparison ───────────────────────────────────────────────────────────

export interface ReasoningComparison {
  readonly winner: 'A' | 'B' | 'tie';
  readonly winnerReason: string;
  readonly chainAStrengths: string[];
  readonly chainBStrengths: string[];
  readonly chainAWeaknesses: string[];
  readonly chainBWeaknesses: string[];
}

// ─── Reasoning Store ──────────────────────────────────────────────────────

export interface ReasoningStore {
  save(chain: ReasoningChain): Promise<void>;
  getById(id: string): Promise<ReasoningChain | null>;
  findByAgent(agentId: AgentId, limit?: number): Promise<ReasoningChain[]>;
  findByTaskType(taskType: AITaskType, limit?: number): Promise<ReasoningChain[]>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

// ─── Reasoning Evaluator ──────────────────────────────────────────────────

/**
 * Evaluates whether a reasoning chain is sound, consistent, and supported by evidence.
 */
export interface ReasoningEvaluator {
  evaluate(chain: ReasoningChain): ReasoningEvaluation;
  hasCircularReasoning(chain: ReasoningChain): boolean;
  hasUnsupportedConclusion(chain: ReasoningChain): boolean;
  getLogicalGaps(chain: ReasoningChain): string[];
}

export interface ReasoningEvaluation {
  readonly isSound: boolean;
  readonly isSufficient: boolean;
  readonly logicalGaps: string[];
  readonly circularSteps: number[];
  readonly unsupportedClaims: string[];
  readonly qualityScore: number;
}
