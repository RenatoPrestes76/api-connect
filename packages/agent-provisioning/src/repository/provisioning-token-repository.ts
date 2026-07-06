/**
 * ProvisioningTokenRepository — port (interface) for token persistence.
 * Implementations live in the infrastructure layer.
 */
import type { ProvisioningToken } from '../entity/provisioning-token.js';

export interface ProvisioningTokenRepository {
  /** Persist a new token. Throws if `tokenHash` already exists. */
  create(token: ProvisioningToken): Promise<void>;

  /** Find by the SHA-256 hash of the raw token. */
  findByHash(tokenHash: string): Promise<ProvisioningToken | null>;

  /** Find by token prefix for fast lookup before hash comparison. */
  findByPrefix(tokenPrefix: string): Promise<ProvisioningToken[]>;

  /** Revoke a token. Throws if not found. */
  revoke(id: string): Promise<void>;

  /** All non-revoked, non-expired tokens for a company. */
  findActive(companyId: string): Promise<ProvisioningToken[]>;

  /** Update lastUsedAt timestamp. Throws if not found. */
  updateLastUse(id: string, lastUsedAt: Date): Promise<void>;
}
