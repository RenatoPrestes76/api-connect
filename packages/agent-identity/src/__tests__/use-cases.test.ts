import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasAgent } from '../entity/atlas-agent.js';
import { AgentStatusKind } from '../value-objects/agent-status.js';
import { InMemoryAtlasAgentRepository } from '../repository/in-memory-atlas-agent-repository.js';
import { RegisterAgent } from '../use-cases/register-agent.js';
import { UpdateHeartbeat } from '../use-cases/update-heartbeat.js';
import { UpdateSynchronization } from '../use-cases/update-synchronization.js';
import { DisableAgent } from '../use-cases/disable-agent.js';
import { FindAgent } from '../use-cases/find-agent.js';
import type { RegisterAgentParams } from '../entity/atlas-agent.js';

const mkParams = (overrides: Partial<RegisterAgentParams> = {}): RegisterAgentParams => ({
  companyId: 'company-1',
  name: 'Test Agent',
  hostname: 'host01',
  machineId: 'MACHINE-00001',
  connectorType: 'POSTGRES',
  version: '1.0.0',
  ...overrides,
});

// ─── RegisterAgent ────────────────────────────────────────────────────────────

describe('RegisterAgent', () => {
  let repo: InMemoryAtlasAgentRepository;
  let useCase: RegisterAgent;

  beforeEach(() => {
    repo = new InMemoryAtlasAgentRepository();
    useCase = new RegisterAgent(repo);
  });

  it('registers a new agent and returns ok=true with agentId', async () => {
    const result = await useCase.execute(mkParams());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.agentId).toBeDefined();
      expect(result.value.events[0]!.type).toBe('AtlasAgent.Registered');
    }
  });

  it('persists the agent in the repository', async () => {
    const result = await useCase.execute(mkParams());
    if (!result.ok) throw new Error('unexpected failure');
    const found = await repo.findById(result.value.agentId);
    expect(found).not.toBeNull();
  });

  it('returns MACHINE_ALREADY_REGISTERED when same machineId is reused', async () => {
    await useCase.execute(mkParams());
    const second = await useCase.execute(mkParams({ name: 'Another Agent' }));
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('MACHINE_ALREADY_REGISTERED');
    }
  });

  it('returns VALIDATION_ERROR for invalid params (empty companyId)', async () => {
    const result = await useCase.execute(mkParams({ companyId: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns VALIDATION_ERROR for invalid hostname', async () => {
    const result = await useCase.execute(mkParams({ hostname: 'bad hostname!' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('drained events list is empty after result is returned', async () => {
    // Use-case drains events; repo should have a clean agent
    const result = await useCase.execute(mkParams());
    if (!result.ok) throw new Error('unexpected failure');
    const found = await repo.findById(result.value.agentId);
    expect(found!.peekEvents()).toHaveLength(0);
  });
});

// ─── UpdateHeartbeat ──────────────────────────────────────────────────────────

describe('UpdateHeartbeat', () => {
  let repo: InMemoryAtlasAgentRepository;
  let register: RegisterAgent;
  let useCase: UpdateHeartbeat;

  beforeEach(() => {
    repo = new InMemoryAtlasAgentRepository();
    register = new RegisterAgent(repo);
    useCase = new UpdateHeartbeat(repo);
  });

  it('updates heartbeat and returns ok=true', async () => {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    const result = await useCase.execute(reg.value.agentId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.heartbeatAt).toBeInstanceOf(Date);
      expect(result.value.events[0]!.type).toBe('AtlasAgent.HeartbeatReceived');
    }
  });

  it('transitions agent to ONLINE', async () => {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    await useCase.execute(reg.value.agentId);
    const found = await repo.findById(reg.value.agentId);
    expect(found!.status.isOnline()).toBe(true);
  });

  it('returns AGENT_NOT_FOUND for unknown id', async () => {
    const result = await useCase.execute('00000000-0000-4000-8000-000000000000');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('returns AGENT_DISABLED when agent is disabled', async () => {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    const id = reg.value.agentId;

    // bring to ONLINE then DISABLED
    const agent = await repo.findById(id);
    agent!.markHeartbeat();
    agent!.disable();
    await repo.update(agent!);

    const result = await useCase.execute(id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_DISABLED');
  });
});

// ─── UpdateSynchronization ────────────────────────────────────────────────────

describe('UpdateSynchronization', () => {
  let repo: InMemoryAtlasAgentRepository;
  let register: RegisterAgent;
  let useCase: UpdateSynchronization;

  beforeEach(() => {
    repo = new InMemoryAtlasAgentRepository();
    register = new RegisterAgent(repo);
    useCase = new UpdateSynchronization(repo);
  });

  async function getSyncingAgent(): Promise<string> {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    const id = reg.value.agentId;
    const agent = await repo.findById(id);
    agent!.markHeartbeat(); // → ONLINE
    agent!.markSyncing(); // → SYNCING
    await repo.update(agent!);
    return id;
  }

  it('completes sync and returns ok=true', async () => {
    const id = await getSyncingAgent();
    const result = await useCase.execute(id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.synchronizedAt).toBeInstanceOf(Date);
      expect(result.value.events[0]!.type).toBe('AtlasAgent.SynchronizationCompleted');
    }
  });

  it('transitions agent back to ONLINE', async () => {
    const id = await getSyncingAgent();
    await useCase.execute(id);
    const found = await repo.findById(id);
    expect(found!.status.isOnline()).toBe(true);
  });

  it('returns AGENT_NOT_FOUND for unknown id', async () => {
    const result = await useCase.execute('00000000-0000-4000-8000-000000000000');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
  });

  it('returns AGENT_NOT_SYNCING when agent is ONLINE (not SYNCING)', async () => {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    const id = reg.value.agentId;
    const agent = await repo.findById(id);
    agent!.markHeartbeat(); // → ONLINE
    await repo.update(agent!);

    const result = await useCase.execute(id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_SYNCING');
  });

  it('returns AGENT_DISABLED when agent is disabled', async () => {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    const id = reg.value.agentId;
    const agent = await repo.findById(id);
    agent!.markHeartbeat();
    agent!.disable();
    await repo.update(agent!);

    const result = await useCase.execute(id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_DISABLED');
  });
});

// ─── DisableAgent ─────────────────────────────────────────────────────────────

describe('DisableAgent', () => {
  let repo: InMemoryAtlasAgentRepository;
  let register: RegisterAgent;
  let useCase: DisableAgent;

  beforeEach(() => {
    repo = new InMemoryAtlasAgentRepository();
    register = new RegisterAgent(repo);
    useCase = new DisableAgent(repo);
  });

  it('disables an ONLINE agent and returns ok=true', async () => {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    const id = reg.value.agentId;

    const agent = await repo.findById(id);
    agent!.markHeartbeat(); // → ONLINE
    await repo.update(agent!);

    const result = await useCase.execute(id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events[0]!.type).toBe('AtlasAgent.Disabled');
    }
  });

  it('persists the DISABLED status', async () => {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    const id = reg.value.agentId;

    const agent = await repo.findById(id);
    agent!.markHeartbeat();
    await repo.update(agent!);
    await useCase.execute(id);

    const found = await repo.findById(id);
    expect(found!.status.isDisabled()).toBe(true);
  });

  it('is idempotent — disabling an already-disabled agent returns ok=true with no events', async () => {
    const reg = await register.execute(mkParams());
    if (!reg.ok) throw new Error('register failed');
    const id = reg.value.agentId;

    const agent = await repo.findById(id);
    agent!.markHeartbeat();
    agent!.disable(); // already disabled
    await repo.update(agent!);

    const result = await useCase.execute(id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.events).toHaveLength(0); // idempotent — no new event
    }
  });

  it('returns AGENT_NOT_FOUND for unknown id', async () => {
    const result = await useCase.execute('00000000-0000-4000-8000-000000000000');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
  });
});

// ─── FindAgent ───────────────────────────────────────────────────────────────

describe('FindAgent', () => {
  let repo: InMemoryAtlasAgentRepository;
  let register: RegisterAgent;
  let useCase: FindAgent;

  beforeEach(() => {
    repo = new InMemoryAtlasAgentRepository();
    register = new RegisterAgent(repo);
    useCase = new FindAgent(repo);
  });

  describe('byId()', () => {
    it('returns the agent when found', async () => {
      const reg = await register.execute(mkParams());
      if (!reg.ok) throw new Error('register failed');
      const result = await useCase.byId(reg.value.agentId);
      expect(result.ok).toBe(true);
    });

    it('returns AGENT_NOT_FOUND when not found', async () => {
      const result = await useCase.byId('00000000-0000-4000-8000-000000000000');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
    });
  });

  describe('byCompany()', () => {
    it('returns all agents for the company', async () => {
      await register.execute(mkParams({ machineId: 'MACHINE-FC001-XX' }));
      await register.execute(mkParams({ machineId: 'MACHINE-FC002-XX' }));
      const result = await useCase.byCompany('company-1');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(2);
    });

    it('returns empty array for unknown company', async () => {
      const result = await useCase.byCompany('ghost');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(0);
    });
  });

  describe('online()', () => {
    it('returns only ONLINE agents', async () => {
      const reg = await register.execute(mkParams({ machineId: 'MACHINE-FO001-XX' }));
      if (!reg.ok) throw new Error('register failed');

      // bring to ONLINE
      const agent = await repo.findById(reg.value.agentId);
      agent!.markHeartbeat();
      await repo.update(agent!);

      const result = await useCase.online();
      expect(result.ok).toBe(true);
      expect(result.value).toHaveLength(1);
    });
  });

  describe('byMachineId()', () => {
    it('returns the agent when found', async () => {
      await register.execute(mkParams({ machineId: 'MACHINE-FM001-XX' }));
      const result = await useCase.byMachineId('MACHINE-FM001-XX');
      expect(result.ok).toBe(true);
    });

    it('returns AGENT_NOT_FOUND when no agent has that machineId', async () => {
      const result = await useCase.byMachineId('MACHINE-NOTEXIST-XX');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('AGENT_NOT_FOUND');
    });
  });
});
