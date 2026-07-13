/**
 * AgentVersion — semantic version (MAJOR.MINOR.PATCH) of the Atlas Agent software.
 * Supports comparison for upgrade enforcement.
 */

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export class AgentVersion {
  private constructor(
    readonly major: number,
    readonly minor: number,
    readonly patch: number
  ) {}

  static fromString(value: string): AgentVersion {
    const m = value?.trim().match(SEMVER_RE);
    if (!m) {
      throw new InvalidAgentVersionError(value);
    }
    return new AgentVersion(parseInt(m[1]!, 10), parseInt(m[2]!, 10), parseInt(m[3]!, 10));
  }

  /** Returns true when this version is strictly newer than `other`. */
  isNewerThan(other: AgentVersion): boolean {
    if (this.major !== other.major) return this.major > other.major;
    if (this.minor !== other.minor) return this.minor > other.minor;
    return this.patch > other.patch;
  }

  /** Returns true when both versions are identical. */
  equals(other: AgentVersion): boolean {
    return this.major === other.major && this.minor === other.minor && this.patch === other.patch;
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}

export class InvalidAgentVersionError extends Error {
  readonly code = 'INVALID_AGENT_VERSION';
  constructor(value: string) {
    super(`Invalid AgentVersion "${value}": expected MAJOR.MINOR.PATCH (e.g. 1.2.3)`);
    this.name = 'InvalidAgentVersionError';
  }
}
