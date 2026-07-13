import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryAtlasAgentRepository } from '@seltriva/agent-identity';
import { InMemoryProvisioningTokenRepository } from '../repository/in-memory-provisioning-token-repository.js';
import { InMemoryAgentAccessTokenRepository } from '../repository/in-memory-agent-access-token-repository.js';
import { ProvisioningService } from '../service/provisioning-service.js';
import { ProvisioningToken } from '../entity/provisioning-token.js';
import { hashProvisioningToken } from '../entity/provisioning-token.js';
import type { RegisterAgentParams } from '@seltriva/agent-identity';

const FUTURE = new Date(Date.now() + 86_400_000);
const COMPANY = 'company-xyz';

const AGENT_PARAMS: RegisterAgentParams = {
  companyId: COMPANY,
  name: 'Test Runtime',
  hostname: 'runtime01',
  machineId: 'MACHINE-PS001-TEST',
  connectorType: 'MSSQL',
  version: '1.0.0',
};

async function createValidToken(
  tokenRepo: InMemoryProvisioningTokenRepository,
  overrides: Partial<{ companyId: string; expiresAt: Date }> = {}
): Promise<string> {
  // Always create with a future expiresAt; then optionally replace with a
  // past one via fromSnapshot (bypassing create() validation intentionally).
  const { token: base, rawToken } = ProvisioningToken.create(
    {
      companyId: overrides.companyId ?? COMPANY,
      description: 'test token',
      expiresAt: FUTURE,
    },
    () => `tok-${Math.random()}`
  );

  const token = overrides.expiresAt
    ? ProvisioningToken.fromSnapshot({ ...base.toSnapshot(), expiresAt: overrides.expiresAt })
    : base;

  await tokenRepo.create(token);
  return rawToken;
}

describe('ProvisioningService', () => {
  let tokenRepo: InMemoryProvisioningTokenRepository;
  let agentRepo: InMemoryAtlasAgentRepository;
  let accessTokenRepo: InMemoryAgentAccessTokenRepository;
  let service: ProvisioningService;

  beforeEach(() => {
    tokenRepo = new InMemoryProvisioningTokenRepository();
    agentRepo = new InMemoryAtlasAgentRepository();
    accessTokenRepo = new InMemoryAgentAccessTokenRepository();
    service = new ProvisioningService(tokenRepo, agentRepo, accessTokenRepo);
  });

  // ─── validateToken ─────────────────────────────────────────────────────────

  describe('validateToken()', () => {
    it('returns ok=true for a valid token', async () => {
      const rawToken = await createValidToken(tokenRepo);
      const result = await service.validateToken(rawToken);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.companyId).toBe(COMPANY);
      }
    });

    it('returns TOKEN_NOT_FOUND for an unknown token', async () => {
      const result = await service.validateToken('slp_' + '0'.repeat(64));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_FOUND');
    });

    it('returns TOKEN_REVOKED for a revoked token', async () => {
      const rawToken = await createValidToken(tokenRepo);
      const hash = hashProvisioningToken(rawToken);
      const found = await tokenRepo.findByHash(hash);
      await tokenRepo.revoke(found!.id);

      const result = await service.validateToken(rawToken);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('TOKEN_REVOKED');
    });

    it('returns TOKEN_EXPIRED for an expired token', async () => {
      const rawToken = await createValidToken(tokenRepo, {
        expiresAt: new Date(Date.now() - 1_000),
      });
      const result = await service.validateToken(rawToken);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  // ─── registerAgent ─────────────────────────────────────────────────────────

  describe('registerAgent()', () => {
    it('successfully registers an agent and returns ok=true', async () => {
      const rawToken = await createValidToken(tokenRepo);
      const result = await service.registerAgent(rawToken, AGENT_PARAMS);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.agentId).toBeDefined();
        expect(result.value.events[0]!.type).toBe('AtlasAgent.Registered');
      }
    });

    it('persists the agent in the repository', async () => {
      const rawToken = await createValidToken(tokenRepo);
      const result = await service.registerAgent(rawToken, AGENT_PARAMS);
      if (!result.ok) throw new Error('unexpected failure');
      expect(await agentRepo.findById(result.value.agentId)).not.toBeNull();
    });

    it('updates lastUsedAt on the token after registration', async () => {
      const rawToken = await createValidToken(tokenRepo);
      await service.registerAgent(rawToken, AGENT_PARAMS);
      const hash = hashProvisioningToken(rawToken);
      const token = await tokenRepo.findByHash(hash);
      expect(token!.lastUsedAt).toBeInstanceOf(Date);
    });

    it('returns TOKEN_NOT_FOUND when token is invalid', async () => {
      const result = await service.registerAgent('slp_' + '0'.repeat(64), AGENT_PARAMS);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_FOUND');
    });

    it('returns TOKEN_REVOKED when token has been revoked', async () => {
      const rawToken = await createValidToken(tokenRepo);
      const hash = hashProvisioningToken(rawToken);
      const found = await tokenRepo.findByHash(hash);
      await tokenRepo.revoke(found!.id);
      const result = await service.registerAgent(rawToken, AGENT_PARAMS);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('TOKEN_REVOKED');
    });

    it('returns TOKEN_EXPIRED when token has expired', async () => {
      const rawToken = await createValidToken(tokenRepo, {
        expiresAt: new Date(Date.now() - 1),
      });
      const result = await service.registerAgent(rawToken, AGENT_PARAMS);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('TOKEN_EXPIRED');
    });

    it('returns COMPANY_MISMATCH when token company differs from params', async () => {
      const rawToken = await createValidToken(tokenRepo, { companyId: 'co-A' });
      const result = await service.registerAgent(rawToken, {
        ...AGENT_PARAMS,
        companyId: 'co-B',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('COMPANY_MISMATCH');
    });

    it('returns MACHINE_ALREADY_REGISTERED for a duplicate machineId', async () => {
      const rawToken = await createValidToken(tokenRepo);
      await service.registerAgent(rawToken, AGENT_PARAMS);

      const rawToken2 = await createValidToken(tokenRepo);
      const result = await service.registerAgent(rawToken2, {
        ...AGENT_PARAMS,
        name: 'Second Agent',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('MACHINE_ALREADY_REGISTERED');
    });

    it('returns VALIDATION_ERROR for invalid agent params', async () => {
      const rawToken = await createValidToken(tokenRepo);
      const result = await service.registerAgent(rawToken, {
        ...AGENT_PARAMS,
        hostname: 'bad hostname!',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns a rawToken (Agent Access Token) starting with aat_', async () => {
      const rawToken = await createValidToken(tokenRepo);
      const result = await service.registerAgent(rawToken, AGENT_PARAMS);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.rawToken).toMatch(/^aat_/);
    });

    it('persists the AgentAccessToken in the access token repo', async () => {
      const rawToken = await createValidToken(tokenRepo);
      await service.registerAgent(rawToken, AGENT_PARAMS);
      expect(accessTokenRepo.size).toBe(1);
    });

    it('access token is linked to the registered agent id', async () => {
      const rawToken = await createValidToken(tokenRepo);
      const result = await service.registerAgent(rawToken, AGENT_PARAMS);
      if (!result.ok) throw new Error('unexpected failure');
      const tokens = await accessTokenRepo.findByAgentId(result.value.agentId);
      expect(tokens).toHaveLength(1);
    });
  });
});
