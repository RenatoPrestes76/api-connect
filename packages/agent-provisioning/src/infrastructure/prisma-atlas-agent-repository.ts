/**
 * PrismaAtlasAgentRepository — Prisma-backed implementation of AtlasAgentRepository.
 *
 * Requires `pnpm --filter @seltriva/database db:generate` to have been run
 * so that the Prisma client includes the `atlasAgent` model.
 *
 * Soft-delete pattern: `delete()` sets deletedAt instead of removing the row.
 * All read queries filter `deletedAt: null`.
 */
import { AtlasAgent }            from '@seltriva/agent-identity';
import type { AtlasAgentRepository } from '@seltriva/agent-identity';
import type {
  AgentProvisioningDbClient,
  PrismaAtlasAgent,
} from './prisma-types.js';

// ─── Mapping ─────────────────────────────────────────────────────────────────

function toDomain(row: PrismaAtlasAgent): AtlasAgent {
  return AtlasAgent.fromSnapshot({
    id:                  row.id,
    companyId:           row.companyId,
    name:                row.name,
    machineId:           row.machineId,
    hostname:            row.hostname,
    connectorType:       row.connectorType,
    version:             row.version,
    status:              row.status as Parameters<typeof AtlasAgent.fromSnapshot>[0]['status'],
    lastHeartbeat:       row.lastHeartbeat,
    lastSynchronization: row.lastSynchronization,
    createdAt:           row.createdAt,
    updatedAt:           row.updatedAt,
  });
}

// ─── Repository ──────────────────────────────────────────────────────────────

export class PrismaAtlasAgentRepository implements AtlasAgentRepository {
  constructor(private readonly _db: AgentProvisioningDbClient) {}

  async save(agent: AtlasAgent): Promise<void> {
    const snap = agent.toSnapshot();
    await this._db.atlasAgent.create({
      data: {
        id:                  snap.id,
        companyId:           snap.companyId,
        name:                snap.name,
        machineId:           snap.machineId,
        hostname:            snap.hostname,
        connectorType:       snap.connectorType,
        version:             snap.version,
        status:              snap.status,
        lastHeartbeat:       snap.lastHeartbeat,
        lastSynchronization: snap.lastSynchronization,
        deletedAt:           null,
      },
    });
  }

  async update(agent: AtlasAgent): Promise<void> {
    const snap = agent.toSnapshot();
    await this._db.atlasAgent.update({
      where: { id: snap.id },
      data: {
        name:                snap.name,
        hostname:            snap.hostname,
        version:             snap.version,
        status:              snap.status,
        lastHeartbeat:       snap.lastHeartbeat,
        lastSynchronization: snap.lastSynchronization,
        updatedAt:           snap.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<AtlasAgent | null> {
    const row = await this._db.atlasAgent.findUnique({ where: { id } });
    if (!row || row.deletedAt !== null) return null;
    return toDomain(row);
  }

  async findByMachineId(machineId: string): Promise<AtlasAgent | null> {
    const row = await this._db.atlasAgent.findUnique({ where: { machineId } });
    if (!row || row.deletedAt !== null) return null;
    return toDomain(row);
  }

  async findByCompany(companyId: string): Promise<AtlasAgent[]> {
    const rows = await this._db.atlasAgent.findMany({
      where: { companyId, deletedAt: null },
    });
    return rows.map(toDomain);
  }

  async findOnline(): Promise<AtlasAgent[]> {
    const rows = await this._db.atlasAgent.findMany({
      where: { status: 'ONLINE', deletedAt: null },
    });
    return rows.map(toDomain);
  }

  async delete(id: string): Promise<void> {
    await this._db.atlasAgent.updateMany({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }
}
