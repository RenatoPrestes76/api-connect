/**
 * @seltriva/governance — organizations
 * Governance policies for the organization layer:
 * lifecycle rules, member governance, tier enforcement, and org-level policy binding.
 */

import type { PolicyId, GovernanceResult } from '../policies/index';
import type { RoleId } from '../rbac/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type OrgGovernanceId = Branded<string, 'OrgGovernanceId'>;

// ─── Organization Governance Policy ─────────────────────────────────────────

export interface OrgGovernancePolicy {
  readonly id: OrgGovernanceId;
  readonly organizationId: string;
  readonly policies: PolicyId[];
  readonly membershipRules: MembershipRule[];
  readonly tierRules: TierRule[];
  readonly securityProfile: OrgSecurityProfile;
  readonly complianceRequirements: string[]; // compliance framework IDs
  readonly retentionPolicy: RetentionPolicy;
  readonly updatedAt: Date;
}

export interface MembershipRule {
  readonly id: string;
  readonly name: string;
  readonly condition: string; // expression: e.g. "@.email ends-with '@acme.com'"
  readonly autoAssignRole: RoleId;
  readonly requireMFA: boolean;
  readonly requireSSO: boolean;
  readonly allowedDomains?: string[];
  readonly blockedDomains?: string[];
}

export interface TierRule {
  readonly tier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  readonly maxAgents: number;
  readonly maxWorkspaces: number;
  readonly maxUsers: number;
  readonly maxPlugins: number;
  readonly featuresEnabled: string[];
  readonly policiesApplied: PolicyId[];
}

export interface OrgSecurityProfile {
  readonly requireMFA: boolean;
  readonly requireSSO: boolean;
  readonly allowedIPRanges?: string[];
  readonly sessionTimeoutMinutes: number;
  readonly maxAPIKeysPerUser: number;
  readonly apiKeyExpiryDays?: number;
  readonly requireSigning: boolean;
  readonly encryptionLevel: 'standard' | 'enhanced' | 'maximum';
}

export interface RetentionPolicy {
  readonly auditLogDays: number;
  readonly metricsDays: number;
  readonly notificationDays: number;
  readonly softDeleteDays: number; // days before hard delete
  readonly backupRetentionDays: number;
}

// ─── Org Governance Service ──────────────────────────────────────────────────

export interface IOrgGovernanceService {
  getPolicy(organizationId: string): Promise<OrgGovernancePolicy | null>;
  setPolicy(input: SetOrgGovernancePolicyInput): Promise<GovernanceResult<OrgGovernancePolicy>>;
  evaluateMembershipRules(
    organizationId: string,
    candidate: MembershipCandidate
  ): Promise<MembershipEvaluationResult>;
  enforceTierLimits(organizationId: string): Promise<TierLimitReport>;
  getSecurityProfile(organizationId: string): Promise<OrgSecurityProfile>;
}

export interface SetOrgGovernancePolicyInput {
  readonly organizationId: string;
  readonly membershipRules?: MembershipRule[];
  readonly securityProfile?: Partial<OrgSecurityProfile>;
  readonly retentionPolicy?: Partial<RetentionPolicy>;
  readonly updatedBy: string;
}

export interface MembershipCandidate {
  readonly email: string;
  readonly domain: string;
  readonly ssoVerified: boolean;
  readonly mfaEnabled: boolean;
}

export interface MembershipEvaluationResult {
  readonly allowed: boolean;
  readonly autoAssignRole?: RoleId;
  readonly requireMFA: boolean;
  readonly requireSSO: boolean;
  readonly blockedReason?: string;
}

export interface TierLimitReport {
  readonly organizationId: string;
  readonly tier: string;
  readonly agents: { current: number; limit: number; exceeded: boolean };
  readonly workspaces: { current: number; limit: number; exceeded: boolean };
  readonly users: { current: number; limit: number; exceeded: boolean };
  readonly plugins: { current: number; limit: number; exceeded: boolean };
  readonly generatedAt: Date;
}
