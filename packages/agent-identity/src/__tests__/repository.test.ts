import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasAgent } from '../entity/atlas-agent.js';
import { AgentStatusKind } from '../value-objects/agent-status.js';
import {
  InMemoryAtlasAgentRepository,
  RepositoryError,
} from '../repository/in-memory-atlas-agent-repository.js';
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

describe('InMemoryAtlasAgentRepository', () => {
  let repo: InMemoryAtlasAgentRepository;

  beforeEach(() => {
    repo = new InMemoryAtlasAgentRepository();
  });

  // ─── save ──────────────────────────────────────────────────────────────────

  describe('save()', () => {
    it('persists an agent', async () => {
      const agent = AtlasAgent.register(mkParams());
      await repo.save(agent);
      expect(repo.size).toBe(1);
    });

    it('throws RepositoryError when saving the same id twice', async () => {
      const agent = AtlasAgent.register(mkParams());
      await repo.save(agent);
      await expect(repo.save(agent)).rejects.toThrowError(RepositoryError);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('overwrites the stored snapshot', async () => {
      const agent = AtlasAgent.register(mkParams());
      await repo.save(agent);
      agent.markHeartbeat();
      await repo.update(agent);

      const found = await repo.findById(agent.id.toString());
      expect(found!.status.isOnline()).toBe(true);
    });

    it('throws RepositoryError when the agent does not exist', async () => {
      const agent = AtlasAgent.register(mkParams());
      await expect(repo.update(agent)).rejects.toThrowError(RepositoryError);
    });
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the agent when found', async () => {
      const agent = AtlasAgent.register(mkParams());
      await repo.save(agent);
      const found = await repo.findById(agent.id.toString());
      expect(found).not.toBeNull();
      expect(found!.id.toString()).toBe(agent.id.toString());
    });

    it('returns null when not found', async () => {
      const found = await repo.findById('00000000-0000-4000-8000-000000000000');
      expect(found).toBeNull();
    });
  });

  // ─── findByMachineId ───────────────────────────────────────────────────────

  describe('findByMachineId()', () => {
    it('returns the agent whose machineId matches', async () => {
      const agent = AtlasAgent.register(mkParams({ machineId: 'MACHINE-UNIQUE-001' }));
      await repo.save(agent);
      const found = await repo.findByMachineId('MACHINE-UNIQUE-001');
      expect(found).not.toBeNull();
    });

    it('returns null when no agent has that machineId', async () => {
      const found = await repo.findByMachineId('NONEXISTENT-MID');
      expect(found).toBeNull();
    });
  });

  // ─── findByCompany ─────────────────────────────────────────────────────────

  describe('findByCompany()', () => {
    it('returns only agents belonging to the specified company', async () => {
      await repo.save(
        AtlasAgent.register(mkParams({ companyId: 'co-A', machineId: 'MACHINE-A001-ABC' }))
      );
      await repo.save(
        AtlasAgent.register(mkParams({ companyId: 'co-A', machineId: 'MACHINE-A002-ABC' }))
      );
      await repo.save(
        AtlasAgent.register(mkParams({ companyId: 'co-B', machineId: 'MACHINE-B001-ABC' }))
      );

      const results = await repo.findByCompany('co-A');
      expect(results).toHaveLength(2);
      expect(results.every((a) => a.companyId === 'co-A')).toBe(true);
    });

    it('returns an empty array when no agents belong to the company', async () => {
      const results = await repo.findByCompany('ghost-company');
      expect(results).toHaveLength(0);
    });
  });

  // ─── findOnline ────────────────────────────────────────────────────────────

  describe('findOnline()', () => {
    it('returns only ONLINE agents', async () => {
      const online = AtlasAgent.register(mkParams({ machineId: 'MACHINE-ON001-XX' }));
      online.markHeartbeat(); // REGISTERING → ONLINE
      await repo.save(online);

      const offline = AtlasAgent.register(mkParams({ machineId: 'MACHINE-OF001-XX' }));
      await repo.save(offline); // stays REGISTERING

      const results = await repo.findOnline();
      expect(results).toHaveLength(1);
      expect(results[0]!.status.isOnline()).toBe(true);
    });

    it('returns empty array when no agents are ONLINE', async () => {
      await repo.save(AtlasAgent.register(mkParams()));
      expect(await repo.findOnline()).toHaveLength(0);
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('removes the agent', async () => {
      const agent = AtlasAgent.register(mkParams());
      await repo.save(agent);
      await repo.delete(agent.id.toString());
      expect(repo.size).toBe(0);
    });

    it('is a no-op when the agent does not exist', async () => {
      await expect(repo.delete('00000000-0000-4000-8000-000000000000')).resolves.not.toThrow();
    });
  });

  // ─── clear / size ──────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('removes all agents', async () => {
      await repo.save(AtlasAgent.register(mkParams({ machineId: 'MACHINE-C001-ABC' })));
      await repo.save(AtlasAgent.register(mkParams({ machineId: 'MACHINE-C002-ABC' })));
      repo.clear();
      expect(repo.size).toBe(0);
    });
  });

  it('reconstituted agent has no pending events', async () => {
    const agent = AtlasAgent.register(mkParams());
    await repo.save(agent);
    const found = await repo.findById(agent.id.toString());
    expect(found!.peekEvents()).toHaveLength(0);
  });

  it('RepositoryError has code REPOSITORY_ERROR', () => {
    const err = new RepositoryError('test');
    expect(err.code).toBe('REPOSITORY_ERROR');
    expect(err.name).toBe('RepositoryError');
  });
});
