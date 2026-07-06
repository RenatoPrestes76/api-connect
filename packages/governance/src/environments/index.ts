/**
 * @seltriva/governance — environments
 * Environment governance: access tiers, change windows, lockdown, and promotion policies.
 */

import type { PolicyId, GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type EnvironmentGovernanceId = Branded<string, 'EnvironmentGovernanceId'>;

export type EnvironmentTier = 'development' | 'staging' | 'qa' | 'uat' | 'production' | 'dr';
export type ChangeWindowStatus = 'open' | 'closed' | 'restricted' | 'emergency-only';

export interface EnvironmentGovernancePolicy {
  readonly id: EnvironmentGovernanceId;
  readonly environmentId: string;
  readonly workspaceId: string;
  readonly tier: EnvironmentTier;
  readonly policies: PolicyId[];
  readonly changeWindow: ChangeWindow;
  readonly lockdownPolicy: EnvironmentLockdown;
  readonly accessRestrictions: EnvironmentAccessRestriction[];
  readonly notificationRules: EnvironmentNotificationRule[];
  readonly updatedAt: Date;
}

export interface ChangeWindow {
  readonly status: ChangeWindowStatus;
  readonly schedule?: ChangeWindowSchedule;
  readonly requireApproval: boolean;
  readonly allowEmergency: boolean;
  readonly emergencyApprovers?: string[];
  readonly frozenUntil?: Date;
  readonly frozenReason?: string;
}

export interface ChangeWindowSchedule {
  readonly timezone: string;
  readonly allowedDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  readonly allowedHoursStart: string;   // "HH:MM"
  readonly allowedHoursEnd: string;     // "HH:MM"
}

export interface EnvironmentLockdown {
  readonly locked: boolean;
  readonly lockedAt?: Date;
  readonly lockedBy?: string;
  readonly lockedReason?: string;
  readonly allowedActions: string[];    // actions allowed even when locked
  readonly autoUnlockAt?: Date;
}

export interface EnvironmentAccessRestriction {
  readonly id: string;
  readonly name: string;
  readonly allowedRoles: string[];
  readonly requireMFA: boolean;
  readonly requireJustification: boolean;
  readonly ipAllowlist?: string[];
  readonly timeRestriction?: ChangeWindowSchedule;
}

export interface EnvironmentNotificationRule {
  readonly event: EnvironmentEvent;
  readonly channels: string[];
  readonly recipients: string[];
}

export type EnvironmentEvent =
  | 'deployment-started'
  | 'deployment-completed'
  | 'deployment-failed'
  | 'environment-locked'
  | 'environment-unlocked'
  | 'change-window-closed'
  | 'agent-offline'
  | 'policy-denied';

export interface IEnvironmentGovernanceService {
  getPolicy(environmentId: string): Promise<EnvironmentGovernancePolicy | null>;
  setPolicy(input: SetEnvironmentGovernancePolicyInput): Promise<GovernanceResult<EnvironmentGovernancePolicy>>;
  lockEnvironment(environmentId: string, reason: string, by: string, until?: Date): Promise<GovernanceResult<void>>;
  unlockEnvironment(environmentId: string, by: string): Promise<GovernanceResult<void>>;
  isChangeAllowed(environmentId: string, action: string): Promise<ChangeAllowedResult>;
  freezeChangeWindow(environmentId: string, until: Date, reason: string, by: string): Promise<GovernanceResult<void>>;
}

export interface SetEnvironmentGovernancePolicyInput {
  readonly environmentId: string;
  readonly tier?: EnvironmentTier;
  readonly changeWindow?: Partial<ChangeWindow>;
  readonly accessRestrictions?: EnvironmentAccessRestriction[];
  readonly updatedBy: string;
}

export interface ChangeAllowedResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly changeWindowStatus: ChangeWindowStatus;
  readonly requiresApproval: boolean;
  readonly alternativeWindow?: string;
}
