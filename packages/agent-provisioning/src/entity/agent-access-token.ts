/**
 * AgentAccessToken — Bearer credential issued to a Runtime Agent on provisioning.
 *
 * Security invariants:
 *  - The raw token is generated once inside `generate()` and returned to the
 *    caller; it is NEVER stored anywhere in this system.
 *  - Only the SHA-256 hash is persisted (tokenHash).
 *  - tokenPrefix (first 12 chars of the raw token) enables fast DB lookup.
 *  - Revoked or expired tokens are permanently unusable.
 */
import { createHash, randomBytes } from 'node:crypto';

// ─── Token generation helpers ─────────────────────────────────────────────────

const TOKEN_PREFIX_TAG = 'aat_';    // Atlas Agent Token
const TOKEN_RANDOM_BYTES = 32;       // 256 bits of entropy

/** Deterministic SHA-256 hash of a raw agent access token (hex string, 64 chars). */
export function hashAgentToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** First 12 characters of the raw token — used for prefix-based DB lookup. */
export function extractAgentTokenPrefix(rawToken: string): string {
  return rawToken.slice(0, 12);
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export interface AgentAccessTokenSnapshot {
  readonly id:          string;
  readonly agentId:     string;
  readonly tokenHash:   string;
  readonly tokenPrefix: string;
  readonly expiresAt:   Date;
  readonly revokedAt:   Date | null;
  readonly lastUsedAt:  Date | null;
  readonly createdAt:   Date;
  readonly updatedAt:   Date;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class AgentAccessToken {
  private _revokedAt:  Date | null;
  private _lastUsedAt: Date | null;
  private _updatedAt:  Date;

  private constructor(
    private readonly _id:          string,
    private readonly _agentId:     string,
    private readonly _tokenHash:   string,
    private readonly _tokenPrefix: string,
    private readonly _expiresAt:   Date,
    revokedAt:   Date | null,
    lastUsedAt:  Date | null,
    private readonly _createdAt: Date,
    updatedAt:   Date,
  ) {
    this._revokedAt  = revokedAt;
    this._lastUsedAt = lastUsedAt;
    this._updatedAt  = updatedAt;
  }

  // ─── Factory: new token ─────────────────────────────────────────────────────

  /**
   * Generates a fresh AgentAccessToken.
   * Returns both the entity (for persistence) and the `rawToken` (for the caller).
   * The raw token is never recoverable after this call.
   */
  static generate(
    agentId:     string,
    expiresAt:   Date,
    idGenerator: () => string = defaultId,
  ): { token: AgentAccessToken; rawToken: string } {
    if (!agentId?.trim()) {
      throw new AgentAccessTokenError('agentId is required');
    }
    if (expiresAt <= new Date()) {
      throw new AgentAccessTokenError('expiresAt must be in the future');
    }

    const rawToken = TOKEN_PREFIX_TAG + randomBytes(TOKEN_RANDOM_BYTES).toString('hex');
    const now      = new Date();
    const token    = new AgentAccessToken(
      idGenerator(),
      agentId.trim(),
      hashAgentToken(rawToken),
      extractAgentTokenPrefix(rawToken),
      expiresAt,
      null,
      null,
      now,
      now,
    );

    return { token, rawToken };
  }

  // ─── Factory: reconstitution ────────────────────────────────────────────────

  static fromSnapshot(snap: AgentAccessTokenSnapshot): AgentAccessToken {
    return new AgentAccessToken(
      snap.id,
      snap.agentId,
      snap.tokenHash,
      snap.tokenPrefix,
      snap.expiresAt,
      snap.revokedAt,
      snap.lastUsedAt,
      snap.createdAt,
      snap.updatedAt,
    );
  }

  // ─── Domain methods ─────────────────────────────────────────────────────────

  /** True when the token has passed its expiry date. */
  isExpired(): boolean { return new Date() >= this._expiresAt; }

  /** True when the token has been explicitly revoked. */
  isRevoked(): boolean { return this._revokedAt !== null; }

  /** True when the token is neither expired nor revoked. */
  isValid(): boolean { return !this.isExpired() && !this.isRevoked(); }

  /** Revokes the token permanently. Idempotent. */
  revoke(): void {
    if (this._revokedAt !== null) return;
    const now       = new Date();
    this._revokedAt = now;
    this._updatedAt = now;
  }

  /** Records the timestamp of the most recent successful use. */
  markUsed(): void {
    if (!this.isValid()) {
      throw new AgentAccessTokenError('Cannot mark an invalid token as used');
    }
    const now        = new Date();
    this._lastUsedAt = now;
    this._updatedAt  = now;
  }

  /** Snapshot for persistence. */
  toSnapshot(): AgentAccessTokenSnapshot {
    return {
      id:          this._id,
      agentId:     this._agentId,
      tokenHash:   this._tokenHash,
      tokenPrefix: this._tokenPrefix,
      expiresAt:   this._expiresAt,
      revokedAt:   this._revokedAt,
      lastUsedAt:  this._lastUsedAt,
      createdAt:   this._createdAt,
      updatedAt:   this._updatedAt,
    };
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  get id():          string    { return this._id; }
  get agentId():     string    { return this._agentId; }
  get tokenHash():   string    { return this._tokenHash; }
  get tokenPrefix(): string    { return this._tokenPrefix; }
  get expiresAt():   Date      { return this._expiresAt; }
  get revokedAt():   Date|null { return this._revokedAt; }
  get lastUsedAt():  Date|null { return this._lastUsedAt; }
  get createdAt():   Date      { return this._createdAt; }
  get updatedAt():   Date      { return this._updatedAt; }
}

// ─── Domain Error ─────────────────────────────────────────────────────────────

export class AgentAccessTokenError extends Error {
  readonly code = 'AGENT_ACCESS_TOKEN_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'AgentAccessTokenError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultId(): string {
  return randomBytes(12).toString('hex');
}
