/**
 * @seltriva/agent — services
 * Core agent services wired together by the bootstrap module.
 *
 * Services are long-running components that operate throughout the
 * agent's lifetime. Unlike the modules (which are contracts), services
 * are the coordination layer.
 *
 * Core services:
 *   - HeartbeatService      — periodic cloud ping
 *   - AgentRegistrationService — register/deregister with cloud
 *   - CloudBridgeService    — maintains cloud connection, handles commands
 *   - BackgroundFlusher     — drains offline queue when cloud reconnects
 *   - MetadataFingerprintCache — maintains schema fingerprints for diff
 */

import type { AgentResult, AgentId, ConnectorId } from '../configuration/index';
import type { HeartbeatRecord } from '../health/index';

// ─── Service Registry ─────────────────────────────────────────────────────

export interface AgentServiceRegistry {
  readonly heartbeat: HeartbeatService;
  readonly registration: AgentRegistrationService;
  readonly cloudBridge: CloudBridgeService;
  readonly queueFlusher: OfflineQueueFlusher;

  /**
   * Start all services in dependency order
   */
  startAll(): Promise<AgentResult<void>>;

  /**
   * Stop all services in reverse order (graceful shutdown)
   */
  stopAll(): Promise<AgentResult<void>>;
}

// ─── Heartbeat Service ────────────────────────────────────────────────────

export interface HeartbeatService {
  start(agentId: AgentId, intervalMs: number): void;
  stop(): void;
  ping(agentId: AgentId): Promise<AgentResult<void>>;
  getLastHeartbeat(): HeartbeatRecord | null;
  readonly isRunning: boolean;
}

// ─── Agent Registration Service ───────────────────────────────────────────

export interface AgentRegistrationService {
  /**
   * Register this agent with the Seltriva platform.
   * Called once during `seltriva-agent install`.
   */
  register(request: AgentRegistrationRequest): Promise<AgentResult<AgentRegistration>>;

  /**
   * Deregister this agent (used during uninstall)
   */
  deregister(agentId: AgentId): Promise<AgentResult<void>>;

  /**
   * Re-register if the agent's credentials have changed
   */
  reregister(agentId: AgentId): Promise<AgentResult<AgentRegistration>>;

  /**
   * Refresh the agent's registration (renew token)
   */
  refresh(agentId: AgentId): Promise<AgentResult<AgentRegistration>>;

  /**
   * Verify that this agent is known to the platform
   */
  verify(agentId: AgentId): Promise<AgentResult<boolean>>;

  /**
   * Get the current registration info
   */
  getRegistration(): AgentRegistration | null;
}

export interface AgentRegistrationRequest {
  readonly name: string;
  readonly version: string;
  readonly environment: string;
  readonly hostname: string;
  readonly platform: string;
  readonly arch: string;
  readonly nodeVersion: string;
  readonly connectorTypes: string[];
  readonly publicKey?: string;
}

export interface AgentRegistration {
  readonly agentId: AgentId;
  readonly token: string;
  readonly tokenExpiresAt: Date;
  readonly platformVersion: string;
  readonly registeredAt: Date;
  readonly refreshedAt: Date;
  readonly capabilities: string[];
}

// ─── Cloud Bridge Service ─────────────────────────────────────────────────

export interface CloudBridgeService {
  /**
   * Establish and maintain connection to the cloud
   */
  connect(): Promise<AgentResult<void>>;

  /**
   * Disconnect from the cloud
   */
  disconnect(): Promise<AgentResult<void>>;

  /**
   * Send a payload to the cloud
   */
  send(kind: string, payload: unknown): Promise<AgentResult<void>>;

  /**
   * Subscribe to incoming cloud commands
   */
  onCommand(type: string, handler: CloudCommandServiceHandler): void;

  /**
   * Get current connection state
   */
  getState(): CloudBridgeState;

  /**
   * Subscribe to connection state changes
   */
  onStateChange(handler: CloudBridgeStateHandler): CloudBridgeSubscription;
}

export type CloudCommandServiceHandler = (
  payload: Record<string, unknown>
) => Promise<AgentResult<Record<string, unknown> | void>>;

export type CloudBridgeState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type CloudBridgeStateHandler = (state: CloudBridgeState) => void;

export interface CloudBridgeSubscription {
  unsubscribe(): void;
}

// ─── Offline Queue Flusher ────────────────────────────────────────────────

export interface OfflineQueueFlusher {
  /**
   * Start watching for cloud connectivity and flush on reconnect
   */
  start(): void;

  /**
   * Stop the flusher
   */
  stop(): void;

  /**
   * Immediately attempt to flush the offline queue
   */
  flush(): Promise<AgentResult<FlushResult>>;

  /**
   * Get flusher stats
   */
  getStats(): FlusherStats;

  readonly isRunning: boolean;
  readonly isFlushing: boolean;
}

export interface FlushResult {
  readonly flushed: number;
  readonly failed: number;
  readonly remaining: number;
  readonly durationMs: number;
}

export interface FlusherStats {
  readonly totalFlushed: number;
  readonly totalFailed: number;
  readonly lastFlushAt?: Date;
  readonly lastFlushResult?: FlushResult;
}

// ─── Connector Manager Service ────────────────────────────────────────────

export interface ConnectorHealthService {
  /**
   * Continuously poll all connectors and report health
   */
  startPolling(intervalMs: number): void;
  stopPolling(): void;

  /**
   * Get the last health status for a connector
   */
  getConnectorHealth(connectorId: ConnectorId): ConnectorHealthRecord | null;

  /**
   * Get all connector health records
   */
  getAllConnectorHealth(): ConnectorHealthRecord[];
}

export interface ConnectorHealthRecord {
  readonly connectorId: ConnectorId;
  readonly status: 'healthy' | 'degraded' | 'unreachable';
  readonly latencyMs?: number;
  readonly consecutiveFailures: number;
  readonly lastCheckedAt: Date;
  readonly lastSuccessAt?: Date;
}
