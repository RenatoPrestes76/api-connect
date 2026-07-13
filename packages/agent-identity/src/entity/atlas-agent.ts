/**
 * AtlasAgent — the core domain entity for ARGUS.
 *
 * Invariants enforced:
 *  - A DISABLED agent cannot transition to any other state.
 *  - lastHeartbeat is only updated when the agent is reachable.
 *  - Version upgrades only accepted when the new version is strictly newer.
 *  - The entity accumulates domain events; callers drain them via pullEvents().
 *
 * All mutations are captured as domain events; the entity itself never
 * communicates with infrastructure.
 */
import { randomUUID } from 'crypto';
import { AgentId } from '../value-objects/agent-id.js';
import { MachineId } from '../value-objects/machine-id.js';
import { Hostname } from '../value-objects/hostname.js';
import { AgentVersion } from '../value-objects/agent-version.js';
import { AgentStatus, AgentStatusKind } from '../value-objects/agent-status.js';
import type {
  AgentDomainEvent,
  AgentRegistered,
  HeartbeatReceived,
  SynchronizationCompleted,
  AgentDisabled,
  AgentEnabled,
  AgentVersionUpdated,
  AgentHostnameUpdated,
} from '../events/agent-events.js';

// ─── Construction params ──────────────────────────────────────────────────────

export interface RegisterAgentParams {
  readonly companyId: string;
  readonly name: string;
  readonly hostname: string;
  readonly machineId: string;
  readonly connectorType: string;
  readonly version: string;
}

// ─── Snapshot (for persistence / reconstitution) ─────────────────────────────

export interface AtlasAgentSnapshot {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly hostname: string;
  readonly machineId: string;
  readonly connectorType: string;
  readonly version: string;
  readonly status: AgentStatusKind;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastHeartbeat: Date | null;
  readonly lastSynchronization: Date | null;
}

// ─── Entity ───────────────────────────────────────────────────────────────────

export class AtlasAgent {
  private _status: AgentStatus;
  private _version: AgentVersion;
  private _updatedAt: Date;
  private _lastHeartbeat: Date | null;
  private _lastSynchronization: Date | null;
  private readonly _events: AgentDomainEvent[] = [];
  private _eventSeq: number = 0;

  private constructor(
    private readonly _id: AgentId,
    private readonly _companyId: string,
    private readonly _name: string,
    private _hostname: Hostname,
    private readonly _machineId: MachineId,
    private readonly _connectorType: string,
    version: AgentVersion,
    status: AgentStatus,
    private readonly _createdAt: Date,
    updatedAt: Date,
    lastHeartbeat: Date | null,
    lastSynchronization: Date | null
  ) {
    this._version = version;
    this._status = status;
    this._updatedAt = updatedAt;
    this._lastHeartbeat = lastHeartbeat;
    this._lastSynchronization = lastSynchronization;
  }

  // ─── Factory: new registration ──────────────────────────────────────────────

  static register(params: RegisterAgentParams): AtlasAgent {
    if (!params.companyId?.trim()) {
      throw new AgentDomainError('companyId is required');
    }
    if (!params.name?.trim()) {
      throw new AgentDomainError('name is required');
    }
    if (!params.connectorType?.trim()) {
      throw new AgentDomainError('connectorType is required');
    }

    const now = new Date();
    const agent = new AtlasAgent(
      AgentId.generate(),
      params.companyId.trim(),
      params.name.trim(),
      Hostname.fromString(params.hostname),
      MachineId.fromString(params.machineId),
      params.connectorType.trim(),
      AgentVersion.fromString(params.version),
      AgentStatus.initial(),
      now,
      now,
      null,
      null
    );

    const evt: AgentRegistered = {
      eventId: randomUUID(),
      type: 'AtlasAgent.Registered',
      aggregateId: agent._id.toString(),
      occurredAt: now,
      version: agent._nextSeq(),
      agentId: agent._id.toString(),
      companyId: agent._companyId,
      name: agent._name,
      machineId: agent._machineId.toString(),
      hostname: agent._hostname.toString(),
      connectorType: agent._connectorType,
      agentVersion: agent._version.toString(),
    };
    agent._push(evt);

    return agent;
  }

  // ─── Factory: reconstitution from persistence ───────────────────────────────

  static fromSnapshot(snap: AtlasAgentSnapshot): AtlasAgent {
    return new AtlasAgent(
      AgentId.fromString(snap.id),
      snap.companyId,
      snap.name,
      Hostname.fromString(snap.hostname),
      MachineId.fromString(snap.machineId),
      snap.connectorType,
      AgentVersion.fromString(snap.version),
      AgentStatus.fromKind(snap.status),
      snap.createdAt,
      snap.updatedAt,
      snap.lastHeartbeat,
      snap.lastSynchronization
    );
  }

  // ─── Domain methods ─────────────────────────────────────────────────────────

  /** Agent sends a heartbeat ping — transitions REGISTERING→ONLINE if needed. */
  markHeartbeat(): void {
    this._assertNotDisabled('markHeartbeat');
    const now = new Date();

    if (this._status.value === AgentStatusKind.REGISTERING) {
      this._status = this._status.transitionTo(AgentStatusKind.ONLINE);
    }

    this._lastHeartbeat = now;
    this._touch(now);

    const evt: HeartbeatReceived = {
      eventId: randomUUID(),
      type: 'AtlasAgent.HeartbeatReceived',
      aggregateId: this._id.toString(),
      occurredAt: now,
      version: this._nextSeq(),
      agentId: this._id.toString(),
      heartbeatAt: now,
    };
    this._push(evt);
  }

  /** Agent disconnects gracefully or times out. */
  markOffline(): void {
    this._assertNotDisabled('markOffline');
    const now = new Date();
    this._status = this._status.transitionTo(AgentStatusKind.OFFLINE);
    this._touch(now);
  }

  /** A sync run begins. */
  markSyncing(): void {
    this._assertNotDisabled('markSyncing');
    const now = new Date();
    this._status = this._status.transitionTo(AgentStatusKind.SYNCING);
    this._touch(now);
  }

  /** A sync run completes — transitions SYNCING→ONLINE and records the time. */
  markSynchronizationFinished(): void {
    this._assertNotDisabled('markSynchronizationFinished');
    const now = new Date();

    if (this._status.isSyncing()) {
      this._status = this._status.transitionTo(AgentStatusKind.ONLINE);
    }

    this._lastSynchronization = now;
    this._touch(now);

    const evt: SynchronizationCompleted = {
      eventId: randomUUID(),
      type: 'AtlasAgent.SynchronizationCompleted',
      aggregateId: this._id.toString(),
      occurredAt: now,
      version: this._nextSeq(),
      agentId: this._id.toString(),
      synchronizedAt: now,
    };
    this._push(evt);
  }

  /** Marks the agent as in an error state. */
  markError(): void {
    this._assertNotDisabled('markError');
    const now = new Date();
    this._status = this._status.transitionTo(AgentStatusKind.ERROR);
    this._touch(now);
  }

  /** Agent recovers — transitions OFFLINE/ERROR → ONLINE. */
  markOnline(): void {
    this._assertNotDisabled('markOnline');
    const now = new Date();
    this._status = this._status.transitionTo(AgentStatusKind.ONLINE);
    this._touch(now);
  }

  /**
   * Updates the agent's hostname (e.g. after a network rename or migration).
   * No-op when the hostname is identical to the current one.
   */
  updateHostname(newHostname: Hostname): void {
    this._assertNotDisabled('updateHostname');
    if (newHostname.equals(this._hostname)) return;
    const now = new Date();
    const oldHostname = this._hostname.toString();
    this._hostname = newHostname;
    this._touch(now);

    const evt: AgentHostnameUpdated = {
      eventId: randomUUID(),
      type: 'AtlasAgent.HostnameUpdated',
      aggregateId: this._id.toString(),
      occurredAt: now,
      version: this._nextSeq(),
      agentId: this._id.toString(),
      oldHostname,
      newHostname: newHostname.toString(),
    };
    this._push(evt);
  }

  /**
   * Upgrades the agent software version.
   * Rejected if `newVersion` is not strictly newer than the current version.
   */
  updateVersion(newVersion: AgentVersion): void {
    this._assertNotDisabled('updateVersion');
    if (!newVersion.isNewerThan(this._version)) {
      throw new AgentDomainError(
        `Cannot downgrade or re-apply version: ${newVersion.toString()} is not newer than ${this._version.toString()}`
      );
    }
    const now = new Date();
    const oldVersion = this._version.toString();
    this._version = newVersion;
    this._touch(now);

    const evt: AgentVersionUpdated = {
      eventId: randomUUID(),
      type: 'AtlasAgent.VersionUpdated',
      aggregateId: this._id.toString(),
      occurredAt: now,
      version: this._nextSeq(),
      agentId: this._id.toString(),
      oldVersion,
      newVersion: newVersion.toString(),
    };
    this._push(evt);
  }

  /** Permanently disables the agent. Idempotent. */
  disable(): void {
    if (this._status.isDisabled()) return;
    const now = new Date();
    this._status = this._status.transitionTo(AgentStatusKind.DISABLED);
    this._touch(now);

    const evt: AgentDisabled = {
      eventId: randomUUID(),
      type: 'AtlasAgent.Disabled',
      aggregateId: this._id.toString(),
      occurredAt: now,
      version: this._nextSeq(),
      agentId: this._id.toString(),
      disabledAt: now,
    };
    this._push(evt);
  }

  /** Re-enables a previously disabled agent, resetting it to REGISTERING. */
  enable(): void {
    if (!this._status.isDisabled()) return;
    const now = new Date();
    this._status = this._status.transitionTo(AgentStatusKind.REGISTERING);
    this._touch(now);

    const evt: AgentEnabled = {
      eventId: randomUUID(),
      type: 'AtlasAgent.Enabled',
      aggregateId: this._id.toString(),
      occurredAt: now,
      version: this._nextSeq(),
      agentId: this._id.toString(),
      enabledAt: now,
    };
    this._push(evt);
  }

  // ─── Domain events ──────────────────────────────────────────────────────────

  /** Returns and clears all accumulated domain events (drain pattern). */
  pullEvents(): readonly AgentDomainEvent[] {
    return this._events.splice(0, this._events.length);
  }

  /** Non-destructive peek at pending events. */
  peekEvents(): readonly AgentDomainEvent[] {
    return [...this._events];
  }

  // ─── Snapshot ───────────────────────────────────────────────────────────────

  toSnapshot(): AtlasAgentSnapshot {
    return {
      id: this._id.toString(),
      companyId: this._companyId,
      name: this._name,
      hostname: this._hostname.toString(),
      machineId: this._machineId.toString(),
      connectorType: this._connectorType,
      version: this._version.toString(),
      status: this._status.value,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      lastHeartbeat: this._lastHeartbeat,
      lastSynchronization: this._lastSynchronization,
    };
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  get id(): AgentId {
    return this._id;
  }
  get companyId(): string {
    return this._companyId;
  }
  get name(): string {
    return this._name;
  }
  get hostname(): Hostname {
    return this._hostname;
  }
  get machineId(): MachineId {
    return this._machineId;
  }
  get connectorType(): string {
    return this._connectorType;
  }
  get version(): AgentVersion {
    return this._version;
  }
  get status(): AgentStatus {
    return this._status;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get lastHeartbeat(): Date | null {
    return this._lastHeartbeat;
  }
  get lastSynchronization(): Date | null {
    return this._lastSynchronization;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _touch(at: Date): void {
    this._updatedAt = at;
  }

  private _nextSeq(): number {
    return ++this._eventSeq;
  }

  private _assertNotDisabled(operation: string): void {
    if (this._status.isDisabled()) {
      throw new AgentDomainError(
        `Cannot perform "${operation}" on a DISABLED agent (id: ${this._id.toString()})`
      );
    }
  }

  private _push(event: AgentDomainEvent): void {
    this._events.push(event);
  }
}

// ─── Domain Errors ────────────────────────────────────────────────────────────

export class AgentDomainError extends Error {
  readonly code = 'AGENT_DOMAIN_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'AgentDomainError';
  }
}
