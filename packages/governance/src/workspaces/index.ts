/**
 * @seltriva/governance — workspaces
 * Workspace governance: isolation rules, environment promotion gates, access controls.
 */

import type { PolicyId, GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type WorkspaceGovernanceId = Branded<string, 'WorkspaceGovernanceId'>;

export interface WorkspaceGovernancePolicy {
  readonly id: WorkspaceGovernanceId;
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly isolationLevel: WorkspaceIsolationLevel;
  readonly promotionGates: PromotionGate[];
  readonly accessControl: WorkspaceAccessControl;
  readonly policies: PolicyId[];
  readonly featureFlagOverrides: Record<string, boolean>;
  readonly updatedAt: Date;
}

export type WorkspaceIsolationLevel = 'shared' | 'isolated' | 'dedicated';

export interface PromotionGate {
  readonly id: string;
  readonly name: string;
  readonly fromEnvironment: string;
  readonly toEnvironment: string;
  readonly requireApproval: boolean;
  readonly requiredApprovers?: string[];
  readonly requiredChecks: PromotionCheck[];
  readonly cooldownMinutes?: number;
}

export interface PromotionCheck {
  readonly id: string;
  readonly type: 'health' | 'test' | 'compliance' | 'manual' | 'policy';
  readonly name: string;
  readonly required: boolean;
  readonly timeoutMinutes?: number;
}

export interface WorkspaceAccessControl {
  readonly defaultRole?: string;
  readonly memberOverrides: Array<{ userId: string; role: string }>;
  readonly inheritOrgPolicies: boolean;
  readonly allowGuestAccess: boolean;
}

export interface IWorkspaceGovernanceService {
  getPolicy(workspaceId: string): Promise<WorkspaceGovernancePolicy | null>;
  setPolicy(input: SetWorkspaceGovernancePolicyInput): Promise<GovernanceResult<WorkspaceGovernancePolicy>>;
  evaluatePromotionGate(workspaceId: string, from: string, to: string): Promise<PromotionGateResult>;
  listPromotionGates(workspaceId: string): Promise<PromotionGate[]>;
}

export interface SetWorkspaceGovernancePolicyInput {
  readonly workspaceId: string;
  readonly isolationLevel?: WorkspaceIsolationLevel;
  readonly promotionGates?: PromotionGate[];
  readonly accessControl?: Partial<WorkspaceAccessControl>;
  readonly updatedBy: string;
}

export interface PromotionGateResult {
  readonly allowed: boolean;
  readonly fromEnvironment: string;
  readonly toEnvironment: string;
  readonly checksRequired: PromotionCheck[];
  readonly checksPassed: string[];
  readonly checksFailed: string[];
  readonly blockedReason?: string;
  readonly requiresApproval: boolean;
}
