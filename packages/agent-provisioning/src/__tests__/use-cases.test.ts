import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasAgent, InMemoryAtlasAgentRepository } from '@seltriva/agent-identity';
import { InMemoryProvisioningTokenRepository } from '../repository/in-memory-provisioning-token-repository.js';
import { InMemoryAgentAccessTokenRepository } from '../repository/in-memory-agent-access-token-repository.js';
import { ProvisioningService } from '../service/provisioning-service.js';
import { ProvisioningToken } from '../entity/provisioning-token.js';
import { CreateProvisioningToken } from '../use-cases/create-provisioning-token.js';
import { RevokeProvisioningToken } from '../use-cases/revoke-provisioning-token.js';
import { ProvisionAgent } from '../use-cases/provision-agent.js';
import { UpdateAgentVersion } from '../use-cases/update-agent-version.js';
import { UpdateAgentHostname } from '../use-cases/update-agent-hostname.js';
import type { RegisterAgentParams } from '@seltriva/agent-identity';

const FUTURE = new Date(Date.now() + 86_400_000);
const COMPANY = 'co-usecases';

const AGENT_PARAMS: RegisterAgentParams = {
  companyId: COMPANY,
  name: 'Runtime 1',
  hostname: 'host01',
  machineId: 'MACHINE-UC001-TEST',
  connectorType: 'POSTGRES',
  version: '1.2.0',
};

// ─── CreateProvisioningToken ──────────────────────────────────────────────────

describe('CreateProvisioningToken', () => {
  let repo: InMemoryProvisioningTokenRepository;
  let useCase: CreateProvisioningToken;

  beforeEach(() => {
    repo = new InMemoryProvisioningTokenRepository();
    useCase = new CreateProvisioningToken(repo);
  });

  it('creates a token and returns ok=true with rawToken', async () => {
    const result = await useCase.execute({
      companyId: COMPANY,
      description: 'test',
      expiresAt: FUTURE,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rawToken.startsWith('slp_')).toBe(true);
      expect(result.value.tokenId).toBeDefined();
    }
  });

  it('persists the token in the repository', async () => {
    await useCase.execute({ companyId: COMPANY, description: 'test', expiresAt: FUTURE });
    expect(repo.size).toBe(1);
  });

  it('returns VALIDATION_ERROR for empty companyId', async () => {
    const result = await useCase.execute({
      companyId: '',
      description: 'test',
      expiresAt: FUTURE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for past expiresAt', async () => {
    const result = await useCase.execute({
      companyId: COMPANY,
      description: 'test',
      expiresAt: new Date(Date.now() - 1),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── RevokeProvisioningToken ──────────────────────────────────────────────────

describe('RevokeProvisioningToken', () => {
  let repo: InMemoryProvisioningTokenRepository;
  let useCase: RevokeProvisioningToken;

  beforeEach(() => {
    repo = new InMemoryProvisioningTokenRepository();
    useCase = new RevokeProvisioningToken(repo);
  });

  async function createToken() {
    const { token } = ProvisioningToken.create(
      { companyId: COMPANY, description: 'x', expiresAt: FUTURE },
      () => `tok-${Math.random()}`
    );
    await repo.create(token);
    return token;
  }

  it('revokes an existing token', async () => {
    const token = await createToken();
    const result = await useCase.execute(token.id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tokenId).toBe(token.id);
      expect(result.value.revokedAt).toBeInstanceOf(Date);
    }
  });

  it('returns TOKEN_NOT_FOUND for a nonexistent id', async () => {
    const result = await useCase.execute('ghost-id');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_FOUND');
  });
});

// ─── ProvisionAgent ───────────────────────────────────────────────────────────

describe('ProvisionAgent', () => {
  let tokenRepo: InMemoryProvisioningTokenRepository;
  let agentRepo: InMemoryAtlasAgentRepository;
  let service: ProvisioningService;
  let useCase: ProvisionAgent;

  beforeEach(() => {
    tokenRepo = new InMemoryProvisioningTokenRepository();
    agentRepo = new InMemoryAtlasAgentRepository();
    service = new ProvisioningService(
      tokenRepo,
      agentRepo,
      new InMemoryAgentAccessTokenRepository()
    );
    useCase = new ProvisionAgent(service);
  });

  async function mkRawToken() {
    const { token, rawToken } = ProvisioningToken.create(
      { companyId: COMPANY, description: 'provision', expiresAt: FUTURE },
      () => `tok-${Math.random()}`
    );
    await tokenRepo.create(token);
    return rawToken;
  }

  it('provisions an agent successfully', async () => {
    const rawToken = await mkRawToken();
    const result = await useCase.execute({ rawToken, agentParams: AGENT_PARAMS });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.agentId).toBeDefined();
    }
  });

  it('delegates token errors correctly (TOKEN_NOT_FOUND)', async () => {
    const result = await useCase.execute({
      rawToken: 'slp_' + '0'.repeat(64),
      agentParams: AGENT_PARAMS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOKEN_NOT_FOUND');
  });
});

// ─── UpdateAgentVersion ───────────────────────────────────────────────────────

describe('UpdateAgentVersion', () => {
  let repo: InMemoryAtlasAgentRepository;
  let useCase: UpdateAgentVersion;

  beforeEach(() => {
    repo = new InMemoryAtlasAgentRepository();
    useCase = new UpdateAgentVersion(repo);
  });

  async function registerAgent() {
    const agent = AtlasAgent.register(AGENT_PARAMS);
    await repo.save(agent);
    return agent.id.toString();
  }

  it('upgrades version and returns ok=true', async () => {
    const id = await registerAgent();
    const result = await useCase.execute(id, '2.0.0');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.version).toBe('2.0.0');
  });

  it('persists the new version', async () => {
    const id = await registerAgent();
    await useCase.execute(id, '1.9.0');
    const found = await repo.findById(id);
    expect(found!.version.toString()).toBe('1.9.0');
  });

  it('returns AGENT_NOT_FOUND for unknown id', async () => {
    const result = await useCase.execute('00000000-0000-4000-8000-000000000000', '2.0.0');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('returns AGENT_DISABLED when agent is disabled', async () => {
    const id = await registerAgent();
    const agent = await repo.findById(id);
    agent!.markHeartbeat();
    agent!.disable();
    await repo.update(agent!);
    const result = await useCase.execute(id, '9.9.9');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_DISABLED');
  });

  it('returns VERSION_NOT_NEWER for same or lower version', async () => {
    const id = await registerAgent();
    const result = await useCase.execute(id, '1.0.0'); // same
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VERSION_NOT_NEWER');
  });

  it('returns VERSION_NOT_NEWER for an invalid version string', async () => {
    const id = await registerAgent();
    const result = await useCase.execute(id, 'not-semver');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VERSION_NOT_NEWER');
  });
});

// ─── UpdateAgentHostname ──────────────────────────────────────────────────────

describe('UpdateAgentHostname', () => {
  let repo: InMemoryAtlasAgentRepository;
  let useCase: UpdateAgentHostname;

  beforeEach(() => {
    repo = new InMemoryAtlasAgentRepository();
    useCase = new UpdateAgentHostname(repo);
  });

  async function registerAgent() {
    const agent = AtlasAgent.register(AGENT_PARAMS);
    await repo.save(agent);
    return agent.id.toString();
  }

  it('updates hostname and returns ok=true', async () => {
    const id = await registerAgent();
    const result = await useCase.execute(id, 'newhost.acme.com');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hostname).toBe('newhost.acme.com');
  });

  it('persists the new hostname', async () => {
    const id = await registerAgent();
    await useCase.execute(id, 'updated.acme.com');
    const found = await repo.findById(id);
    expect(found!.hostname.toString()).toBe('updated.acme.com');
  });

  it('returns AGENT_NOT_FOUND for unknown id', async () => {
    const result = await useCase.execute('00000000-0000-4000-8000-000000000000', 'host.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('returns AGENT_DISABLED when agent is disabled', async () => {
    const id = await registerAgent();
    const agent = await repo.findById(id);
    agent!.markHeartbeat();
    agent!.disable();
    await repo.update(agent!);
    const result = await useCase.execute(id, 'host.acme.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_DISABLED');
  });

  it('returns INVALID_HOSTNAME for a bad hostname string', async () => {
    const id = await registerAgent();
    const result = await useCase.execute(id, 'bad hostname!');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_HOSTNAME');
  });
});
