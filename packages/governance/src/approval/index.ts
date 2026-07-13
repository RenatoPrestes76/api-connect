/**
 * @seltriva/governance — approval
 *
 * Approval workflow engine: multi-level approvals with timeouts, escalation,
 * conditional routing, and delegation.
 *
 * Any governance action can require approval — defined by policy.
 * Approvals are immutable records once resolved.
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type ApprovalRequestId = Branded<string, 'ApprovalRequestId'>;
export type ApprovalPolicyId = Branded<string, 'ApprovalPolicyId'>;

// ─── Approval Status ─────────────────────────────────────────────────────────

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'withdrawn'
  | 'escalated'
  | 'delegated';
export type ApproverStatus = 'pending' | 'approved' | 'rejected' | 'delegated' | 'abstained';
export type ApprovalUrgency = 'low' | 'normal' | 'high' | 'critical' | 'emergency';

// ─── Approval Policy ─────────────────────────────────────────────────────────

export interface ApprovalPolicy {
  readonly id: ApprovalPolicyId;
  readonly name: string;
  readonly description: string;
  readonly appliesTo: string[]; // action patterns this policy covers
  readonly stages: ApprovalStage[];
  readonly conflictOfInterest: ConflictOfInterestRule;
  readonly notifyOnDecision: boolean;
  readonly immutableOnApproval: boolean;
  readonly enabled: boolean;
}

export interface ApprovalStage {
  readonly order: number;
  readonly name: string;
  readonly approvers: ApproverSelector;
  readonly requiredCount: number; // minimum approvals needed in this stage
  readonly timeoutMinutes: number;
  readonly escalationPolicy?: EscalationPolicy;
  readonly conditions?: string[]; // stage only required if conditions true
}

export interface ApproverSelector {
  readonly type: 'role' | 'user-list' | 'group' | 'owner' | 'manager';
  readonly value: string | string[];
  readonly excludeSelf: boolean; // cannot approve own request
}

export interface EscalationPolicy {
  readonly afterMinutes: number;
  readonly escalateTo: ApproverSelector;
  readonly notifyRequester: boolean;
  readonly maxEscalations: number;
}

export interface ConflictOfInterestRule {
  readonly requesterCannotApprove: boolean;
  readonly sameTeamCannotApprove: boolean;
  readonly customRules?: string[];
}

// ─── Approval Request ────────────────────────────────────────────────────────

export interface ApprovalRequest {
  readonly id: ApprovalRequestId;
  readonly policyId?: ApprovalPolicyId;
  readonly requesterId: string;
  readonly requesterEmail: string;
  readonly organizationId: string;
  readonly action: string; // What is being approved
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly title: string;
  readonly description: string;
  readonly payload: unknown; // The change payload (what will be applied on approval)
  readonly urgency: ApprovalUrgency;
  readonly status: ApprovalStatus;
  readonly stages: ApprovalStageState[];
  readonly currentStage: number;
  readonly approvalToken: string; // Secure token for email-based approval
  readonly expiresAt: Date;
  readonly approvedAt?: Date;
  readonly rejectedAt?: Date;
  readonly withdrawnAt?: Date;
  readonly resolvedBy?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ApprovalStageState {
  readonly stage: number;
  readonly name: string;
  readonly status: 'waiting' | 'in-progress' | 'approved' | 'rejected' | 'skipped';
  readonly decisions: ApproverDecision[];
  readonly requiredCount: number;
  readonly approvedCount: number;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly expiresAt?: Date;
}

export interface ApproverDecision {
  readonly approverId: string;
  readonly approverEmail: string;
  readonly status: ApproverStatus;
  readonly comment?: string;
  readonly decidedAt: Date;
  readonly delegatedTo?: string;
  readonly ipAddress?: string;
}

// ─── Approval Service Interface ──────────────────────────────────────────────

export interface IApprovalWorkflowService {
  /**
   * Create an approval request (called by any service needing approval).
   */
  request(input: CreateApprovalRequestInput): Promise<GovernanceResult<ApprovalRequest>>;

  /**
   * Submit an approval decision.
   */
  decide(input: ApprovalDecisionInput): Promise<GovernanceResult<ApprovalRequest>>;

  /**
   * Delegate approval to another approver.
   */
  delegate(
    requestId: ApprovalRequestId,
    fromApprover: string,
    toApprover: string
  ): Promise<GovernanceResult<void>>;

  /**
   * Withdraw a pending approval request.
   */
  withdraw(requestId: ApprovalRequestId, requesterId: string): Promise<GovernanceResult<void>>;

  /**
   * Escalate a stage that has timed out.
   */
  escalate(requestId: ApprovalRequestId, stage: number): Promise<GovernanceResult<void>>;

  /**
   * Get approval request by ID.
   */
  getById(id: ApprovalRequestId): Promise<ApprovalRequest | null>;

  /**
   * List approval requests for a reviewer.
   */
  getPendingForApprover(approverId: string): Promise<ApprovalRequest[]>;

  /**
   * List approval requests submitted by a requester.
   */
  getByRequester(requesterId: string, orgId: string): Promise<ApprovalRequest[]>;

  /**
   * Check if an action requires approval before executing.
   */
  requiresApproval(action: string, orgId: string): Promise<ApprovalPolicyRequired | null>;
}

export interface CreateApprovalRequestInput {
  readonly requesterId: string;
  readonly requesterEmail: string;
  readonly organizationId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly title: string;
  readonly description: string;
  readonly payload: unknown;
  readonly urgency?: ApprovalUrgency;
  readonly policyId?: ApprovalPolicyId;
  readonly expiryHours?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface ApprovalDecisionInput {
  readonly requestId: ApprovalRequestId;
  readonly approverId: string;
  readonly decision: 'approve' | 'reject' | 'abstain';
  readonly comment?: string;
  readonly approvalToken?: string; // from email link
}

export interface ApprovalPolicyRequired {
  readonly policyId: ApprovalPolicyId;
  readonly policyName: string;
  readonly stages: number;
  readonly estimatedResolutionMinutes: number;
}
