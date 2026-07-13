/**
 * @seltriva/governance — feature-management
 *
 * Feature flags architecture: org-scoped flags, rule-based targeting,
 * percentage rollouts, A/B experiments, and kill switches.
 *
 * This is governance-layer flags (platform features, policy gates).
 * Application-level feature flags use the cloud configuration module.
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type FeatureFlagId = Branded<string, 'FeatureFlagId'>;
export type FlagRuleId = Branded<string, 'FlagRuleId'>;
export type ExperimentId = Branded<string, 'ExperimentId'>;

// ─── Feature Flag ────────────────────────────────────────────────────────────

export type FlagValueType = 'boolean' | 'string' | 'number' | 'json';
export type FlagLifecycle = 'permanent' | 'release' | 'experiment' | 'kill-switch' | 'ops';

export interface FeatureFlag {
  readonly id: FeatureFlagId;
  readonly key: string; // e.g. "atlas.cloud.multi-region"
  readonly name: string;
  readonly description: string;
  readonly lifecycle: FlagLifecycle;
  readonly valueType: FlagValueType;
  readonly defaultValue: unknown;
  readonly enabled: boolean; // globally enabled/disabled
  readonly rules: FlagRule[];
  readonly experimentId?: ExperimentId;
  readonly scope: FlagScope;
  readonly tags: string[];
  readonly owner?: string;
  readonly expiresAt?: Date; // prompt to clean up release flags
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FlagScope {
  readonly level: 'platform' | 'organization' | 'workspace';
  readonly allowOrgOverride: boolean;
  readonly allowWorkspaceOverride: boolean;
}

// ─── Flag Rules (targeting) ──────────────────────────────────────────────────

export interface FlagRule {
  readonly id: FlagRuleId;
  readonly name: string;
  readonly priority: number;
  readonly conditions: FlagCondition[];
  readonly value: unknown;
  readonly rolloutPercentage?: number; // 0–100; null = 100% for matched
  readonly enabled: boolean;
}

export interface FlagCondition {
  readonly attribute: string; // e.g. "organizationId", "tier", "userId"
  readonly operator: FlagConditionOperator;
  readonly value: unknown;
}

export type FlagConditionOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not-in'
  | 'contains'
  | 'starts-with'
  | 'ends-with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'matches'; // regex

// ─── Evaluation ──────────────────────────────────────────────────────────────

export interface FlagEvaluationContext {
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly userId?: string;
  readonly tier?: string;
  readonly agentVersion?: string;
  readonly sdkVersion?: string;
  readonly attributes?: Record<string, unknown>;
}

export interface FlagEvaluationResult {
  readonly flagKey: string;
  readonly value: unknown;
  readonly reason: FlagEvaluationReason;
  readonly ruleId?: FlagRuleId;
  readonly experimentId?: ExperimentId;
  readonly evaluatedAt: Date;
}

export type FlagEvaluationReason =
  | 'default'
  | 'rule-match'
  | 'rollout'
  | 'experiment'
  | 'kill-switch'
  | 'disabled'
  | 'error';

// ─── Experiments ─────────────────────────────────────────────────────────────

export interface Experiment {
  readonly id: ExperimentId;
  readonly flagId: FeatureFlagId;
  readonly name: string;
  readonly hypothesis: string;
  readonly variants: ExperimentVariant[];
  readonly status: 'draft' | 'running' | 'paused' | 'concluded';
  readonly targetingRules: FlagCondition[];
  readonly startedAt?: Date;
  readonly concludedAt?: Date;
  readonly winnerVariant?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface ExperimentVariant {
  readonly key: string;
  readonly name: string;
  readonly value: unknown;
  readonly allocationPercent: number; // must sum to 100
}

// ─── Service Interface ───────────────────────────────────────────────────────

export interface IFeatureManagementService {
  evaluate(key: string, context: FlagEvaluationContext): Promise<FlagEvaluationResult>;
  evaluateAll(context: FlagEvaluationContext): Promise<Record<string, FlagEvaluationResult>>;
  getFlag(key: string): Promise<FeatureFlag | null>;
  listFlags(scope?: Partial<FlagScope>): Promise<FeatureFlag[]>;
  create(input: CreateFlagInput): Promise<GovernanceResult<FeatureFlag>>;
  update(id: FeatureFlagId, input: UpdateFlagInput): Promise<GovernanceResult<FeatureFlag>>;
  delete(id: FeatureFlagId, by: string): Promise<GovernanceResult<void>>;
  enable(id: FeatureFlagId, by: string): Promise<GovernanceResult<void>>;
  disable(id: FeatureFlagId, by: string): Promise<GovernanceResult<void>>;
  createExperiment(input: CreateExperimentInput): Promise<GovernanceResult<Experiment>>;
  concludeExperiment(id: ExperimentId, winner: string, by: string): Promise<GovernanceResult<void>>;
}

export interface CreateFlagInput {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly lifecycle: FlagLifecycle;
  readonly valueType: FlagValueType;
  readonly defaultValue: unknown;
  readonly scope?: Partial<FlagScope>;
  readonly tags?: string[];
  readonly owner?: string;
  readonly expiresAt?: Date;
  readonly createdBy: string;
}

export interface UpdateFlagInput {
  readonly name?: string;
  readonly description?: string;
  readonly defaultValue?: unknown;
  readonly rules?: FlagRule[];
  readonly tags?: string[];
  readonly expiresAt?: Date;
  readonly updatedBy: string;
}

export interface CreateExperimentInput {
  readonly flagId: FeatureFlagId;
  readonly name: string;
  readonly hypothesis: string;
  readonly variants: ExperimentVariant[];
  readonly targetingRules?: FlagCondition[];
  readonly createdBy: string;
}
