/**
 * @seltriva/agent — connectors
 * Database connector contracts and cloud bridge.
 *
 * Connectors are read-only by design.
 * The agent NEVER writes to customer databases.
 *
 * Connector kinds:
 *   - DatabaseConnector — connects to customer's local databases
 *   - CloudConnector   — connects to the Seltriva cloud platform (Supabase)
 *
 * All connectors:
 *   - Use TLS for transport encryption
 *   - Use read-only database users
 *   - Pool connections with configurable limits
 *   - Report health metrics
 *   - Support graceful shutdown
 */

import type { AgentResult, ConnectorId, AgentId } from '../configuration/index';
import type { DatabaseType } from '../configuration/index';

// ─── Connector Manager ────────────────────────────────────────────────────

export interface ConnectorManager {
  /**
   * Register a connector from configuration
   */
  register(config: ConnectorDefinition): AgentResult<void>;

  /**
   * Connect (open pool) for a registered connector
   */
  connect(id: ConnectorId): Promise<AgentResult<void>>;

  /**
   * Disconnect (drain pool) for a connector
   */
  disconnect(id: ConnectorId): Promise<AgentResult<void>>;

  /**
   * Get a connected database connector
   */
  getDatabase(id: ConnectorId): DatabaseConnector;

  /**
   * Get the cloud connector
   */
  getCloud(): CloudConnector;

  /**
   * Test connectivity for a connector
   */
  test(id: ConnectorId): Promise<AgentResult<ConnectivityTestResult>>;

  /**
   * List all registered connectors
   */
  list(): ConnectorDescriptor[];

  /**
   * Get connector health
   */
  getHealth(id: ConnectorId): ConnectorHealth;

  /**
   * Connect all registered connectors
   */
  connectAll(): Promise<AgentResult<void>>;

  /**
   * Disconnect all connectors gracefully
   */
  disconnectAll(): Promise<AgentResult<void>>;
}

// ─── Database Connector ───────────────────────────────────────────────────

/**
 * Read-only access to a customer database.
 * Used for schema discovery and metadata extraction only.
 */
export interface DatabaseConnector {
  readonly id: ConnectorId;
  readonly type: DatabaseType;
  readonly isConnected: boolean;

  /**
   * Execute a read-only query and return raw rows
   */
  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<AgentResult<QueryResult<TRow>>>;

  /**
   * Discover all schemas/databases available on this connection
   */
  discoverSchemas(): Promise<AgentResult<SchemaDescriptor[]>>;

  /**
   * Discover all tables and views in a schema
   */
  discoverTables(schema: string): Promise<AgentResult<TableDescriptor[]>>;

  /**
   * Discover columns for a table
   */
  discoverColumns(schema: string, table: string): Promise<AgentResult<ColumnDescriptor[]>>;

  /**
   * Discover indexes for a table
   */
  discoverIndexes(schema: string, table: string): Promise<AgentResult<IndexDescriptor[]>>;

  /**
   * Discover foreign key relationships
   */
  discoverRelationships(schema: string): Promise<AgentResult<RelationshipDescriptor[]>>;

  /**
   * Get row count estimate (does not scan — uses statistics)
   */
  estimateRowCount(schema: string, table: string): Promise<AgentResult<number>>;

  /**
   * Ping the database and return latency
   */
  ping(): Promise<AgentResult<PingResult>>;

  /**
   * Get connection pool statistics
   */
  getPoolStats(): ConnectionPoolStats;

  /**
   * Get the server version and capabilities
   */
  getServerInfo(): Promise<AgentResult<DatabaseServerInfo>>;
}

// ─── Cloud Connector ──────────────────────────────────────────────────────

/**
 * Connects the agent to the Seltriva Connect Platform.
 * All communication uses TLS 1.3 and bearer token authentication.
 */
export interface CloudConnector {
  readonly isConnected: boolean;
  readonly endpoint: string;

  /**
   * Authenticate and establish cloud session
   */
  connect(agentId: AgentId, token: string): Promise<AgentResult<CloudSession>>;

  /**
   * Disconnect and invalidate session
   */
  disconnect(): Promise<AgentResult<void>>;

  /**
   * Send a metadata sync payload to the cloud
   */
  sendPayload(payload: CloudPayload): Promise<AgentResult<CloudPayloadAck>>;

  /**
   * Send a heartbeat to the cloud
   */
  sendHeartbeat(heartbeat: HeartbeatPayload): Promise<AgentResult<void>>;

  /**
   * Report agent health to the cloud
   */
  reportHealth(report: AgentHealthReport): Promise<AgentResult<void>>;

  /**
   * Subscribe to commands from the cloud
   */
  subscribeCommands(handler: CloudCommandHandler): CloudCommandSubscription;

  /**
   * Check connectivity without authentication
   */
  ping(): Promise<AgentResult<PingResult>>;

  /**
   * Get the Supabase realtime connection status
   */
  getRealtimeStatus(): RealtimeStatus;
}

export interface CloudSession {
  readonly sessionId: string;
  readonly agentId: AgentId;
  readonly expiresAt: Date;
  readonly serverVersion: string;
  readonly capabilities: string[];
}

export interface CloudPayload {
  readonly kind: CloudPayloadKind;
  readonly agentId: AgentId;
  readonly connectorId: ConnectorId;
  readonly data: unknown;
  readonly checksum: string;
  readonly compressedSizeBytes?: number;
}

export type CloudPayloadKind =
  | 'schema-discovery'
  | 'metadata-sync'
  | 'incremental-sync'
  | 'health-report'
  | 'diagnostic-report'
  | 'event';

export interface CloudPayloadAck {
  readonly accepted: boolean;
  readonly payloadId: string;
  readonly serverTimestamp: Date;
  readonly warnings?: string[];
}

export interface HeartbeatPayload {
  readonly agentId: AgentId;
  readonly version: string;
  readonly uptime: number;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: Date;
}

export interface AgentHealthReport {
  readonly agentId: AgentId;
  readonly timestamp: Date;
  readonly metrics: HealthMetricsSnapshot;
  readonly connectors: ConnectorHealth[];
}

export type CloudCommandHandler = (command: CloudCommand) => Promise<CloudCommandResult>;

export interface CloudCommand {
  readonly id: string;
  readonly type: CloudCommandType;
  readonly payload: Record<string, unknown>;
  readonly issuedAt: Date;
  readonly expiresAt?: Date;
}

export type CloudCommandType =
  | 'trigger-sync'
  | 'update-config'
  | 'install-update'
  | 'run-diagnostic'
  | 'restart-connector'
  | 'reload-schema'
  | 'revoke-token';

export interface CloudCommandResult {
  readonly commandId: string;
  readonly success: boolean;
  readonly output?: Record<string, unknown>;
  readonly error?: string;
}

export interface CloudCommandSubscription {
  unsubscribe(): void;
}

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// ─── Schema Discovery Types ───────────────────────────────────────────────

export interface SchemaDescriptor {
  readonly name: string;
  readonly tableCount: number;
  readonly viewCount: number;
  readonly owner?: string;
  readonly charset?: string;
  readonly collation?: string;
}

export interface TableDescriptor {
  readonly schema: string;
  readonly name: string;
  readonly kind: 'table' | 'view' | 'materialized-view' | 'external';
  readonly estimatedRowCount?: number;
  readonly comment?: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface ColumnDescriptor {
  readonly schema: string;
  readonly table: string;
  readonly name: string;
  readonly ordinalPosition: number;
  readonly dataType: string;
  readonly isNullable: boolean;
  readonly isPrimaryKey: boolean;
  readonly isUnique: boolean;
  readonly defaultValue?: string;
  readonly maxLength?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly comment?: string;
  readonly isGenerated: boolean;
  readonly isAutoIncrement: boolean;
}

export interface IndexDescriptor {
  readonly schema: string;
  readonly table: string;
  readonly name: string;
  readonly columns: string[];
  readonly isUnique: boolean;
  readonly isPrimary: boolean;
  readonly type: string;
}

export interface RelationshipDescriptor {
  readonly schema: string;
  readonly name: string;
  readonly fromTable: string;
  readonly fromColumns: string[];
  readonly toTable: string;
  readonly toColumns: string[];
  readonly onDelete: 'cascade' | 'set-null' | 'restrict' | 'no-action' | 'set-default';
  readonly onUpdate: 'cascade' | 'set-null' | 'restrict' | 'no-action' | 'set-default';
}

// ─── Query and Connection Types ───────────────────────────────────────────

export interface QueryResult<TRow = Record<string, unknown>> {
  readonly rows: TRow[];
  readonly rowCount: number;
  readonly fields: QueryField[];
  readonly durationMs: number;
}

export interface QueryField {
  readonly name: string;
  readonly dataType: string;
  readonly nullable: boolean;
}

export interface PingResult {
  readonly success: boolean;
  readonly latencyMs: number;
  readonly timestamp: Date;
}

export interface ConnectionPoolStats {
  readonly total: number;
  readonly idle: number;
  readonly busy: number;
  readonly pending: number;
  readonly maxConnections: number;
}

export interface DatabaseServerInfo {
  readonly type: DatabaseType;
  readonly version: string;
  readonly majorVersion: number;
  readonly readOnly: boolean;
  readonly timezone: string;
  readonly charset?: string;
}

export interface HealthMetricsSnapshot {
  readonly cpuPercent: number;
  readonly memoryPercent: number;
  readonly diskPercent: number;
  readonly latencyMs?: number;
}

// ─── Connector Metadata ───────────────────────────────────────────────────

export interface ConnectorDefinition {
  readonly id: ConnectorId;
  readonly type: DatabaseType;
  readonly config: DatabaseConnectorRuntimeConfig;
}

export interface DatabaseConnectorRuntimeConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly poolSize: number;
  readonly connectTimeoutMs: number;
  readonly queryTimeoutMs: number;
}

export interface ConnectorDescriptor {
  readonly id: ConnectorId;
  readonly name: string;
  readonly type: DatabaseType;
  readonly isConnected: boolean;
  readonly registeredAt: Date;
}

export interface ConnectorHealth {
  readonly id: ConnectorId;
  readonly status: 'healthy' | 'degraded' | 'unreachable';
  readonly latencyMs?: number;
  readonly lastCheckedAt: Date;
  readonly errorMessage?: string;
}

export interface ConnectivityTestResult {
  readonly connectorId: ConnectorId;
  readonly success: boolean;
  readonly latencyMs: number;
  readonly serverInfo?: DatabaseServerInfo;
  readonly error?: string;
  readonly testedAt: Date;
}
