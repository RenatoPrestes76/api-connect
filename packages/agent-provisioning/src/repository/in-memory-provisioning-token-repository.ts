/**
 * InMemoryProvisioningTokenRepository — Map-backed implementation for tests.
 */
import { ProvisioningToken, ProvisioningTokenSnapshot } from '../entity/provisioning-token.js';
import type { ProvisioningTokenRepository }              from './provisioning-token-repository.js';

export class InMemoryProvisioningTokenRepository implements ProvisioningTokenRepository {
  private readonly _store = new Map<string, ProvisioningTokenSnapshot>();

  async create(token: ProvisioningToken): Promise<void> {
    for (const snap of this._store.values()) {
      if (snap.tokenHash === token.tokenHash) {
        throw new Error(`Token with hash "${token.tokenHash}" already exists`);
      }
    }
    this._store.set(token.id, token.toSnapshot());
  }

  async findByHash(tokenHash: string): Promise<ProvisioningToken | null> {
    for (const snap of this._store.values()) {
      if (snap.tokenHash === tokenHash) {
        return ProvisioningToken.fromSnapshot(snap);
      }
    }
    return null;
  }

  async findByPrefix(tokenPrefix: string): Promise<ProvisioningToken[]> {
    const results: ProvisioningToken[] = [];
    for (const snap of this._store.values()) {
      if (snap.tokenPrefix === tokenPrefix) {
        results.push(ProvisioningToken.fromSnapshot(snap));
      }
    }
    return results;
  }

  async revoke(id: string): Promise<void> {
    const snap = this._store.get(id);
    if (!snap) throw new Error(`Token "${id}" not found`);
    const token = ProvisioningToken.fromSnapshot(snap);
    token.revoke();
    this._store.set(id, token.toSnapshot());
  }

  async findActive(companyId: string): Promise<ProvisioningToken[]> {
    const now     = new Date();
    const results: ProvisioningToken[] = [];
    for (const snap of this._store.values()) {
      if (
        snap.companyId === companyId &&
        snap.revokedAt === null &&
        snap.expiresAt > now
      ) {
        results.push(ProvisioningToken.fromSnapshot(snap));
      }
    }
    return results;
  }

  async updateLastUse(id: string, lastUsedAt: Date): Promise<void> {
    const snap = this._store.get(id);
    if (!snap) throw new Error(`Token "${id}" not found`);
    this._store.set(id, { ...snap, lastUsedAt, updatedAt: new Date() });
  }

  /** Test helper */
  get size(): number { return this._store.size; }

  /** Test helper */
  clear(): void { this._store.clear(); }
}
