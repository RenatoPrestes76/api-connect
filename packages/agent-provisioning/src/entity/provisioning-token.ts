/**
 * ProvisioningToken — authorises a Runtime Agent installation to self-register.
 *
 * Security invariants:
 *  - The raw token is generated once inside `create()` and returned to the
 *    caller; it is NEVER stored anywhere in this system.
 *  - Only the SHA-256 hash is persisted (tokenHash).
 *  - tokenPrefix (first 12 chars of the raw token) enables fast DB lookup
 *    without scanning the full tokenHash column.
 *  - Revoked or expired tokens are permanently unusable.
 */
import { createHash, randomBytes } from 'crypto';

// ─── Token generation helpers ─────────────────────────────────────────────────

const TOKEN_PREFIX_TAG = 'slp_'; // Seltriva Agent Provisioning
const TOKEN_RANDOM_BYTES = 32; // 256 bits of entropy

/** Generates a cryptographically random raw provisioning token. */
function generateRawToken(): string {
  return TOKEN_PREFIX_TAG + randomBytes(TOKEN_RANDOM_BYTES).toString('hex');
}

/** Deterministic SHA-256 hash of a raw token (hex string, 64 chars). */
export function hashProvisioningToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** First 12 characters of the raw token — used for prefix-based DB lookup. */
export function extractTokenPrefix(rawToken: string): string {
  return rawToken.slice(0, 12);
}

// ─── Construction params ──────────────────────────────────────────────────────

export interface CreateProvisioningTokenParams {
  readonly companyId: string;
  readonly description: string;
  readonly expiresAt: Date;
}

// ─── Snapshot (persistence DTO) ───────────────────────────────────────────────

export interface ProvisioningTokenSnapshot {
  readonly id: string;
  readonly companyId: string;
  readonly tokenHash: string;
  readonly tokenPrefix: string;
  readonly description: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class ProvisioningToken {
  private _revokedAt: Date | null;
  private _lastUsedAt: Date | null;
  private _updatedAt: Date;

  private constructor(
    private readonly _id: string,
    private readonly _companyId: string,
    private readonly _tokenHash: string,
    private readonly _tokenPrefix: string,
    private readonly _description: string,
    private readonly _expiresAt: Date,
    revokedAt: Date | null,
    lastUsedAt: Date | null,
    private readonly _createdAt: Date,
    updatedAt: Date
  ) {
    this._revokedAt = revokedAt;
    this._lastUsedAt = lastUsedAt;
    this._updatedAt = updatedAt;
  }

  // ─── Factory: new token ─────────────────────────────────────────────────────

  /**
   * Creates a new ProvisioningToken.
   * Returns both the entity (for persistence) and the `rawToken` (to send
   * to the caller — it will never be recoverable after this call).
   */
  static create(
    params: CreateProvisioningTokenParams,
    idGenerator: () => string = defaultId
  ): { token: ProvisioningToken; rawToken: string } {
    if (!params.companyId?.trim()) {
      throw new ProvisioningTokenDomainError('companyId is required');
    }
    if (!params.description?.trim()) {
      throw new ProvisioningTokenDomainError('description is required');
    }
    if (params.expiresAt <= new Date()) {
      throw new ProvisioningTokenDomainError('expiresAt must be in the future');
    }

    const rawToken = generateRawToken();
    const now = new Date();
    const token = new ProvisioningToken(
      idGenerator(),
      params.companyId.trim(),
      hashProvisioningToken(rawToken),
      extractTokenPrefix(rawToken),
      params.description.trim(),
      params.expiresAt,
      null,
      null,
      now,
      now
    );

    return { token, rawToken };
  }

  // ─── Factory: reconstitution ────────────────────────────────────────────────

  static fromSnapshot(snap: ProvisioningTokenSnapshot): ProvisioningToken {
    return new ProvisioningToken(
      snap.id,
      snap.companyId,
      snap.tokenHash,
      snap.tokenPrefix,
      snap.description,
      snap.expiresAt,
      snap.revokedAt,
      snap.lastUsedAt,
      snap.createdAt,
      snap.updatedAt
    );
  }

  // ─── Domain methods ─────────────────────────────────────────────────────────

  /** True when the token has passed its expiry date. */
  isExpired(): boolean {
    return new Date() >= this._expiresAt;
  }

  /** True when the token has been explicitly revoked. */
  isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  /** True when the token is neither expired nor revoked. */
  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  /** Revokes the token permanently. Idempotent. */
  revoke(): void {
    if (this._revokedAt !== null) return;
    const now = new Date();
    this._revokedAt = now;
    this._updatedAt = now;
  }

  /** Records the timestamp of the most recent successful use. */
  markUsed(): void {
    if (!this.isValid()) {
      throw new ProvisioningTokenDomainError('Cannot mark an invalid token as used');
    }
    const now = new Date();
    this._lastUsedAt = now;
    this._updatedAt = now;
  }

  /** Snapshot for persistence. */
  toSnapshot(): ProvisioningTokenSnapshot {
    return {
      id: this._id,
      companyId: this._companyId,
      tokenHash: this._tokenHash,
      tokenPrefix: this._tokenPrefix,
      description: this._description,
      expiresAt: this._expiresAt,
      revokedAt: this._revokedAt,
      lastUsedAt: this._lastUsedAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }
  get companyId(): string {
    return this._companyId;
  }
  get tokenHash(): string {
    return this._tokenHash;
  }
  get tokenPrefix(): string {
    return this._tokenPrefix;
  }
  get description(): string {
    return this._description;
  }
  get expiresAt(): Date {
    return this._expiresAt;
  }
  get revokedAt(): Date | null {
    return this._revokedAt;
  }
  get lastUsedAt(): Date | null {
    return this._lastUsedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}

// ─── Domain Error ─────────────────────────────────────────────────────────────

export class ProvisioningTokenDomainError extends Error {
  readonly code = 'PROVISIONING_TOKEN_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ProvisioningTokenDomainError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultId(): string {
  // Matches CUID2 format used by Prisma; for tests we use any string.
  // In production Prisma generates the id automatically via @default(cuid()).
  return randomBytes(12).toString('hex');
}
