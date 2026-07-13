/**
 * @seltriva/governance — secret-management
 *
 * Secret vault architecture: encrypted storage, rotation policies,
 * access control, audit, and zero-trust secret distribution.
 *
 * Secrets are NEVER returned in plain text via list operations.
 * Access is subject to policy evaluation and full audit.
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type SecretId = Branded<string, 'SecretId'>;
export type SecretVersionId = Branded<string, 'SecretVersionId'>;
export type RotationPolicyId = Branded<string, 'RotationPolicyId'>;

// ─── Secret Types ────────────────────────────────────────────────────────────

export type SecretKind =
  | 'password'
  | 'api-key'
  | 'oauth-client-secret'
  | 'private-key'
  | 'certificate'
  | 'connection-string'
  | 'token'
  | 'symmetric-key'
  | 'webhook-secret'
  | 'cloud-credential'
  | 'custom';

export type SecretStatus =
  | 'active'
  | 'inactive'
  | 'expired'
  | 'compromised'
  | 'pending-rotation'
  | 'archived';

// ─── Secret ──────────────────────────────────────────────────────────────────

export interface Secret {
  readonly id: SecretId;
  readonly name: string;
  readonly description?: string;
  readonly kind: SecretKind;
  readonly status: SecretStatus;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly currentVersionId: SecretVersionId;
  readonly rotationPolicyId?: RotationPolicyId;
  readonly tags: string[];
  readonly allowedConsumers: SecretConsumer[]; // who can read this secret
  readonly expiresAt?: Date;
  readonly lastRotatedAt?: Date;
  readonly nextRotationAt?: Date;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SecretVersion {
  readonly id: SecretVersionId;
  readonly secretId: SecretId;
  readonly version: number;
  readonly status: 'active' | 'inactive' | 'deprecated';
  readonly encryptionKeyId: string; // references KMS key
  readonly checksum: string; // SHA-256 of plaintext (stored encrypted)
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly deprecatedAt?: Date;
}

export interface SecretConsumer {
  readonly type: 'user' | 'role' | 'agent' | 'service' | 'plugin';
  readonly id: string;
  readonly permissions: ('read' | 'rotate' | 'delete')[];
  readonly conditions?: string[];
}

// ─── Rotation Policy ─────────────────────────────────────────────────────────

export interface RotationPolicy {
  readonly id: RotationPolicyId;
  readonly name: string;
  readonly rotationIntervalDays: number;
  readonly notifyBeforeDays: number;
  readonly autoRotate: boolean;
  readonly rotationHandler?: string; // handler function ID for automated rotation
  readonly keepVersionCount: number; // number of old versions to retain
  readonly requireApproval: boolean;
  readonly enabled: boolean;
}

export const DEFAULT_ROTATION_POLICIES: Record<SecretKind, Partial<RotationPolicy>> = {
  'api-key': { rotationIntervalDays: 90, autoRotate: false, keepVersionCount: 2 },
  password: { rotationIntervalDays: 90, autoRotate: false, keepVersionCount: 1 },
  'oauth-client-secret': { rotationIntervalDays: 180, autoRotate: false, keepVersionCount: 2 },
  'private-key': { rotationIntervalDays: 365, autoRotate: false, keepVersionCount: 2 },
  certificate: { rotationIntervalDays: 365, autoRotate: true, keepVersionCount: 2 },
  'connection-string': { rotationIntervalDays: 180, autoRotate: false, keepVersionCount: 1 },
  token: { rotationIntervalDays: 30, autoRotate: false, keepVersionCount: 1 },
  'symmetric-key': { rotationIntervalDays: 365, autoRotate: true, keepVersionCount: 3 },
  'webhook-secret': { rotationIntervalDays: 180, autoRotate: false, keepVersionCount: 1 },
  'cloud-credential': { rotationIntervalDays: 90, autoRotate: false, keepVersionCount: 2 },
  custom: { rotationIntervalDays: 90, autoRotate: false, keepVersionCount: 1 },
};

// ─── Secret Access ───────────────────────────────────────────────────────────

export interface SecretAccessResult {
  readonly secretId: SecretId;
  readonly versionId: SecretVersionId;
  readonly version: number;
  readonly value: string; // plaintext (only on direct access, never in list)
  readonly expiresAt?: Date;
  readonly accessedAt: Date;
}

export interface SecretAccessRequest {
  readonly secretId: SecretId;
  readonly requesterId: string;
  readonly requesterType: 'user' | 'agent' | 'service' | 'plugin';
  readonly justification?: string;
  readonly versionId?: SecretVersionId; // specific version; defaults to current
}

// ─── Secret Service Interface ────────────────────────────────────────────────

export interface ISecretManager {
  /**
   * Create a new secret (value encrypted before storage).
   */
  create(input: CreateSecretInput): Promise<GovernanceResult<Secret>>;

  /**
   * Access the current value of a secret. Fully audited.
   */
  access(request: SecretAccessRequest): Promise<GovernanceResult<SecretAccessResult>>;

  /**
   * Write a new version of a secret (rotation). Old version deprecated.
   */
  rotate(id: SecretId, newValue: string, by: string): Promise<GovernanceResult<SecretVersion>>;

  /**
   * Mark a secret as compromised. Triggers immediate rotation workflow.
   */
  markCompromised(id: SecretId, reason: string, by: string): Promise<GovernanceResult<void>>;

  /**
   * Delete a secret (soft-delete by default).
   */
  delete(id: SecretId, by: string, hard?: boolean): Promise<GovernanceResult<void>>;

  /**
   * List secrets (metadata only, no values).
   */
  list(filter: SecretListFilter): Promise<Secret[]>;

  /**
   * Get secret metadata by ID.
   */
  getById(id: SecretId): Promise<Secret | null>;

  /**
   * List versions for a secret.
   */
  listVersions(id: SecretId): Promise<SecretVersion[]>;

  /**
   * Get or create a rotation policy.
   */
  setRotationPolicy(secretId: SecretId, policy: RotationPolicyId): Promise<GovernanceResult<void>>;

  /**
   * Trigger immediate rotation for secrets nearing expiry.
   */
  processExpiringSecrets(orgId: string): Promise<SecretRotationReport>;
}

export interface CreateSecretInput {
  readonly name: string;
  readonly description?: string;
  readonly kind: SecretKind;
  readonly value: string;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly allowedConsumers?: SecretConsumer[];
  readonly rotationPolicyId?: RotationPolicyId;
  readonly expiresAt?: Date;
  readonly tags?: string[];
  readonly createdBy: string;
}

export interface SecretListFilter {
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly kind?: SecretKind;
  readonly status?: SecretStatus;
  readonly tags?: string[];
  readonly expiringWithinDays?: number;
}

export interface SecretRotationReport {
  readonly organizationId: string;
  readonly processed: number;
  readonly rotated: number;
  readonly failed: number;
  readonly skipped: number;
  readonly notifications: number;
  readonly generatedAt: Date;
}
