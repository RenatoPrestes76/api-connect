/**
 * @seltriva/governance — tenant-isolation
 *
 * Tenant isolation architecture: boundary enforcement, data segregation,
 * network policy, and cross-tenant access prevention.
 *
 * Every resource in the system belongs to a tenant boundary.
 * Cross-tenant access is denied by default and requires explicit policy.
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type TenantBoundaryId = Branded<string, 'TenantBoundaryId'>;
export type IsolationPolicyId = Branded<string, 'IsolationPolicyId'>;

// ─── Isolation Levels ────────────────────────────────────────────────────────

export type IsolationLevel =
  | 'shared' // same infra, logical isolation only (row-level security)
  | 'pooled' // shared pool, resource quotas per tenant
  | 'siloed' // dedicated compute, shared control plane
  | 'dedicated'; // fully dedicated infra and control plane

// ─── Tenant Boundary ─────────────────────────────────────────────────────────

export interface TenantBoundary {
  readonly id: TenantBoundaryId;
  readonly organizationId: string;
  readonly isolationLevel: IsolationLevel;
  readonly dataResidency: DataResidency;
  readonly networkPolicy: TenantNetworkPolicy;
  readonly resourceQuotas: TenantResourceQuotas;
  readonly crossTenantRules: CrossTenantRule[];
  readonly complianceRequirements: string[]; // required compliance framework IDs
  readonly encryptionPolicy: TenantEncryptionPolicy;
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DataResidency {
  readonly primaryRegion: string; // e.g. "br-south-1"
  readonly allowedRegions: string[];
  readonly replicationAllowed: boolean;
  readonly crossBorderTransferAllowed: boolean;
  readonly dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface TenantNetworkPolicy {
  readonly ingressWhitelist?: string[]; // CIDR blocks allowed in
  readonly egressRestricted: boolean;
  readonly allowedEgressCIDRs?: string[];
  readonly privateLinkEnabled: boolean;
  readonly vpnRequired: boolean;
  readonly tlsMinVersion: '1.2' | '1.3';
  readonly allowedCipherSuites?: string[];
}

export interface TenantResourceQuotas {
  readonly maxApiRequestsPerMinute: number;
  readonly maxStorageGb: number;
  readonly maxConcurrentConnections: number;
  readonly maxAgents: number;
  readonly maxWorkspaces: number;
  readonly maxSecretsStored: number;
  readonly maxAuditRetentionDays: number;
}

export interface CrossTenantRule {
  readonly id: string;
  readonly name: string;
  readonly targetTenantId: string;
  readonly allowedActions: string[];
  readonly resourceTypes: string[];
  readonly conditions?: string[];
  readonly requiresApproval: boolean;
  readonly expiresAt?: Date;
  readonly grantedBy: string;
}

export interface TenantEncryptionPolicy {
  readonly atRest: EncryptionSpec;
  readonly inTransit: EncryptionSpec;
  readonly kmsKeyId?: string; // customer-managed KMS key
  readonly customerManagedKeys: boolean;
  readonly keyRotationDays: number;
}

export interface EncryptionSpec {
  readonly algorithm: string; // e.g. "AES-256-GCM"
  readonly keyLength: 128 | 192 | 256;
}

// ─── Isolation Violation ─────────────────────────────────────────────────────

export interface IsolationViolation {
  readonly id: string;
  readonly requestId: string;
  readonly tenantBoundaryId: TenantBoundaryId;
  readonly requestingOrganizationId: string;
  readonly targetOrganizationId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly violationType: ViolationType;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly blocked: boolean;
  readonly detectedAt: Date;
}

export type ViolationType =
  | 'cross-tenant-data-access'
  | 'unauthorized-api-call'
  | 'resource-enumeration'
  | 'credential-leakage'
  | 'network-boundary-breach'
  | 'storage-cross-access';

// ─── Service Interface ───────────────────────────────────────────────────────

export interface ITenantIsolationService {
  /**
   * Get or create the boundary definition for an organization.
   */
  getBoundary(organizationId: string): Promise<TenantBoundary | null>;
  setBoundary(input: SetTenantBoundaryInput): Promise<GovernanceResult<TenantBoundary>>;

  /**
   * Enforce isolation on an incoming request.
   * Returns true if access is allowed, throws if not.
   */
  enforce(request: IsolationEnforcementRequest): Promise<IsolationEnforcementResult>;

  /**
   * Record and optionally alert on a detected violation.
   */
  recordViolation(violation: Omit<IsolationViolation, 'id' | 'detectedAt'>): Promise<void>;

  /**
   * List violations for audit and review.
   */
  listViolations(orgId: string, filter?: ViolationFilter): Promise<IsolationViolation[]>;

  /**
   * Add a cross-tenant access grant.
   */
  grantCrossTenantAccess(input: CrossTenantGrantInput): Promise<GovernanceResult<CrossTenantRule>>;
  revokeCrossTenantAccess(
    orgId: string,
    ruleId: string,
    by: string
  ): Promise<GovernanceResult<void>>;

  /**
   * Check if two organizations may communicate.
   */
  canCommunicate(requestingOrgId: string, targetOrgId: string, action: string): Promise<boolean>;
}

export interface SetTenantBoundaryInput {
  readonly organizationId: string;
  readonly isolationLevel?: IsolationLevel;
  readonly dataResidency?: Partial<DataResidency>;
  readonly networkPolicy?: Partial<TenantNetworkPolicy>;
  readonly resourceQuotas?: Partial<TenantResourceQuotas>;
  readonly encryptionPolicy?: Partial<TenantEncryptionPolicy>;
  readonly updatedBy: string;
}

export interface IsolationEnforcementRequest {
  readonly requestingOrganizationId: string;
  readonly targetOrganizationId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly requestId?: string;
}

export interface IsolationEnforcementResult {
  readonly allowed: boolean;
  readonly reason: string;
  readonly ruleId?: string;
  readonly requiresApproval?: boolean;
}

export interface ViolationFilter {
  readonly severity?: IsolationViolation['severity'];
  readonly violationType?: ViolationType;
  readonly blocked?: boolean;
  readonly since?: Date;
  readonly until?: Date;
}

export interface CrossTenantGrantInput {
  readonly requestingOrgId: string;
  readonly targetOrgId: string;
  readonly name: string;
  readonly allowedActions: string[];
  readonly resourceTypes: string[];
  readonly conditions?: string[];
  readonly requiresApproval?: boolean;
  readonly expiresAt?: Date;
  readonly grantedBy: string;
}
