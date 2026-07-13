/**
 * PrismaProvisioningTokenRepository — Prisma-backed implementation.
 *
 * Requires `pnpm --filter @seltriva/database db:generate` to have been run.
 */
import { ProvisioningToken, ProvisioningTokenSnapshot } from '../entity/provisioning-token.js';
import type { ProvisioningTokenRepository } from '../repository/provisioning-token-repository.js';
import type { AgentProvisioningDbClient, PrismaProvisioningToken } from './prisma-types.js';

// ─── Mapping ─────────────────────────────────────────────────────────────────

function toDomain(row: PrismaProvisioningToken): ProvisioningToken {
  const snap: ProvisioningTokenSnapshot = {
    id: row.id,
    companyId: row.companyId,
    tokenHash: row.tokenHash,
    tokenPrefix: row.tokenPrefix,
    description: row.description,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return ProvisioningToken.fromSnapshot(snap);
}

// ─── Repository ──────────────────────────────────────────────────────────────

export class PrismaProvisioningTokenRepository implements ProvisioningTokenRepository {
  constructor(private readonly _db: AgentProvisioningDbClient) {}

  async create(token: ProvisioningToken): Promise<void> {
    const snap = token.toSnapshot();
    await this._db.provisioningToken.create({
      data: {
        id: snap.id,
        companyId: snap.companyId,
        tokenHash: snap.tokenHash,
        tokenPrefix: snap.tokenPrefix,
        description: snap.description,
        expiresAt: snap.expiresAt,
        revokedAt: snap.revokedAt,
        lastUsedAt: snap.lastUsedAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<ProvisioningToken | null> {
    const row = await this._db.provisioningToken.findUnique({ where: { tokenHash } });
    return row ? toDomain(row) : null;
  }

  async findByPrefix(tokenPrefix: string): Promise<ProvisioningToken[]> {
    const rows = await this._db.provisioningToken.findMany({ where: { tokenPrefix } });
    return rows.map(toDomain);
  }

  async revoke(id: string): Promise<void> {
    await this._db.provisioningToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async findActive(companyId: string): Promise<ProvisioningToken[]> {
    const rows = await this._db.provisioningToken.findMany({
      where: {
        companyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    return rows.map(toDomain);
  }

  async updateLastUse(id: string, lastUsedAt: Date): Promise<void> {
    await this._db.provisioningToken.update({
      where: { id },
      data: { lastUsedAt },
    });
  }
}
