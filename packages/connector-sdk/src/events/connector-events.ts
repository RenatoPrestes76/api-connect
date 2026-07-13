import type { HealthStatusKind } from '../interfaces/connector.js';

// ─── Event payloads ────────────────────────────────────────────────────────────

export interface ConnectorStartedEvent {
  readonly connectorId: string;
  readonly version: string;
  readonly startedAt: Date;
}

export interface ConnectorStoppedEvent {
  readonly connectorId: string;
  readonly stoppedAt: Date;
  readonly graceful: boolean;
}

export interface ConnectorFailedEvent {
  readonly connectorId: string;
  readonly error: string;
  readonly code: string;
  readonly failedAt: Date;
  readonly retryable: boolean;
}

export interface SyncStartedEvent {
  readonly connectorId: string;
  readonly jobId: string;
  readonly startedAt: Date;
}

export interface SyncFinishedEvent {
  readonly connectorId: string;
  readonly jobId: string;
  readonly synced: number;
  readonly failed: number;
  readonly durationMs: number;
  readonly finishedAt: Date;
}

export interface HealthChangedEvent {
  readonly connectorId: string;
  readonly previousStatus: HealthStatusKind;
  readonly currentStatus: HealthStatusKind;
  readonly changedAt: Date;
}

export interface DiscoveryFinishedEvent {
  readonly connectorId: string;
  readonly entitiesFound: number;
  readonly durationMs: number;
  readonly finishedAt: Date;
}

// ─── Typed event map ──────────────────────────────────────────────────────────

export interface ConnectorEventMap {
  'connector.started': ConnectorStartedEvent;
  'connector.stopped': ConnectorStoppedEvent;
  'connector.failed': ConnectorFailedEvent;
  'sync.started': SyncStartedEvent;
  'sync.finished': SyncFinishedEvent;
  'health.changed': HealthChangedEvent;
  'discovery.finished': DiscoveryFinishedEvent;
}

export type ConnectorEventType = keyof ConnectorEventMap;
