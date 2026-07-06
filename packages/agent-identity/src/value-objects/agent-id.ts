/**
 * AgentId — uniquely identifies an AtlasAgent instance.
 * Wraps a UUID v4 string and validates its format.
 */
import { randomUUID } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AgentId {
  private constructor(private readonly _value: string) {}

  static generate(): AgentId {
    return new AgentId(randomUUID());
  }

  static fromString(value: string): AgentId {
    if (!value || !UUID_RE.test(value.trim())) {
      throw new InvalidAgentIdError(value);
    }
    return new AgentId(value.trim().toLowerCase());
  }

  toString(): string { return this._value; }

  equals(other: AgentId): boolean {
    return this._value === other._value;
  }
}

export class InvalidAgentIdError extends Error {
  readonly code = 'INVALID_AGENT_ID';
  constructor(value: string) {
    super(`Invalid AgentId — expected UUID v4, got: "${value}"`);
    this.name = 'InvalidAgentIdError';
  }
}
