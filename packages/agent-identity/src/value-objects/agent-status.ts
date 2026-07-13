/**
 * AgentStatus — lifecycle state of an AtlasAgent.
 *
 * Valid transitions:
 *   REGISTERING → ONLINE
 *   ONLINE      → OFFLINE | SYNCING | ERROR | DISABLED
 *   OFFLINE     → ONLINE  | DISABLED
 *   SYNCING     → ONLINE  | ERROR
 *   ERROR       → ONLINE  | OFFLINE | DISABLED
 *   DISABLED    → REGISTERING (re-enable resets the agent to provisioning state)
 */

export enum AgentStatusKind {
  REGISTERING = 'REGISTERING',
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  SYNCING = 'SYNCING',
  ERROR = 'ERROR',
  DISABLED = 'DISABLED',
}

const VALID_TRANSITIONS: Readonly<Record<AgentStatusKind, readonly AgentStatusKind[]>> = {
  [AgentStatusKind.REGISTERING]: [AgentStatusKind.ONLINE],
  [AgentStatusKind.ONLINE]: [
    AgentStatusKind.OFFLINE,
    AgentStatusKind.SYNCING,
    AgentStatusKind.ERROR,
    AgentStatusKind.DISABLED,
  ],
  [AgentStatusKind.OFFLINE]: [AgentStatusKind.ONLINE, AgentStatusKind.DISABLED],
  [AgentStatusKind.SYNCING]: [AgentStatusKind.ONLINE, AgentStatusKind.ERROR],
  [AgentStatusKind.ERROR]: [
    AgentStatusKind.ONLINE,
    AgentStatusKind.OFFLINE,
    AgentStatusKind.DISABLED,
  ],
  [AgentStatusKind.DISABLED]: [AgentStatusKind.REGISTERING],
};

export class AgentStatus {
  private constructor(private readonly _value: AgentStatusKind) {}

  static initial(): AgentStatus {
    return new AgentStatus(AgentStatusKind.REGISTERING);
  }

  static fromKind(kind: AgentStatusKind): AgentStatus {
    return new AgentStatus(kind);
  }

  /** Attempt a state transition. Returns the new AgentStatus or throws. */
  transitionTo(next: AgentStatusKind): AgentStatus {
    const allowed = VALID_TRANSITIONS[this._value];
    if (!allowed.includes(next)) {
      throw new InvalidStatusTransitionError(this._value, next);
    }
    return new AgentStatus(next);
  }

  /** True when the next transition would be legal. */
  canTransitionTo(next: AgentStatusKind): boolean {
    return VALID_TRANSITIONS[this._value].includes(next);
  }

  get value(): AgentStatusKind {
    return this._value;
  }

  isDisabled(): boolean {
    return this._value === AgentStatusKind.DISABLED;
  }
  isOnline(): boolean {
    return this._value === AgentStatusKind.ONLINE;
  }
  isSyncing(): boolean {
    return this._value === AgentStatusKind.SYNCING;
  }
  isOffline(): boolean {
    return this._value === AgentStatusKind.OFFLINE;
  }
  isError(): boolean {
    return this._value === AgentStatusKind.ERROR;
  }

  equals(other: AgentStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

export class InvalidStatusTransitionError extends Error {
  readonly code = 'INVALID_STATUS_TRANSITION';
  constructor(from: AgentStatusKind, to: AgentStatusKind) {
    super(`Invalid status transition: ${from} → ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}
