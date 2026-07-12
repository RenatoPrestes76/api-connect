/**
 * @seltriva/connectors/core
 * Universal Connector base interfaces — the foundation every connector builds on
 */

// ─── Connector Identity ─────────────────────────────────────────────────────

/**
 * Unique descriptor for a connector type
 */
export interface ConnectorDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: ConnectorType;
  readonly subtype: string;
  readonly vendor?: string;
  readonly description?: string;
  readonly tags?: string[];
}

/**
 * Top-level connector type categories
 */
export type ConnectorType = 'database' | 'api' | 'file' | 'cloud' | 'queue' | 'custom';

// ─── Connector Configuration ────────────────────────────────────────────────

/**
 * Base configuration shared by all connectors
 */
export interface ConnectorConfig {
  readonly id: string;
  readonly name: string;
  readonly type: ConnectorType;
  readonly timeout?: number;
  readonly retryAttempts?: number;
  readonly retryDelay?: number;
  readonly poolSize?: number;
  readonly credentials?: ConnectorCredentials;
  readonly options?: Record<string, unknown>;
}

/**
 * Authentication credentials passed to a connector
 */
export interface ConnectorCredentials {
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
  readonly apiKey?: string;
  readonly certificate?: string;
  readonly privateKey?: string;
  readonly extra?: Record<string, unknown>;
}

// ─── Connector Lifecycle ────────────────────────────────────────────────────

/**
 * Connector connection states
 */
export type ConnectorState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticating'
  | 'ready'
  | 'error'
  | 'closing';

/**
 * Core lifecycle hooks fired during state transitions
 */
export interface ConnectorLifecycle {
  beforeConnect?(config: ConnectorConfig): Promise<void>;
  afterConnect?(): Promise<void>;
  beforeDisconnect?(): Promise<void>;
  afterDisconnect?(): Promise<void>;
  onError?(error: ConnectorError): Promise<void>;
  onReconnect?(): Promise<void>;
}

// ─── Universal Connector ────────────────────────────────────────────────────

/**
 * The universal connector interface.
 * Every connector — database, API, file, cloud, queue — must implement this.
 */
export interface Connector {
  /** Immutable descriptor identifying this connector */
  readonly descriptor: ConnectorDescriptor;

  /** Current connection state */
  readonly state: ConnectorState;

  /**
   * Establish the connection to the data source.
   * Must be idempotent: calling connect() on an already-connected connector is a no-op.
   */
  connect(config: ConnectorConfig): Promise<ConnectorResult<void>>;

  /**
   * Gracefully terminate the connection.
   * Must be idempotent: calling disconnect() when already disconnected is a no-op.
   */
  disconnect(): Promise<ConnectorResult<void>>;

  /**
   * Perform a health check against the data source.
   * Must not throw — all errors are captured in the result.
   */
  health(): Promise<ConnectorResult<HealthReport>>;

  /**
   * Discover available entities / endpoints / files / queues in the source.
   */
  discover(options?: DiscoveryOptions): Promise<ConnectorResult<DiscoveryResult>>;

  /**
   * Retrieve rich metadata about the connected source.
   */
  metadata(target?: MetadataTarget): Promise<ConnectorResult<ConnectorMetadata>>;

  /**
   * Validate the given configuration without establishing a real connection.
   */
  validate(config: ConnectorConfig): Promise<ConnectorResult<ValidationReport>>;

  /**
   * Authenticate against the data source using the provided credentials.
   * Called automatically by connect() when credentials are present.
   */
  authenticate(credentials: ConnectorCredentials): Promise<ConnectorResult<AuthResult>>;

  /**
   * Return the set of capabilities this connector supports.
   */
  capabilities(): CapabilitySet;
}

// ─── Result Wrapper ─────────────────────────────────────────────────────────

/**
 * Typed result returned by every connector operation.
 * Never throws — errors are captured in the result.
 */
export interface ConnectorResult<TData = void> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: ConnectorError;
  readonly duration?: number;
  readonly timestamp: Date;
}

// ─── Connector Error ────────────────────────────────────────────────────────

export interface ConnectorError {
  readonly code: ConnectorErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly originalError?: Error;
  readonly retryable: boolean;
}

export type ConnectorErrorCode =
  | 'CONNECTION_FAILED'
  | 'CONNECTION_TIMEOUT'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_CONFIG'
  | 'VALIDATION_FAILED'
  | 'OPERATION_FAILED'
  | 'UNSUPPORTED_OPERATION'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SCHEMA_ERROR'
  | 'UNKNOWN';

// ─── Forward references (defined in their own modules, typed as unknown here)

export interface HealthReport {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latencyMs: number;
  readonly connectionStatus: 'connected' | 'disconnected' | 'unstable';
  readonly authStatus: 'authenticated' | 'unauthenticated' | 'expired';
  readonly permissions?: PermissionStatus[];
  readonly warnings?: string[];
  readonly version?: string;
  readonly serverInfo?: Record<string, unknown>;
  readonly checkedAt: Date;
}

export interface PermissionStatus {
  readonly resource: string;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canAdmin: boolean;
}

export interface DiscoveryOptions {
  readonly depth?: 'shallow' | 'deep' | 'full';
  readonly filter?: string;
  readonly include?: string[];
  readonly exclude?: string[];
  readonly limit?: number;
}

export interface DiscoveryResult {
  readonly items: DiscoveredItem[];
  readonly total: number;
  readonly truncated: boolean;
  readonly discoveredAt: Date;
}

export interface DiscoveredItem {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly path?: string;
  readonly parent?: string;
  readonly children?: DiscoveredItem[];
  readonly metadata?: Record<string, unknown>;
}

export interface MetadataTarget {
  readonly entity?: string;
  readonly schema?: string;
  readonly catalog?: string;
}

export interface ConnectorMetadata {
  readonly connectorId: string;
  readonly source: Record<string, unknown>;
  readonly entities: unknown[];
  readonly retrievedAt: Date;
  /** Connector-specific deep introspection payload (e.g. PostgreSQLIntrospectionReport). */
  readonly introspectionReport?: unknown;
}

export interface ValidationReport {
  readonly isValid: boolean;
  readonly errors: ValidationIssue[];
  readonly warnings: ValidationIssue[];
}

export interface ValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface AuthResult {
  readonly authenticated: boolean;
  readonly identity?: string;
  readonly roles?: string[];
  readonly permissions?: string[];
  readonly expiresAt?: Date;
  readonly token?: string;
}

export interface CapabilitySet {
  readonly capabilities: readonly string[];
  has(capability: string): boolean;
  all(): readonly string[];
}

// ─── Context ────────────────────────────────────────────────────────────────

/**
 * Runtime context injected into connectors by the framework
 */
export interface ConnectorContext {
  readonly connectorId: string;
  readonly logger: unknown;
  readonly config: ConnectorConfig;
  readonly registry: unknown;
  readonly eventBus?: unknown;
}
