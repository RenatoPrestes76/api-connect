/**
 * @seltriva/governance — change-management
 *
 * Change Management: ITIL-inspired change request lifecycle.
 * All production changes go through a formal CR process.
 *
 * Change types:
 *   - Standard:   pre-approved, low-risk, repeatable
 *   - Normal:     requires full approval workflow
 *   - Emergency:  expedited — post-approval allowed
 *   - Automated:  triggered by pipeline, minimal human review
 */

import type { ApprovalRequestId } from '../approval/index';
import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type ChangeRequestId = Branded<string, 'ChangeRequestId'>;
export type DeploymentPlanId = Branded<string, 'DeploymentPlanId'>;
export type ChangeRecordId = Branded<string, 'ChangeRecordId'>;

// ─── Change Request ──────────────────────────────────────────────────────────

export type ChangeType = 'standard' | 'normal' | 'emergency' | 'automated';
export type ChangePriority = 'low' | 'medium' | 'high' | 'critical';
export type ChangeRisk = 'low' | 'medium' | 'high' | 'very-high';
export type ChangeStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'implementing'
  | 'completed'
  | 'failed'
  | 'rolled-back'
  | 'cancelled';
export type ChangeCategory =
  | 'deployment'
  | 'configuration'
  | 'infrastructure'
  | 'security'
  | 'plugin'
  | 'schema'
  | 'rollback'
  | 'maintenance';

export interface ChangeRequest {
  readonly id: ChangeRequestId;
  readonly number: string; // human-readable: "CR-2024-0001"
  readonly organizationId: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly type: ChangeType;
  readonly category: ChangeCategory;
  readonly priority: ChangePriority;
  readonly risk: ChangeRisk;
  readonly status: ChangeStatus;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly impact: ChangeImpact;
  readonly rollbackPlan: RollbackPlan;
  readonly implementationSteps: ImplementationStep[];
  readonly approvalRequestId?: ApprovalRequestId;
  readonly deploymentPlanId?: DeploymentPlanId;
  readonly requestedBy: string;
  readonly assignedTo?: string;
  readonly scheduledFor?: Date;
  readonly implementedAt?: Date;
  readonly completedAt?: Date;
  readonly resolvedBy?: string;
  readonly postImplementationReview?: PostImplementationReview;
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ChangeImpact {
  readonly scope: 'isolated' | 'limited' | 'significant' | 'extensive';
  readonly affectedComponents: string[];
  readonly affectedEnvironments: string[];
  readonly estimatedDowntimeMinutes: number;
  readonly requiresMaintenanceWindow: boolean;
  readonly customerFacing: boolean;
  readonly dataImpact: 'none' | 'read-only' | 'modification' | 'deletion';
}

export interface RollbackPlan {
  readonly available: boolean;
  readonly strategy:
    | 'revert-commit'
    | 'snapshot-restore'
    | 'manual-steps'
    | 'blue-green-swap'
    | 'not-applicable';
  readonly estimatedRollbackMinutes: number;
  readonly steps: string[];
  readonly dataRecoverable: boolean;
  readonly rollbackWindowHours: number; // window after deployment where rollback is possible
}

export interface ImplementationStep {
  readonly order: number;
  readonly name: string;
  readonly description: string;
  readonly automated: boolean;
  readonly estimatedMinutes: number;
  readonly rollbackStep?: string;
  readonly checkpoints?: string[];
}

export interface PostImplementationReview {
  readonly completedAt: Date;
  readonly outcome: 'success' | 'partial' | 'failed';
  readonly observations: string;
  readonly lessonsLearned?: string;
  readonly followUpActions?: string[];
}

// ─── Deployment Plan ─────────────────────────────────────────────────────────

export interface DeploymentPlan {
  readonly id: DeploymentPlanId;
  readonly changeRequestId: ChangeRequestId;
  readonly organizationId: string;
  readonly environmentId: string;
  readonly strategy: DeploymentStrategy;
  readonly phases: DeploymentPhase[];
  readonly rollbackSteps: DeploymentRollbackStep[];
  readonly successCriteria: SuccessCriterion[];
  readonly maxDurationMinutes: number;
  readonly autoRollbackOnFailure: boolean;
  readonly approvedAt?: Date;
  readonly status: 'draft' | 'approved' | 'executing' | 'completed' | 'rolled-back';
  readonly executionLog?: DeploymentEvent[];
  readonly createdAt: Date;
}

export type DeploymentStrategy =
  | 'rolling' // gradual node-by-node
  | 'blue-green' // instant swap between environments
  | 'canary' // percentage-based traffic shift
  | 'all-at-once' // simultaneous (fast but high risk)
  | 'shadow' // deploy alongside, validate, then switch
  | 'feature-flag'; // deploy behind a flag, enable gradually;

export interface DeploymentPhase {
  readonly order: number;
  readonly name: string;
  readonly type: 'pre-check' | 'deploy' | 'validate' | 'post-check' | 'notify';
  readonly tasks: DeploymentTask[];
  readonly continueOnFailure: boolean;
  readonly timeoutMinutes: number;
}

export interface DeploymentTask {
  readonly id: string;
  readonly name: string;
  readonly command?: string;
  readonly automated: boolean;
  readonly required: boolean;
  readonly timeoutMinutes?: number;
}

export interface DeploymentRollbackStep {
  readonly order: number;
  readonly name: string;
  readonly automated: boolean;
  readonly command?: string;
  readonly timeoutMinutes?: number;
}

export interface SuccessCriterion {
  readonly name: string;
  readonly type: 'metric' | 'health-check' | 'manual-sign-off' | 'zero-errors';
  readonly threshold?: number;
  readonly timeWindowMinutes?: number;
}

export interface DeploymentEvent {
  readonly timestamp: Date;
  readonly phase: string;
  readonly task?: string;
  readonly status: 'started' | 'completed' | 'failed' | 'skipped';
  readonly message?: string;
}

// ─── Change History ──────────────────────────────────────────────────────────

export interface ChangeRecord {
  readonly id: ChangeRecordId;
  readonly changeRequestId: ChangeRequestId;
  readonly event: ChangeHistoryEvent;
  readonly actorId: string;
  readonly actorEmail: string;
  readonly comment?: string;
  readonly snapshot?: unknown; // state snapshot at this point
  readonly occurredAt: Date;
}

export type ChangeHistoryEvent =
  | 'created'
  | 'submitted'
  | 'assigned'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'implementation-started'
  | 'implementation-completed'
  | 'rollback-initiated'
  | 'rollback-completed'
  | 'cancelled'
  | 'pir-submitted';

// ─── Change Management Service Interface ────────────────────────────────────

export interface IChangeManagementService {
  create(input: CreateChangeRequestInput): Promise<GovernanceResult<ChangeRequest>>;
  submit(id: ChangeRequestId, by: string): Promise<GovernanceResult<ChangeRequest>>;
  approve(
    id: ChangeRequestId,
    by: string,
    comment?: string
  ): Promise<GovernanceResult<ChangeRequest>>;
  reject(id: ChangeRequestId, by: string, reason: string): Promise<GovernanceResult<ChangeRequest>>;
  schedule(
    id: ChangeRequestId,
    scheduledFor: Date,
    by: string
  ): Promise<GovernanceResult<ChangeRequest>>;
  startImplementation(id: ChangeRequestId, by: string): Promise<GovernanceResult<ChangeRequest>>;
  complete(
    id: ChangeRequestId,
    by: string,
    pir?: PostImplementationReview
  ): Promise<GovernanceResult<ChangeRequest>>;
  initiateRollback(
    id: ChangeRequestId,
    reason: string,
    by: string
  ): Promise<GovernanceResult<ChangeRequest>>;
  cancel(id: ChangeRequestId, reason: string, by: string): Promise<GovernanceResult<ChangeRequest>>;
  getById(id: ChangeRequestId): Promise<ChangeRequest | null>;
  getHistory(id: ChangeRequestId): Promise<ChangeRecord[]>;
  list(filter: ChangeRequestFilter): Promise<ChangeRequest[]>;
  createDeploymentPlan(
    crId: ChangeRequestId,
    plan: CreateDeploymentPlanInput
  ): Promise<GovernanceResult<DeploymentPlan>>;
}

export interface CreateChangeRequestInput {
  readonly organizationId: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly type: ChangeType;
  readonly category: ChangeCategory;
  readonly priority: ChangePriority;
  readonly risk: ChangeRisk;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly impact: ChangeImpact;
  readonly rollbackPlan: RollbackPlan;
  readonly implementationSteps: Omit<ImplementationStep, 'order'>[];
  readonly requestedBy: string;
  readonly scheduledFor?: Date;
  readonly tags?: string[];
}

export interface CreateDeploymentPlanInput {
  readonly environmentId: string;
  readonly strategy: DeploymentStrategy;
  readonly phases: Omit<DeploymentPhase, 'order'>[];
  readonly rollbackSteps: Omit<DeploymentRollbackStep, 'order'>[];
  readonly successCriteria: SuccessCriterion[];
  readonly maxDurationMinutes?: number;
  readonly autoRollbackOnFailure?: boolean;
}

export interface ChangeRequestFilter {
  readonly organizationId: string;
  readonly environmentId?: string;
  readonly status?: ChangeStatus[];
  readonly type?: ChangeType;
  readonly category?: ChangeCategory;
  readonly requestedBy?: string;
  readonly since?: Date;
  readonly until?: Date;
}
