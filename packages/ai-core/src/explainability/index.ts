/**
 * @seltriva/ai-core/explainability
 * Explainability Engine — every AI recommendation must be explainable
 *
 * No ATHENA recommendation is a black box.
 * Every output includes:
 *   - Reason: WHY was this recommended?
 *   - Confidence: HOW certain is ATHENA?
 *   - Evidence: WHAT data supports this?
 *   - Alternatives: WHAT else was considered?
 *
 * This module defines the structures and interfaces that enforce explainability
 * across all AI agents and decision types.
 */

import type {
  AIResult,
  AIConfidenceValue,
  AIConfidenceTier,
  RecommendationId,
  AgentId,
  AITaskType,
} from '../providers/index';
import type { ReasoningChain, Evidence } from '../reasoning/index';

// ─── Explainability Engine ────────────────────────────────────────────────

export interface ExplainabilityEngine {
  /**
   * Generate a full explanation for a raw recommendation
   */
  explain<T>(recommendation: T, context: ExplanationContext): Promise<AIResult<Explanation<T>>>;

  /**
   * Simplify an existing explanation to a given verbosity level
   */
  simplify(
    explanation: Explanation<unknown>,
    verbosity: ExplanationVerbosity
  ): Explanation<unknown>;

  /**
   * Compare two explanations and produce a contrast view
   */
  contrast(a: Explanation<unknown>, b: Explanation<unknown>): ExplanationContrast;

  /**
   * Format an explanation as human-readable text
   */
  format(explanation: Explanation<unknown>, format: ExplanationOutputFormat): string;
}

// ─── Explanation ──────────────────────────────────────────────────────────

/**
 * The core explainability wrapper.
 * Every AI recommendation is wrapped in this structure before it leaves ATHENA.
 */
export interface Explanation<T> {
  readonly id: string;
  readonly recommendationId: RecommendationId;
  readonly agentId: AgentId;
  readonly taskType: AITaskType;

  /** The thing being explained */
  readonly subject: string;

  /** Primary human-readable reason */
  readonly reason: string;

  /** One-sentence summary for quick reading */
  readonly summary: string;

  /** Supporting evidence — ordered by weight descending */
  readonly evidence: ExplanationEvidence[];

  /** Confidence value (0–1) */
  readonly confidence: AIConfidenceValue;

  /** Human tier label */
  readonly confidenceTier: AIConfidenceTier;

  /** Why ATHENA is confident (or not) */
  readonly confidenceRationale: string;

  /** Other candidates that were considered and why they were ranked lower */
  readonly alternatives: ExplanationAlternative[];

  /** The reasoning chain that produced this explanation */
  readonly reasoningChain?: ReasoningChain;

  /** Limitations or caveats */
  readonly caveats?: string[];

  /** When this should be re-evaluated */
  readonly staleness?: ExplanationStaleness;

  readonly generatedAt: Date;
  readonly verbosity: ExplanationVerbosity;
}

// ─── Explanation Context ──────────────────────────────────────────────────

export interface ExplanationContext {
  readonly agentId: AgentId;
  readonly taskType: AITaskType;
  readonly reasoningChain?: ReasoningChain;
  readonly evidence?: Evidence[];
  readonly alternatives?: unknown[];
  readonly targetAudience?: ExplanationAudience;
  readonly verbosity?: ExplanationVerbosity;
  readonly language?: string;
}

// ─── Evidence in Explanation ──────────────────────────────────────────────

export interface ExplanationEvidence {
  readonly id: string;
  readonly type: ExplanationEvidenceType;
  readonly description: string;
  readonly weight: number;
  readonly direction: 'supports' | 'contradicts';
  readonly detail?: string;
  readonly source?: string;
}

export type ExplanationEvidenceType =
  | 'name-similarity' // source name matches CBL alias
  | 'type-match' // field type compatible
  | 'structural-match' // entity structure matches known pattern
  | 'erp-profile-match' // known ERP pattern matched
  | 'memory-recall' // confirmed in previous integration
  | 'dictionary-match' // found in business dictionary
  | 'graph-coherence' // consistent with knowledge graph
  | 'learning-history' // pattern learned from past confirmations
  | 'position-context' // position within entity is typical
  | 'negative-evidence'; // evidence that contradicts

// ─── Alternatives ─────────────────────────────────────────────────────────

export interface ExplanationAlternative {
  readonly rank: number;
  readonly candidate: string;
  readonly confidence: AIConfidenceValue;
  readonly whyRankedLower: string;
  readonly keyDifference: string;
}

// ─── Staleness ────────────────────────────────────────────────────────────

export interface ExplanationStaleness {
  readonly expiresAt?: Date;
  readonly invalidatingConditions: string[];
  readonly shouldReEvaluateWhen: string;
}

// ─── Verbosity / Audience ─────────────────────────────────────────────────

export type ExplanationVerbosity =
  | 'brief' // 1–2 sentences
  | 'standard' // structured paragraph with evidence
  | 'detailed' // full chain of reasoning
  | 'technical'; // full reasoning chain + evidence weights

export type ExplanationAudience =
  | 'administrator' // non-technical, business-focused
  | 'integrator' // technical, integration-focused
  | 'developer' // deep technical detail
  | 'auditor'; // compliance-oriented, full trace

// ─── Output Formats ───────────────────────────────────────────────────────

export type ExplanationOutputFormat = 'text' | 'markdown' | 'html' | 'json';

// ─── Contrast ─────────────────────────────────────────────────────────────

export interface ExplanationContrast {
  readonly subjectA: string;
  readonly subjectB: string;
  readonly sharedEvidence: ExplanationEvidence[];
  readonly uniqueToA: ExplanationEvidence[];
  readonly uniqueToB: ExplanationEvidence[];
  readonly keyDifference: string;
  readonly recommendation: 'prefer-A' | 'prefer-B' | 'equivalent' | 'context-dependent';
  readonly recommendationReason: string;
}

// ─── Explanation Store ────────────────────────────────────────────────────

export interface ExplanationStore {
  save(explanation: Explanation<unknown>): Promise<void>;
  getById(id: string): Promise<Explanation<unknown> | null>;
  findByRecommendation(recommendationId: RecommendationId): Promise<Explanation<unknown>[]>;
  findByAgent(agentId: AgentId, limit?: number): Promise<Explanation<unknown>[]>;
  delete(id: string): Promise<void>;
}

// ─── Explanation Formatter ────────────────────────────────────────────────

export interface ExplanationFormatter {
  toBrief(explanation: Explanation<unknown>): string;
  toMarkdown(explanation: Explanation<unknown>): string;
  toAuditReport(explanation: Explanation<unknown>): string;
}

// ─── Explainability Validator ─────────────────────────────────────────────

/**
 * Enforces that every outgoing recommendation has sufficient explanation.
 */
export interface ExplainabilityValidator {
  validate(explanation: Explanation<unknown>): ExplainabilityValidationResult;
  isExplainableEnough(explanation: Explanation<unknown>, minEvidence?: number): boolean;
}

export interface ExplainabilityValidationResult {
  readonly isValid: boolean;
  readonly hasReason: boolean;
  readonly hasEvidence: boolean;
  readonly hasAlternatives: boolean;
  readonly hasConfidenceRationale: boolean;
  readonly issues: string[];
}
