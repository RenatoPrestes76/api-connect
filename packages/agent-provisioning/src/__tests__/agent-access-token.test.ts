import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentAccessToken,
  AgentAccessTokenError,
  hashAgentToken,
  extractAgentTokenPrefix,
} from '../entity/agent-access-token.js';
import { InMemoryAgentAccessTokenRepository }   from '../repository/in-memory-agent-access-token-repository.js';
import { PrismaAgentAccessTokenRepository }      from '../infrastructure/prisma-agent-access-token-repository.js';
import type {
  AgentProvisioningDbClient,
  PrismaAgentAccessToken,
} from '../infrastructure/prisma-types.js';

const FUTURE = new Date(Date.now() + 86_400_000);
const AGENT_ID = 'agent-001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTokenRow(overrides: Partial<PrismaAgentAccessToken> = {}): PrismaAgentAccessToken {
  return {
    id:          'aat-row-01',
    agentId:     AGENT_ID,
    tokenHash:   'b'.repeat(64),
    tokenPrefix: 'aat_aabbccdd',
    expiresAt:   FUTURE,
    revokedAt:   null,
    lastUsedAt:  null,
    createdAt:   new Date('2024-01-01'),
    updatedAt:   new Date('2024-01-01'),
    ...overrides,
  };
}

// ─── AgentAccessToken entity ──────────────────────────────────────────────────

describe('AgentAccessToken entity', () => {

  describe('generate()', () => {
    it('returns a token with aat_ prefix in rawToken', () => {
      const { rawToken } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(rawToken.startsWith('aat_')).toBe(true);
    });

    it('produces a 68-char raw token (aat_ + 64 hex chars)', () => {
      const { rawToken } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(rawToken).toHaveLength(68);
    });

    it('stores a 64-char sha-256 hash on the token (not the raw value)', () => {
      const { token, rawToken } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(token.tokenHash).toHaveLength(64);
      expect(token.tokenHash).not.toBe(rawToken);
    });

    it('sets tokenPrefix to the first 12 chars of the raw token', () => {
      const { token, rawToken } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(token.tokenPrefix).toBe(rawToken.slice(0, 12));
    });

    it('persists the agentId on the token', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(token.agentId).toBe(AGENT_ID);
    });

    it('uses the provided idGenerator', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE, () => 'fixed-id');
      expect(token.id).toBe('fixed-id');
    });

    it('generates unique tokens on each call', () => {
      const { rawToken: t1 } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      const { rawToken: t2 } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(t1).not.toBe(t2);
    });

    it('throws when agentId is empty', () => {
      expect(() => AgentAccessToken.generate('', FUTURE))
        .toThrow(AgentAccessTokenError);
    });

    it('throws when agentId is whitespace only', () => {
      expect(() => AgentAccessToken.generate('   ', FUTURE))
        .toThrow(AgentAccessTokenError);
    });

    it('throws when expiresAt is in the past', () => {
      expect(() => AgentAccessToken.generate(AGENT_ID, new Date(Date.now() - 1)))
        .toThrow(AgentAccessTokenError);
    });
  });

  describe('isExpired()', () => {
    it('returns false when expiresAt is in the future', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(token.isExpired()).toBe(false);
    });

    it('returns true when reconstituted with a past expiresAt', () => {
      const { token: base } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      const expired = AgentAccessToken.fromSnapshot({
        ...base.toSnapshot(),
        expiresAt: new Date(Date.now() - 1),
      });
      expect(expired.isExpired()).toBe(true);
    });
  });

  describe('isRevoked()', () => {
    it('returns false for a fresh token', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(token.isRevoked()).toBe(false);
    });

    it('returns true after revoke()', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      token.revoke();
      expect(token.isRevoked()).toBe(true);
    });
  });

  describe('isValid()', () => {
    it('returns true for a fresh token', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      expect(token.isValid()).toBe(true);
    });

    it('returns false for an expired token', () => {
      const { token: base } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      const expired = AgentAccessToken.fromSnapshot({
        ...base.toSnapshot(),
        expiresAt: new Date(Date.now() - 1),
      });
      expect(expired.isValid()).toBe(false);
    });

    it('returns false for a revoked token', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      token.revoke();
      expect(token.isValid()).toBe(false);
    });
  });

  describe('revoke()', () => {
    it('sets revokedAt to a Date', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      token.revoke();
      expect(token.revokedAt).toBeInstanceOf(Date);
    });

    it('is idempotent — second call does not change revokedAt', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      token.revoke();
      const first = token.revokedAt!;
      token.revoke();
      expect(token.revokedAt).toBe(first);
    });
  });

  describe('markUsed()', () => {
    it('sets lastUsedAt on a valid token', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      token.markUsed();
      expect(token.lastUsedAt).toBeInstanceOf(Date);
    });

    it('throws when called on a revoked token', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      token.revoke();
      expect(() => token.markUsed()).toThrow(AgentAccessTokenError);
    });

    it('throws when called on an expired token', () => {
      const { token: base } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      const expired = AgentAccessToken.fromSnapshot({
        ...base.toSnapshot(),
        expiresAt: new Date(Date.now() - 1),
      });
      expect(() => expired.markUsed()).toThrow(AgentAccessTokenError);
    });
  });

  describe('fromSnapshot / toSnapshot', () => {
    it('round-trips without loss', () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE, () => 'snap-id');
      const snap  = token.toSnapshot();
      const clone = AgentAccessToken.fromSnapshot(snap);
      expect(clone.id).toBe('snap-id');
      expect(clone.agentId).toBe(AGENT_ID);
      expect(clone.tokenHash).toBe(token.tokenHash);
      expect(clone.expiresAt.getTime()).toBe(FUTURE.getTime());
    });

    it('fromSnapshot can reconstitute an expired token (bypasses validation)', () => {
      const { token: base } = AgentAccessToken.generate(AGENT_ID, FUTURE);
      const expired = AgentAccessToken.fromSnapshot({
        ...base.toSnapshot(),
        expiresAt: new Date('2000-01-01'),
      });
      expect(expired.isExpired()).toBe(true);
    });
  });

  describe('hashAgentToken()', () => {
    it('produces a 64-char hex string', () => {
      const hash = hashAgentToken('aat_test');
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('is deterministic', () => {
      expect(hashAgentToken('aat_abc')).toBe(hashAgentToken('aat_abc'));
    });

    it('produces different hashes for different inputs', () => {
      expect(hashAgentToken('aat_abc')).not.toBe(hashAgentToken('aat_def'));
    });
  });

  describe('extractAgentTokenPrefix()', () => {
    it('returns first 12 chars', () => {
      expect(extractAgentTokenPrefix('aat_abcdefghijk')).toBe('aat_abcdefgh');
    });
  });
});

// ─── InMemoryAgentAccessTokenRepository ──────────────────────────────────────

describe('InMemoryAgentAccessTokenRepository', () => {
  let repo: InMemoryAgentAccessTokenRepository;

  beforeEach(() => {
    repo = new InMemoryAgentAccessTokenRepository();
  });

  function makeToken(): { token: AgentAccessToken; rawToken: string } {
    return AgentAccessToken.generate(AGENT_ID, FUTURE, () => `id-${Math.random()}`);
  }

  describe('save()', () => {
    it('persists a token', async () => {
      const { token } = makeToken();
      await repo.save(token);
      expect(repo.size).toBe(1);
    });

    it('throws on duplicate tokenHash', async () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE, () => 'same-id');
      await repo.save(token);
      const clone = AgentAccessToken.fromSnapshot({ ...token.toSnapshot(), id: 'other-id' });
      await expect(repo.save(clone)).rejects.toThrow();
    });
  });

  describe('findByHash()', () => {
    it('returns the token when found', async () => {
      const { token, rawToken } = makeToken();
      await repo.save(token);
      const found = await repo.findByHash(hashAgentToken(rawToken));
      expect(found).not.toBeNull();
      expect(found!.agentId).toBe(AGENT_ID);
    });

    it('returns null when not found', async () => {
      expect(await repo.findByHash('x'.repeat(64))).toBeNull();
    });
  });

  describe('findByAgentId()', () => {
    it('returns all tokens for an agent', async () => {
      const { token: t1 } = makeToken();
      const { token: t2 } = makeToken();
      await repo.save(t1);
      await repo.save(t2);
      const results = await repo.findByAgentId(AGENT_ID);
      expect(results).toHaveLength(2);
    });

    it('returns empty array when no tokens found', async () => {
      expect(await repo.findByAgentId('unknown')).toHaveLength(0);
    });
  });

  describe('updateLastUsed()', () => {
    it('updates the lastUsedAt timestamp', async () => {
      const { token } = makeToken();
      await repo.save(token);
      const now = new Date();
      await repo.updateLastUsed(token.id, now);
      const found = await repo.findByHash(token.tokenHash);
      expect(found!.lastUsedAt?.getTime()).toBe(now.getTime());
    });

    it('throws when id not found', async () => {
      await expect(repo.updateLastUsed('ghost', new Date())).rejects.toThrow();
    });
  });

  describe('revoke()', () => {
    it('marks the token as revoked', async () => {
      const { token } = makeToken();
      await repo.save(token);
      await repo.revoke(token.id);
      const found = await repo.findByHash(token.tokenHash);
      expect(found!.isRevoked()).toBe(true);
    });

    it('throws when id not found', async () => {
      await expect(repo.revoke('ghost')).rejects.toThrow();
    });
  });

  describe('clear()', () => {
    it('empties the store', async () => {
      const { token } = makeToken();
      await repo.save(token);
      repo.clear();
      expect(repo.size).toBe(0);
    });
  });
});

// ─── PrismaAgentAccessTokenRepository ────────────────────────────────────────

describe('PrismaAgentAccessTokenRepository', () => {
  let mockDb: AgentProvisioningDbClient;
  let repo: PrismaAgentAccessTokenRepository;

  beforeEach(() => {
    mockDb = {
      atlasAgent: {
        create: vi.fn(), update: vi.fn(), findUnique: vi.fn(),
        findMany: vi.fn(), updateMany: vi.fn(),
      },
      provisioningToken: {
        create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(),
      },
      agentAccessToken: {
        create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(),
      },
    };
    repo = new PrismaAgentAccessTokenRepository(mockDb);
  });

  describe('save()', () => {
    it('calls agentAccessToken.create with hash and prefix', async () => {
      const { token } = AgentAccessToken.generate(AGENT_ID, FUTURE, () => 'aat-id');
      vi.mocked(mockDb.agentAccessToken.create).mockResolvedValue(makeTokenRow());

      await repo.save(token);

      expect(mockDb.agentAccessToken.create).toHaveBeenCalledOnce();
      const call = vi.mocked(mockDb.agentAccessToken.create).mock.calls[0]![0];
      expect(call.data.tokenHash).toBe(token.tokenHash);
      expect(call.data.tokenPrefix).toBe(token.tokenPrefix);
      expect(call.data.agentId).toBe(AGENT_ID);
    });
  });

  describe('findByHash()', () => {
    it('returns a domain entity when found', async () => {
      vi.mocked(mockDb.agentAccessToken.findUnique).mockResolvedValue(makeTokenRow());
      const result = await repo.findByHash('b'.repeat(64));
      expect(result).not.toBeNull();
      expect(result!.agentId).toBe(AGENT_ID);
    });

    it('returns null when not found', async () => {
      vi.mocked(mockDb.agentAccessToken.findUnique).mockResolvedValue(null);
      expect(await repo.findByHash('x'.repeat(64))).toBeNull();
    });
  });

  describe('findByAgentId()', () => {
    it('returns all matching tokens', async () => {
      vi.mocked(mockDb.agentAccessToken.findMany).mockResolvedValue([makeTokenRow()]);
      const results = await repo.findByAgentId(AGENT_ID);
      expect(results).toHaveLength(1);
    });
  });

  describe('updateLastUsed()', () => {
    it('calls update with lastUsedAt', async () => {
      vi.mocked(mockDb.agentAccessToken.update).mockResolvedValue(makeTokenRow());
      const now = new Date();
      await repo.updateLastUsed('aat-row-01', now);
      const call = vi.mocked(mockDb.agentAccessToken.update).mock.calls[0]![0];
      expect(call.where.id).toBe('aat-row-01');
      expect(call.data.lastUsedAt).toBe(now);
    });
  });

  describe('revoke()', () => {
    it('calls update with revokedAt', async () => {
      vi.mocked(mockDb.agentAccessToken.update).mockResolvedValue(makeTokenRow());
      await repo.revoke('aat-row-01');
      const call = vi.mocked(mockDb.agentAccessToken.update).mock.calls[0]![0];
      expect(call.where.id).toBe('aat-row-01');
      expect(call.data.revokedAt).toBeInstanceOf(Date);
    });
  });
});
