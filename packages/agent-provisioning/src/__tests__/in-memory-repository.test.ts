import { describe, it, expect, beforeEach } from 'vitest';
import { ProvisioningToken } from '../entity/provisioning-token.js';
import { InMemoryProvisioningTokenRepository } from '../repository/in-memory-provisioning-token-repository.js';

const FUTURE = new Date(Date.now() + 86_400_000);
const BASE = { companyId: 'co-1', description: 'test token', expiresAt: FUTURE };

function mkToken(overrides = {}) {
  return ProvisioningToken.create({ ...BASE, ...overrides }, () => `id-${Math.random()}`);
}

describe('InMemoryProvisioningTokenRepository', () => {
  let repo: InMemoryProvisioningTokenRepository;

  beforeEach(() => {
    repo = new InMemoryProvisioningTokenRepository();
  });

  describe('create()', () => {
    it('persists a token', async () => {
      const { token } = mkToken();
      await repo.create(token);
      expect(repo.size).toBe(1);
    });

    it('throws when tokenHash already exists', async () => {
      const { token } = mkToken();
      await repo.create(token);
      await expect(repo.create(token)).rejects.toThrow();
    });
  });

  describe('findByHash()', () => {
    it('returns the token when hash matches', async () => {
      const { token } = mkToken();
      await repo.create(token);
      const found = await repo.findByHash(token.tokenHash);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(token.id);
    });

    it('returns null when hash is not found', async () => {
      expect(await repo.findByHash('0'.repeat(64))).toBeNull();
    });
  });

  describe('findByPrefix()', () => {
    it('returns tokens matching the prefix', async () => {
      const { token } = mkToken();
      await repo.create(token);
      const results = await repo.findByPrefix(token.tokenPrefix);
      expect(results.some((t) => t.id === token.id)).toBe(true);
    });

    it('returns empty when no prefix matches', async () => {
      expect(await repo.findByPrefix('slp_ZZZZZZZ')).toHaveLength(0);
    });
  });

  describe('revoke()', () => {
    it('marks the token revoked', async () => {
      const { token } = mkToken();
      await repo.create(token);
      await repo.revoke(token.id);
      const found = await repo.findByHash(token.tokenHash);
      expect(found!.isRevoked()).toBe(true);
    });

    it('throws when token id not found', async () => {
      await expect(repo.revoke('nonexistent')).rejects.toThrow();
    });
  });

  describe('findActive()', () => {
    it('returns only non-revoked non-expired tokens for the company', async () => {
      const { token: active } = mkToken({ companyId: 'co-x' });
      await repo.create(active);

      const { token: toRevoke } = mkToken({ companyId: 'co-x' });
      await repo.create(toRevoke);
      await repo.revoke(toRevoke.id);

      const { token: other } = mkToken({ companyId: 'co-y' });
      await repo.create(other);

      const results = await repo.findActive('co-x');
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(active.id);
    });

    it('returns empty array when none are active', async () => {
      expect(await repo.findActive('ghost-company')).toHaveLength(0);
    });
  });

  describe('updateLastUse()', () => {
    it('persists the lastUsedAt timestamp', async () => {
      const { token } = mkToken();
      await repo.create(token);
      const usedAt = new Date();
      await repo.updateLastUse(token.id, usedAt);
      const found = await repo.findByHash(token.tokenHash);
      expect(found!.lastUsedAt?.getTime()).toBeCloseTo(usedAt.getTime(), -2);
    });

    it('throws when token not found', async () => {
      await expect(repo.updateLastUse('ghost', new Date())).rejects.toThrow();
    });
  });

  describe('clear()', () => {
    it('removes all tokens', async () => {
      const { token } = mkToken();
      await repo.create(token);
      repo.clear();
      expect(repo.size).toBe(0);
    });
  });
});
