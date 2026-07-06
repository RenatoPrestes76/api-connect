/**
 * @seltriva/connectors/health
 * Health Engine — comprehensive health monitoring for every connector
 */

// ─── Health Engine ─────────────────────────────────────────────────────────

/**
 * The primary interface for connector health monitoring.
 * Every connector must expose a HealthEngine.
 */
export interface HealthEngine {
  /**
   * Perform a full health check.
   * Must NOT throw — all failures are returned inside HealthReport.
   */
  check(): Promise<HealthReport>;

  /**
   * Perform a lightweight ping (latency only, no deep checks)
   */
  ping(): Promise<PingResult>;

  /**
   * Check a specific aspect of health
   */
  checkComponent(component: HealthComponent): Promise<ComponentHealthResult>;

  /**
   * Start continuous health monitoring
   */
  startMonitoring(options: MonitoringOptions): void;

  /**
   * Stop continuous health monitoring
   */
  stopMonitoring(): void;

  /**
   * Subscribe to health change events
   */
  onStatusChange(handler: (event: HealthChangeEvent) => void): string;

  /**
   * Unsubscribe from health change events
   */
  offStatusChange(subscriptionId: string): void;

  /**
   * Return the last health report without re-checking
   */
  getLastReport(): HealthReport | null;
}

// ─── Health Status ────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export type HealthComponent =
  | 'connection'
  | 'authentication'
  | 'latency'
  | 'permissions'
  | 'version'
  | 'storage'
  | 'throughput'
  | 'all';

// ─── Health Report ─────────────────────────────────────────────────────────

/**
 * Comprehensive health report returned by check()
 */
export interface HealthReport {
  readonly connectorId: string;
  readonly status: HealthStatus;
  readonly components: ComponentHealthResult[];
  readonly latency: LatencyMetrics;
  readonly connection: ConnectionStatus;
  readonly authentication: AuthenticationStatus;
  readonly permissions: PermissionStatus[];
  readonly version: VersionInfo;
  readonly serverInfo: ServerInfo;
  readonly warnings: HealthWarning[];
  readonly checkedAt: Date;
  readonly durationMs: number;
}

// ─── Component Health ─────────────────────────────────────────────────────

export interface ComponentHealthResult {
  readonly component: HealthComponent;
  readonly status: HealthStatus;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
  readonly durationMs: number;
}

// ─── Latency Metrics ─────────────────────────────────────────────────────

export interface LatencyMetrics {
  readonly currentMs: number;
  readonly averageMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly samples: number;
  readonly rating: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
}

// ─── Connection Status ────────────────────────────────────────────────────

export interface ConnectionStatus {
  readonly connected: boolean;
  readonly state: 'open' | 'closed' | 'unstable' | 'pooled';
  readonly poolSize?: number;
  readonly activeConnections?: number;
  readonly idleConnections?: number;
  readonly waitingRequests?: number;
  readonly reconnectAttempts?: number;
  readonly connectedSince?: Date;
  readonly lastSuccessfulPing?: Date;
}

// ─── Authentication Status ────────────────────────────────────────────────

export interface AuthenticationStatus {
  readonly authenticated: boolean;
  readonly method: string;
  readonly identity?: string;
  readonly expiresAt?: Date;
  readonly isExpired: boolean;
  readonly roles?: string[];
  readonly lastAuthAt?: Date;
}

// ─── Permission Status ────────────────────────────────────────────────────

export interface PermissionStatus {
  readonly resource: string;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canCreate: boolean;
  readonly canDelete: boolean;
  readonly canAdmin: boolean;
  readonly deniedOperations?: string[];
}

// ─── Version Info ─────────────────────────────────────────────────────────

export interface VersionInfo {
  readonly serverVersion?: string;
  readonly serverEdition?: string;
  readonly driverVersion?: string;
  readonly protocolVersion?: string;
  readonly minSupportedVersion?: string;
  readonly isVersionSupported: boolean;
  readonly versionWarning?: string;
}

// ─── Server Info ──────────────────────────────────────────────────────────

export interface ServerInfo {
  readonly host?: string;
  readonly port?: number;
  readonly region?: string;
  readonly datacenter?: string;
  readonly timezone?: string;
  readonly uptime?: number;
  readonly platform?: string;
  readonly features?: string[];
  readonly extra?: Record<string, unknown>;
}

// ─── Health Warning ───────────────────────────────────────────────────────

export interface HealthWarning {
  readonly code: HealthWarningCode;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly recommendation?: string;
}

export type HealthWarningCode =
  | 'HIGH_LATENCY'
  | 'CONNECTION_POOL_EXHAUSTED'
  | 'AUTH_EXPIRING_SOON'
  | 'AUTH_EXPIRED'
  | 'PERMISSION_MISSING'
  | 'VERSION_UNSUPPORTED'
  | 'VERSION_DEPRECATED'
  | 'SSL_EXPIRING_SOON'
  | 'DISK_SPACE_LOW'
  | 'CONNECTION_UNSTABLE'
  | 'RATE_LIMIT_APPROACHING'
  | 'CUSTOM';

// ─── Ping ────────────────────────────────────────────────────────────────

export interface PingResult {
  readonly reachable: boolean;
  readonly latencyMs: number;
  readonly timestamp: Date;
  readonly error?: string;
}

// ─── Monitoring ──────────────────────────────────────────────────────────

export interface MonitoringOptions {
  readonly intervalMs: number;
  readonly components?: HealthComponent[];
  readonly alertOnStatus?: HealthStatus[];
  readonly timeout?: number;
}

export interface HealthChangeEvent {
  readonly connectorId: string;
  readonly previousStatus: HealthStatus;
  readonly currentStatus: HealthStatus;
  readonly report: HealthReport;
  readonly changedAt: Date;
}

// ─── Health Check Registry ─────────────────────────────────────────────────

/**
 * Aggregates health reports from all active connectors
 */
export interface ConnectorHealthRegistry {
  register(connectorId: string, engine: HealthEngine): void;
  unregister(connectorId: string): void;
  checkAll(): Promise<Record<string, HealthReport>>;
  getOverallStatus(): Promise<HealthStatus>;
  getReport(connectorId: string): HealthReport | null;
}
