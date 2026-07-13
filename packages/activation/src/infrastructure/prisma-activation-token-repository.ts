import type { ActivationTokenRepository } from '../repository/activation-token-repository.js';
import { ActivationToken, type ActivationEnvironment } from '../entity/activation-token.js';
import type { ActivationDbClient, PrismaActivationToken } from './prisma-types.js';

export class PrismaActivationTokenRepository implements ActivationTokenRepository {
  constructor(private readonly _db: ActivationDbClient) {}

  async save(token: ActivationToken): Promise<void> {
    const s = token.toSnapshot();
    await this._db.activationToken.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        token: s.token,
        companyId: s.companyId,
        environment: s.environment,
        expiresAt: s.expiresAt,
        usedAt: s.usedAt,
        createdAt: s.createdAt,
        createdBy: s.createdBy,
      },
      update: {
        usedAt: s.usedAt,
      },
    });
  }

  async findByToken(rawToken: string): Promise<ActivationToken | null> {
    const row = await this._db.activationToken.findUnique({ where: { token: rawToken } });
    return row ? this._toDomain(row) : null;
  }

  async findById(id: string): Promise<ActivationToken | null> {
    const row = await this._db.activationToken.findUnique({ where: { id } });
    return row ? this._toDomain(row) : null;
  }

  async findByCompanyId(companyId: string): Promise<ActivationToken[]> {
    const rows = await this._db.activationToken.findMany({ where: { companyId } });
    return rows.map((r) => this._toDomain(r));
  }

  async delete(id: string): Promise<void> {
    await this._db.activationToken.delete({ where: { id } });
  }

  private _toDomain(row: PrismaActivationToken): ActivationToken {
    return ActivationToken.fromSnapshot({
      id: row.id,
      token: row.token,
      companyId: row.companyId,
      environment: row.environment as ActivationEnvironment,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
    });
  }
}
