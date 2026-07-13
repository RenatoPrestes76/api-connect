/**
 * Hostname — DNS name or IP address of the host running the agent.
 * Normalised to lowercase; rejects values with spaces or invalid chars.
 */

const MAX_LENGTH = 253;
// Accepts labels (alphanumeric + hyphens), dots for FQDNs, and bare IPv4 addresses.
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$/;

export class Hostname {
  private constructor(private readonly _value: string) {}

  static fromString(value: string): Hostname {
    const v = value?.trim().toLowerCase() ?? '';
    if (!v) {
      throw new InvalidHostnameError(value, 'Must not be empty');
    }
    if (v.length > MAX_LENGTH) {
      throw new InvalidHostnameError(value, `Must be at most ${MAX_LENGTH} characters`);
    }
    if (!HOSTNAME_RE.test(v)) {
      throw new InvalidHostnameError(value, 'Invalid hostname format');
    }
    return new Hostname(v);
  }

  toString(): string {
    return this._value;
  }

  equals(other: Hostname): boolean {
    return this._value === other._value;
  }
}

export class InvalidHostnameError extends Error {
  readonly code = 'INVALID_HOSTNAME';
  constructor(value: string, reason: string) {
    super(`Invalid Hostname "${value}": ${reason}`);
    this.name = 'InvalidHostnameError';
  }
}
