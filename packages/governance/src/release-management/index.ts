/**
 * @seltriva/governance — release-management
 *
 * Release lifecycle governance: release planning, gate enforcement,
 * environment promotion, rollback, and release train coordination.
 *
 * A Release is a formally governed change to the platform.
 * Each release must pass all gates before promotion.
 */

import type { GovernanceResult } from '../policies/index';
import type { ChangeRequestId } from '../change-management/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type ReleaseId = Branded<string, 'ReleaseId'>;
export type ReleaseGateId = Branded<string, 'ReleaseGateId'>;
export type ReleasePlanId = Branded<string, 'ReleasePlanId'>;

// ─── Release ─────────────────────────────────────────────────────────────────

export type ReleaseType = 'major' | 'minor' | 'patch' | 'hotfix' | 'rollback';
export type ReleaseStatus =
  | 'planned'
  | 'preparing'
  | 'gating'
  | 'approved'
  | 'promoting'
  | 'live'
  | 'rolled-back'
  | 'cancelled';
export type ReleaseChannel = 'internal' | 'beta' | 'stable' | 'lts';

export interface Release {
  readonly id: ReleaseId;
  readonly number: string; // "RELEASE-2024.001"
  readonly version: string; // semver: "1.2.0"
  readonly type: ReleaseType;
  readonly channel: ReleaseChannel;
  readonly status: ReleaseStatus;
  readonly title: string;
  readonly description: string;
  readonly components: ReleaseComponent[];
  readonly changeRequests: ChangeRequestId[];
  readonly plan?: ReleasePlanId;
  readonly gates: ReleaseGateState[];
  readonly promotionHistory: ReleasePromotion[];
  readonly currentEnvironment?: string;
  readonly targetEnvironments: string[];
  readonly scheduledAt?: Date;
  readonly promotedToStableAt?: Date;
  readonly rolledBackAt?: Date;
  readonly rollbackTarget?: string; // version to roll back to
  readonly releaseManager: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ReleaseComponent {
  readonly name: string; // "atlas-cloud", "atlas-agent", "plugin-sdk"
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly breaking: boolean;
  readonly changelog: string[];
}

// ─── Release Gates ───────────────────────────────────────────────────────────

export interface ReleaseGate {
  readonly id: ReleaseGateId;
  readonly name: string;
  readonly type: GateType;
  readonly required: boolean;
  readonly automatable: boolean;
  readonly timeoutMinutes?: number;
  readonly criteria?: string;
}

export type GateType =
  | 'automated-test'
  | 'security-scan'
  | 'performance-benchmark'
  | 'manual-approval'
  | 'compliance-check'
  | 'canary-health'
  | 'soak-period'
  | 'sign-off';

export interface ReleaseGateState {
  readonly gateId: ReleaseGateId;
  readonly name: string;
  readonly status: 'pending' | 'in-progress' | 'passed' | 'failed' | 'skipped' | 'waived';
  readonly result?: string;
  readonly evidence?: string;
  readonly waivedBy?: string;
  readonly waivedReason?: string;
  readonly evaluatedAt?: Date;
}

// ─── Promotion ───────────────────────────────────────────────────────────────

export interface ReleasePromotion {
  readonly fromEnvironment: string;
  readonly toEnvironment: string;
  readonly promotedBy: string;
  readonly gatesPassed: string[];
  readonly promotedAt: Date;
}

// ─── Release Plan ────────────────────────────────────────────────────────────

export interface ReleasePlan {
  readonly id: ReleasePlanId;
  readonly releaseId: ReleaseId;
  readonly name: string;
  readonly stages: ReleasePlanStage[];
  readonly requiredGates: ReleaseGateId[];
  readonly communicationPlan: string;
  readonly rollbackCriteria: string;
  readonly approvedBy?: string;
  readonly approvedAt?: Date;
  readonly createdAt: Date;
}

export interface ReleasePlanStage {
  readonly order: number;
  readonly name: string;
  readonly environment: string;
  readonly gates: ReleaseGateId[];
  readonly soakPeriodHours?: number;
  readonly requiredSignOffs?: string[];
  readonly notifyChannels?: string[];
}

// ─── Service Interface ───────────────────────────────────────────────────────

export interface IReleaseManagementService {
  create(input: CreateReleaseInput): Promise<GovernanceResult<Release>>;
  createPlan(
    releaseId: ReleaseId,
    plan: CreateReleasePlanInput
  ): Promise<GovernanceResult<ReleasePlan>>;
  evaluateGate(
    releaseId: ReleaseId,
    gateId: ReleaseGateId,
    result: GateEvaluationInput
  ): Promise<GovernanceResult<ReleaseGateState>>;
  waiverGate(
    releaseId: ReleaseId,
    gateId: ReleaseGateId,
    reason: string,
    by: string
  ): Promise<GovernanceResult<void>>;
  promote(
    releaseId: ReleaseId,
    toEnvironment: string,
    by: string
  ): Promise<GovernanceResult<Release>>;
  rollback(
    releaseId: ReleaseId,
    targetVersion: string,
    reason: string,
    by: string
  ): Promise<GovernanceResult<Release>>;
  cancel(releaseId: ReleaseId, reason: string, by: string): Promise<GovernanceResult<Release>>;
  getById(id: ReleaseId): Promise<Release | null>;
  list(filter: ReleaseListFilter): Promise<Release[]>;
  listGates(): Promise<ReleaseGate[]>;
}

export interface CreateReleaseInput {
  readonly version: string;
  readonly type: ReleaseType;
  readonly channel: ReleaseChannel;
  readonly title: string;
  readonly description: string;
  readonly components: Omit<ReleaseComponent, 'changelog'>[];
  readonly changeRequests?: ChangeRequestId[];
  readonly targetEnvironments: string[];
  readonly scheduledAt?: Date;
  readonly releaseManager: string;
}

export interface CreateReleasePlanInput {
  readonly name: string;
  readonly stages: Omit<ReleasePlanStage, 'order'>[];
  readonly requiredGates: ReleaseGateId[];
  readonly communicationPlan: string;
  readonly rollbackCriteria: string;
}

export interface GateEvaluationInput {
  readonly status: 'passed' | 'failed';
  readonly result: string;
  readonly evidence?: string;
  readonly evaluatedBy?: string;
}

export interface ReleaseListFilter {
  readonly status?: ReleaseStatus[];
  readonly type?: ReleaseType;
  readonly channel?: ReleaseChannel;
  readonly releaseManager?: string;
  readonly since?: Date;
  readonly until?: Date;
}
