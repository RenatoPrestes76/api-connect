/**
 * Tests for Prisma-backed repositories using mock DB clients.
 * No real database connection is needed — the client is injected.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AtlasAgent } from '@seltriva/agent-identity';
import { PrismaAtlasAgentRepository } from '../infrastructure/prisma-atlas-agent-repository.js';
import { PrismaProvisioningTokenRepository } from '../infrastructure/prisma-provisioning-token-repository.js';
import { ProvisioningToken } from '../entity/provisioning-token.js';
import type {
  AgentProvisioningDbClient,
  PrismaAtlasAgent,
  PrismaProvisioningToken,
} from '../infrastructure/prisma-types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 86_400_000);

// Must be valid UUID v4 — AtlasAgent.fromSnapshot calls AgentId.fromString which validates
const AGENT_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const AGENT_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';

function makeAgentRow(overrides: Partial<PrismaAtlasAgent> = {}): PrismaAtlasAgent {
  return {
    id: AGENT_UUID_1,
    companyId: 'co-1',
    name: 'Test Agent',
    machineId: 'MACHINE-PR001-TEST',
    hostname: 'server01',
    connectorType: 'MSSQL',
    version: '1.0.0',
    status: 'REGISTERING',
    lastHeartbeat: null,
    lastSynchronization: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

function makeTokenRow(overrides: Partial<PrismaProvisioningToken> = {}): PrismaProvisioningToken {
  return {
    id: 'tok-001',
    companyId: 'co-1',
    tokenHash: 'a'.repeat(64),
    tokenPrefix: 'slp_aabbccdd',
    description: 'test token',
    expiresAt: FUTURE,
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeAgentRegisterParams(): {
  companyId: string;
  name: string;
  hostname: string;
  machineId: string;
  connectorType: string;
  version: string;
} {
  return {
    companyId: 'co-1',
    name: 'Test Agent',
    hostname: 'server01',
    machineId: 'MACHINE-PR001-TEST',
    connectorType: 'MSSQL',
    version: '1.0.0',
  };
}

// ─── PrismaAtlasAgentRepository ──────────────────────────────────────────────

describe('PrismaAtlasAgentRepository', () => {
  let mockDb: AgentProvisioningDbClient;
  let repo: PrismaAtlasAgentRepository;

  beforeEach(() => {
    mockDb = {
      atlasAgent: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      provisioningToken: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      agentAccessToken: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };
    repo = new PrismaAtlasAgentRepository(mockDb);
  });

  describe('save()', () => {
    it('calls atlasAgent.create with the correct data', async () => {
      const agent = AtlasAgent.register(makeAgentRegisterParams());
      vi.mocked(mockDb.atlasAgent.create).mockResolvedValue(makeAgentRow());

      await repo.save(agent);

      expect(mockDb.atlasAgent.create).toHaveBeenCalledOnce();
      const call = vi.mocked(mockDb.atlasAgent.create).mock.calls[0]![0];
      expect(call.data.machineId).toBe('MACHINE-PR001-TEST');
      expect(call.data.deletedAt).toBeNull();
    });
  });

  describe('update()', () => {
    it('calls atlasAgent.update with the correct id', async () => {
      const agent = AtlasAgent.register(makeAgentRegisterParams());
      vi.mocked(mockDb.atlasAgent.update).mockResolvedValue(makeAgentRow());

      await repo.update(agent);

      expect(mockDb.atlasAgent.update).toHaveBeenCalledOnce();
      const call = vi.mocked(mockDb.atlasAgent.update).mock.calls[0]![0];
      expect(call.where.id).toBe(agent.id.toString());
    });
  });

  describe('findById()', () => {
    it('returns a domain entity when row is found and not deleted', async () => {
      vi.mocked(mockDb.atlasAgent.findUnique).mockResolvedValue(makeAgentRow());
      const result = await repo.findById('agent-001');
      expect(result).not.toBeNull();
      expect(result!.machineId.toString()).toBe('MACHINE-PR001-TEST');
    });

    it('returns null when row is not found', async () => {
      vi.mocked(mockDb.atlasAgent.findUnique).mockResolvedValue(null);
      expect(await repo.findById('ghost')).toBeNull();
    });

    it('returns null when deletedAt is set (soft-deleted)', async () => {
      vi.mocked(mockDb.atlasAgent.findUnique).mockResolvedValue(
        makeAgentRow({ deletedAt: new Date() })
      );
      expect(await repo.findById('agent-001')).toBeNull();
    });
  });

  describe('findByMachineId()', () => {
    it('returns entity when found and not soft-deleted', async () => {
      vi.mocked(mockDb.atlasAgent.findUnique).mockResolvedValue(makeAgentRow());
      const result = await repo.findByMachineId('MACHINE-PR001-TEST');
      expect(result).not.toBeNull();
    });

    it('returns null when soft-deleted', async () => {
      vi.mocked(mockDb.atlasAgent.findUnique).mockResolvedValue(
        makeAgentRow({ deletedAt: new Date() })
      );
      expect(await repo.findByMachineId('MACHINE-PR001-TEST')).toBeNull();
    });

    it('returns null when not found', async () => {
      vi.mocked(mockDb.atlasAgent.findUnique).mockResolvedValue(null);
      expect(await repo.findByMachineId('NONEXISTENT')).toBeNull();
    });
  });

  describe('findByCompany()', () => {
    it('maps all returned rows to domain entities', async () => {
      vi.mocked(mockDb.atlasAgent.findMany).mockResolvedValue([
        makeAgentRow(),
        makeAgentRow({ id: AGENT_UUID_2, machineId: 'MACHINE-PR002-TEST' }),
      ]);
      const results = await repo.findByCompany('co-1');
      expect(results).toHaveLength(2);
    });

    it('returns empty array when none found', async () => {
      vi.mocked(mockDb.atlasAgent.findMany).mockResolvedValue([]);
      expect(await repo.findByCompany('ghost')).toHaveLength(0);
    });
  });

  describe('findOnline()', () => {
    it('queries with status=ONLINE', async () => {
      vi.mocked(mockDb.atlasAgent.findMany).mockResolvedValue([makeAgentRow({ status: 'ONLINE' })]);
      const results = await repo.findOnline();
      expect(results).toHaveLength(1);
      const call = vi.mocked(mockDb.atlasAgent.findMany).mock.calls[0]![0];
      expect(call.where?.status).toBe('ONLINE');
    });
  });

  describe('delete()', () => {
    it('soft-deletes via updateMany', async () => {
      vi.mocked(mockDb.atlasAgent.updateMany).mockResolvedValue({ count: 1 });
      await repo.delete('agent-001');
      const call = vi.mocked(mockDb.atlasAgent.updateMany).mock.calls[0]![0];
      expect(call.where.id).toBe('agent-001');
      expect(call.data.deletedAt).toBeInstanceOf(Date);
    });
  });
});

// ─── PrismaProvisioningTokenRepository ───────────────────────────────────────

describe('PrismaProvisioningTokenRepository', () => {
  let mockDb: AgentProvisioningDbClient;
  let repo: PrismaProvisioningTokenRepository;

  beforeEach(() => {
    mockDb = {
      atlasAgent: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      provisioningToken: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      agentAccessToken: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };
    repo = new PrismaProvisioningTokenRepository(mockDb);
  });

  describe('create()', () => {
    it('calls provisioningToken.create with tokenHash and tokenPrefix', async () => {
      const { token } = ProvisioningToken.create(
        { companyId: 'co-1', description: 'x', expiresAt: FUTURE },
        () => 'tok-id'
      );
      vi.mocked(mockDb.provisioningToken.create).mockResolvedValue(makeTokenRow());

      await repo.create(token);

      expect(mockDb.provisioningToken.create).toHaveBeenCalledOnce();
      const call = vi.mocked(mockDb.provisioningToken.create).mock.calls[0]![0];
      expect(call.data.tokenHash).toBe(token.tokenHash);
      expect(call.data.tokenPrefix).toBe(token.tokenPrefix);
    });
  });

  describe('findByHash()', () => {
    it('returns a domain entity when found', async () => {
      vi.mocked(mockDb.provisioningToken.findUnique).mockResolvedValue(makeTokenRow());
      const result = await repo.findByHash('a'.repeat(64));
      expect(result).not.toBeNull();
      expect(result!.tokenHash).toBe('a'.repeat(64));
    });

    it('returns null when not found', async () => {
      vi.mocked(mockDb.provisioningToken.findUnique).mockResolvedValue(null);
      expect(await repo.findByHash('b'.repeat(64))).toBeNull();
    });
  });

  describe('findByPrefix()', () => {
    it('returns matching tokens', async () => {
      vi.mocked(mockDb.provisioningToken.findMany).mockResolvedValue([makeTokenRow()]);
      const results = await repo.findByPrefix('slp_aabbccdd');
      expect(results).toHaveLength(1);
    });
  });

  describe('revoke()', () => {
    it('calls provisioningToken.update with revokedAt', async () => {
      vi.mocked(mockDb.provisioningToken.update).mockResolvedValue(
        makeTokenRow({ revokedAt: new Date() })
      );
      await repo.revoke('tok-001');
      const call = vi.mocked(mockDb.provisioningToken.update).mock.calls[0]![0];
      expect(call.where.id).toBe('tok-001');
      expect(call.data.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('findActive()', () => {
    it('queries with revokedAt=null and expiresAt > now', async () => {
      vi.mocked(mockDb.provisioningToken.findMany).mockResolvedValue([makeTokenRow()]);
      await repo.findActive('co-1');
      const call = vi.mocked(mockDb.provisioningToken.findMany).mock.calls[0]![0];
      expect(call.where?.revokedAt).toBeNull();
      expect(call.where?.expiresAt?.gt).toBeInstanceOf(Date);
    });
  });

  describe('updateLastUse()', () => {
    it('calls provisioningToken.update with lastUsedAt', async () => {
      vi.mocked(mockDb.provisioningToken.update).mockResolvedValue(makeTokenRow());
      const now = new Date();
      await repo.updateLastUse('tok-001', now);
      const call = vi.mocked(mockDb.provisioningToken.update).mock.calls[0]![0];
      expect(call.data.lastUsedAt).toBe(now);
    });
  });
});
