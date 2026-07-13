import type { ActivationTokenRepository } from '../repository/activation-token-repository.js';
import {
  ActivationToken,
  ActivationTokenError,
  DEFAULT_EXPIRY_MINUTES,
  type ActivationEnvironment,
} from '../entity/activation-token.js';

// ─── Input / Output types ────────────────────────────────────────────────────

export interface CreateTokenInput {
  companyId: string;
  environment: ActivationEnvironment;
  expiresInMinutes?: number;
  createdBy?: string;
}

export interface TokenView {
  id: string;
  token: string;
  companyId: string;
  environment: ActivationEnvironment;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
  isValid: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ActivationTokenService {
  constructor(private readonly _repo: ActivationTokenRepository) {}

  async create(input: CreateTokenInput): Promise<ActivationToken> {
    const token = ActivationToken.generate(
      input.companyId,
      input.environment,
      input.expiresInMinutes ?? DEFAULT_EXPIRY_MINUTES,
      input.createdBy
    );
    await this._repo.save(token);
    return token;
  }

  /** Validates without consuming. Throws ActivationTokenError for any violation. */
  async validate(rawToken: string): Promise<ActivationToken> {
    const token = await this._repo.findByToken(rawToken);
    if (!token) throw new ActivationTokenError('Activation token not found');
    if (token.isExpired()) throw new ActivationTokenError('Activation token has expired');
    if (token.isUsed()) throw new ActivationTokenError('Activation token has already been used');
    return token;
  }

  /** Validates and marks as used atomically. Returns the consumed token. */
  async consume(rawToken: string): Promise<ActivationToken> {
    const token = await this.validate(rawToken);
    const used = token.markUsed();
    await this._repo.save(used);
    return used;
  }

  async listByCompany(companyId: string): Promise<TokenView[]> {
    const tokens = await this._repo.findByCompanyId(companyId);
    return tokens.map((t) => this._toView(t));
  }

  /** Hard-deletes (revokes) a token by ID. */
  async revoke(id: string): Promise<void> {
    const token = await this._repo.findById(id);
    if (!token) throw new ActivationTokenError('Activation token not found');
    await this._repo.delete(id);
  }

  private _toView(t: ActivationToken): TokenView {
    return {
      id: t.id,
      token: t.token,
      companyId: t.companyId,
      environment: t.environment,
      expiresAt: t.expiresAt,
      usedAt: t.usedAt,
      createdAt: t.createdAt,
      createdBy: t.createdBy,
      isValid: t.isValid(),
    };
  }
}
