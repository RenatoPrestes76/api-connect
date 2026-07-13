import { AgentAccessToken } from '../entity/agent-access-token.js';
import type { AgentAccessTokenRepository } from '../repository/agent-access-token-repository.js';
import type { AgentProvisioningDbClient, PrismaAgentAccessToken } from './prisma-types.js';

export class PrismaAgentAccessTokenRepository implements AgentAccessTokenRepository {
  constructor(private readonly _db: AgentProvisioningDbClient) {}

  async save(token: AgentAccessToken): Promise<void> {
    const snap = token.toSnapshot();
    await this._db.agentAccessToken.create({
      data: {
        id: snap.id,
        agentId: snap.agentId,
        tokenHash: snap.tokenHash,
        tokenPrefix: snap.tokenPrefix,
        expiresAt: snap.expiresAt,
        revokedAt: snap.revokedAt,
        lastUsedAt: snap.lastUsedAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<AgentAccessToken | null> {
    const row = await this._db.agentAccessToken.findUnique({ where: { tokenHash } });
    return row ? this._toDomain(row) : null;
  }

  async findByAgentId(agentId: string): Promise<AgentAccessToken[]> {
    const rows = await this._db.agentAccessToken.findMany({ where: { agentId } });
    return rows.map((r) => this._toDomain(r));
  }

  async updateLastUsed(id: string, lastUsedAt: Date): Promise<void> {
    await this._db.agentAccessToken.update({
      where: { id },
      data: { lastUsedAt, updatedAt: new Date() },
    });
  }

  async revoke(id: string): Promise<void> {
    await this._db.agentAccessToken.update({
      where: { id },
      data: { revokedAt: new Date(), updatedAt: new Date() },
    });
  }

  private _toDomain(row: PrismaAgentAccessToken): AgentAccessToken {
    return AgentAccessToken.fromSnapshot({
      id: row.id,
      agentId: row.agentId,
      tokenHash: row.tokenHash,
      tokenPrefix: row.tokenPrefix,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
