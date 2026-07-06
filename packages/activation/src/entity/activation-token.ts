/**
 * ActivationToken — one-time human-readable token emitted by the Control Plane
 * so a technician can install an Atlas Runtime without editing config files.
 *
 * Format:  ATLAS-XXXX-XXXX-XXXX  (X = uppercase alphanumeric, 36-char alphabet)
 * Expires: configurable (default 30 min)
 * Usage:   consumed exactly once by the installer
 */
import { randomBytes } from 'node:crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivationEnvironment = 'production' | 'staging' | 'development';

export const ACTIVATION_ENVIRONMENTS: ActivationEnvironment[] = [
  'production', 'staging', 'development',
];

export const DEFAULT_EXPIRY_MINUTES = 30;

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export interface ActivationTokenSnapshot {
  readonly id:          string;
  readonly token:       string;
  readonly companyId:   string;
  readonly environment: ActivationEnvironment;
  readonly expiresAt:   Date;
  readonly usedAt:      Date | null;
  readonly createdAt:   Date;
  readonly createdBy:   string | null;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class ActivationToken {
  private constructor(private readonly _s: ActivationTokenSnapshot) {}

  // ─── Factory: generate ──────────────────────────────────────────────────────

  static generate(
    companyId:        string,
    environment:      ActivationEnvironment,
    expiresInMinutes: number = DEFAULT_EXPIRY_MINUTES,
    createdBy?:       string,
  ): ActivationToken {
    if (!companyId?.trim())    throw new ActivationTokenError('companyId is required');
    if (expiresInMinutes <= 0) throw new ActivationTokenError('expiresInMinutes must be positive');
    if (!ACTIVATION_ENVIRONMENTS.includes(environment)) {
      throw new ActivationTokenError(`Invalid environment: ${environment}`);
    }

    return new ActivationToken({
      id:          randomBytes(12).toString('hex'),
      token:       ActivationToken._generateCode(),
      companyId:   companyId.trim(),
      environment,
      expiresAt:   new Date(Date.now() + expiresInMinutes * 60_000),
      usedAt:      null,
      createdAt:   new Date(),
      createdBy:   createdBy ?? null,
    });
  }

  static fromSnapshot(s: ActivationTokenSnapshot): ActivationToken {
    return new ActivationToken({ ...s });
  }

  // ─── Domain methods ─────────────────────────────────────────────────────────

  isExpired(): boolean { return this._s.expiresAt < new Date(); }
  isUsed():    boolean { return this._s.usedAt !== null; }
  isValid():   boolean { return !this.isExpired() && !this.isUsed(); }

  markUsed(): ActivationToken {
    if (this.isUsed())    throw new ActivationTokenError('Token has already been used');
    if (this.isExpired()) throw new ActivationTokenError('Token has expired');
    return new ActivationToken({ ...this._s, usedAt: new Date() });
  }

  toSnapshot(): ActivationTokenSnapshot { return { ...this._s }; }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  get id():          string                 { return this._s.id;          }
  get token():       string                 { return this._s.token;       }
  get companyId():   string                 { return this._s.companyId;   }
  get environment(): ActivationEnvironment  { return this._s.environment; }
  get expiresAt():   Date                   { return this._s.expiresAt;   }
  get usedAt():      Date | null            { return this._s.usedAt;      }
  get createdAt():   Date                   { return this._s.createdAt;   }
  get createdBy():   string | null          { return this._s.createdBy;   }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private static _generateCode(): string {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const seg = (): string =>
      Array.from({ length: 4 }, () => CHARS[randomBytes(1)[0] % CHARS.length]).join('');
    return `ATLAS-${seg()}-${seg()}-${seg()}`;
  }
}

// ─── Error ───────────────────────────────────────────────────────────────────

export class ActivationTokenError extends Error {
  readonly code = 'ACTIVATION_TOKEN_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ActivationTokenError';
  }
}
