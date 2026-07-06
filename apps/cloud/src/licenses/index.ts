/**
 * @seltriva/cloud — licenses
 * License management: activation, validation, feature access, expiry monitoring.
 */

import type {
  License, LicenseId, OrganizationId, UserId,
  OrganizationTier, LicenseStatus, DomainResult,
} from '../domain/index';

export interface ILicenseService {
  activate(orgId: OrganizationId, licenseKey: string, actorId: UserId): Promise<DomainResult<License>>;
  revoke(licenseId: LicenseId, reason: string, actorId: UserId): Promise<DomainResult<void>>;
  getActiveForOrganization(orgId: OrganizationId): Promise<License | null>;
  getAllForOrganization(orgId: OrganizationId): Promise<License[]>;
  checkExpiring(daysAhead?: number): Promise<License[]>;
  validateFeature(orgId: OrganizationId, feature: LicenseFeature): Promise<FeatureAccessResult>;
  validateAgentLimit(orgId: OrganizationId): Promise<CapacityResult>;
  validateWorkspaceLimit(orgId: OrganizationId): Promise<CapacityResult>;
  validateUserLimit(orgId: OrganizationId): Promise<CapacityResult>;
  generateKey(tier: OrganizationTier, options: LicenseKeyOptions): string;
}

export interface LicenseKeyOptions {
  readonly expiresAt?: Date;
  readonly maxAgents?: number;
  readonly maxWorkspaces?: number;
  readonly maxUsers?: number;
  readonly features?: LicenseFeature[];
  readonly metadata?: Record<string, unknown>;
}

export interface FeatureAccessResult {
  readonly allowed: boolean;
  readonly feature: LicenseFeature;
  readonly reason?: string;
  readonly upgradeRequired?: OrganizationTier;
}

export interface CapacityResult {
  readonly allowed: boolean;
  readonly current: number;
  readonly limit: number;
  readonly remaining: number;
  readonly upgradeRequired?: OrganizationTier;
}

export type LicenseFeature =
  | 'advanced-analytics'
  | 'custom-plugins'
  | 'sso'
  | 'audit-export'
  | 'advanced-security'
  | 'priority-support'
  | 'custom-branding'
  | 'api-access'
  | 'webhook-notifications'
  | 'dedicated-infrastructure'
  | 'sla-99-9'
  | 'unlimited-history';

export const TIER_FEATURES: Record<OrganizationTier, LicenseFeature[]> = {
  FREE:       ['api-access'],
  STARTER:    ['api-access', 'webhook-notifications', 'audit-export'],
  PRO:        ['api-access', 'webhook-notifications', 'audit-export', 'advanced-analytics', 'custom-plugins', 'sso'],
  ENTERPRISE: ['api-access', 'webhook-notifications', 'audit-export', 'advanced-analytics',
               'custom-plugins', 'sso', 'advanced-security', 'priority-support', 'custom-branding',
               'dedicated-infrastructure', 'sla-99-9', 'unlimited-history'],
} as const;

export const TIER_LIMITS: Record<OrganizationTier, { agents: number; workspaces: number; users: number }> = {
  FREE:       { agents: 2,  workspaces: 1,   users: 3 },
  STARTER:    { agents: 10, workspaces: 5,   users: 15 },
  PRO:        { agents: 50, workspaces: 25,  users: 100 },
  ENTERPRISE: { agents: -1, workspaces: -1,  users: -1 },  // -1 = unlimited
} as const;

export interface LicenseValidationReport {
  readonly licenseId: LicenseId;
  readonly organizationId: OrganizationId;
  readonly tier: OrganizationTier;
  readonly status: LicenseStatus;
  readonly valid: boolean;
  readonly daysRemaining?: number;
  readonly errors: string[];
  readonly warnings: string[];
  readonly features: LicenseFeature[];
  readonly capacities: {
    agents: CapacityResult;
    workspaces: CapacityResult;
    users: CapacityResult;
  };
}

export interface LicenseExpiryAlert {
  readonly licenseId: LicenseId;
  readonly organizationId: OrganizationId;
  readonly tier: OrganizationTier;
  readonly expiresAt: Date;
  readonly daysRemaining: number;
  readonly alertLevel: 'info' | 'warning' | 'critical';
}
