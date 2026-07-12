/**
 * PostgreSQLConnector — implements the universal Connector interface.
 *
 * Composes:
 *   PostgreSQLConnectionManager  — pool + SSL + session read-only
 *   QueryRunner + CircuitBreaker — execution + fault tolerance
 *   SchemaDiscovery              — catalog queries
 *   TableStatisticsEngine        — stats + profiling
 *   MetadataAggregator           — full introspection report
 */
import type {
  Connector,
  ConnectorDescriptor,
  ConnectorConfig,
  ConnectorCredentials,
  ConnectorState,
  ConnectorResult,
  HealthReport,
  DiscoveryOptions,
  DiscoveryResult,
  DiscoveredItem,
  MetadataTarget,
  ConnectorMetadata,
  ValidationReport,
  AuthResult,
  CapabilitySet,
} from '../core/index.js';
import { PostgreSQLConnectionManager } from './connection.js';
import { QueryRunner, CircuitBreaker, DEFAULT_QUERY_RUNNER_OPTIONS } from './query-runner.js';
import { SchemaDiscovery } from './schema-discovery.js';
import { TableStatisticsEngine } from './statistics.js';
import { MetadataAggregator } from './metadata.js';
import {
  ConnectionError,
  type PostgreSQLConnectorConfig,
  type PostgreSQLIntrospectionReport,
} from './types.js';

// ─── Capability Set ───────────────────────────────────────────────────────────

const PG_CAPS = [
  'read',
  'discover',
  'schema-inference',
  'health-check',
  'statistics',
  'data-profiling',
  'ssl',
  'connection-pooling',
  'circuit-breaker',
  'read-only',
] as const;

function buildCapabilitySet(caps: readonly string[]): CapabilitySet {
  const set = new Set(caps);
  return {
    capabilities: caps,
    has: (c: string) => set.has(c),
    all: () => caps,
  };
}

// ─── Result Helpers ───────────────────────────────────────────────────────────

function ok<T>(data: T, duration: number): ConnectorResult<T> {
  return { success: true, data, duration, timestamp: new Date() };
}

function fail<T>(
  code: string,
  message: string,
  retryable = false,
  err?: Error
): ConnectorResult<T> {
  return {
    success: false,
    error: { code: code as never, message, retryable, originalError: err },
    timestamp: new Date(),
  };
}

// ─── PostgreSQLConnector ──────────────────────────────────────────────────────

export class PostgreSQLConnector implements Connector {
  readonly descriptor: ConnectorDescriptor = {
    id: 'seltriva.connectors.postgresql',
    name: 'PostgreSQL Enterprise Connector',
    version: '0.1.0',
    type: 'database',
    subtype: 'postgresql',
    vendor: 'Seltriva',
    description:
      'Enterprise PostgreSQL connector with schema discovery, statistics and data profiling',
    tags: ['postgresql', 'sql', 'relational', 'read-only', 'schema-discovery'],
  };

  private _state: ConnectorState = 'disconnected';
  private _pgConfig: PostgreSQLConnectorConfig | null = null;
  private _conn: PostgreSQLConnectionManager | null = null;
  private _runner: QueryRunner | null = null;
  private _discovery: SchemaDiscovery | null = null;
  private _statistics: TableStatisticsEngine | null = null;
  private _aggregator: MetadataAggregator | null = null;
  private _lastReport: PostgreSQLIntrospectionReport | null = null;

  get state(): ConnectorState {
    return this._state;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async connect(config: PostgreSQLConnectorConfig): Promise<ConnectorResult<void>> {
    if (this._state === 'ready') return ok(undefined, 0);

    this._state = 'connecting';
    const start = Date.now();
    const pgConfig = config;

    const validation = await this.validate(pgConfig);
    if (!validation.success || !validation.data?.isValid) {
      this._state = 'error';
      const errs = validation.data?.errors.map((e) => e.message).join(', ') ?? 'invalid config';
      return fail('INVALID_CONFIG', errs);
    }

    this._pgConfig = pgConfig;

    const conn = new PostgreSQLConnectionManager();
    conn.onError((err) => {
      console.error('[PostgreSQLConnector] Pool error:', err.message);
    });

    try {
      await conn.connect(pgConfig);
    } catch (err) {
      this._state = 'error';
      const msg =
        err instanceof ConnectionError ? err.message : `Connection failed: ${String(err)}`;
      return fail('CONNECTION_FAILED', msg, true, err as Error);
    }

    const circuitBreaker = new CircuitBreaker(DEFAULT_QUERY_RUNNER_OPTIONS.circuitBreaker);
    const runner = new QueryRunner(conn, circuitBreaker, {
      ...DEFAULT_QUERY_RUNNER_OPTIONS,
      statementTimeoutMs:
        pgConfig.statementTimeoutMs ?? DEFAULT_QUERY_RUNNER_OPTIONS.statementTimeoutMs,
    });

    const discovery = new SchemaDiscovery(runner);
    const statistics = new TableStatisticsEngine(runner);
    const aggregator = new MetadataAggregator(discovery, statistics);

    this._conn = conn;
    this._runner = runner;
    this._discovery = discovery;
    this._statistics = statistics;
    this._aggregator = aggregator;
    this._state = 'ready';

    return ok(undefined, Date.now() - start);
  }

  async disconnect(): Promise<ConnectorResult<void>> {
    if (this._state === 'disconnected') return ok(undefined, 0);

    this._state = 'closing';
    await this._conn?.disconnect().catch(() => undefined);
    this._conn = null;
    this._runner = null;
    this._discovery = null;
    this._statistics = null;
    this._aggregator = null;
    this._lastReport = null;
    this._state = 'disconnected';

    return ok(undefined, 0);
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  async health(): Promise<ConnectorResult<HealthReport>> {
    if (!this._conn) {
      return ok<HealthReport>(
        {
          status: 'unhealthy',
          latencyMs: 0,
          connectionStatus: 'disconnected',
          authStatus: 'unauthenticated',
          warnings: ['Not connected'],
          checkedAt: new Date(),
        },
        0
      );
    }

    const start = Date.now();
    try {
      const { latencyMs, serverVersion } = await this._conn.ping();
      const poolStats = this._conn.poolStats();

      return ok<HealthReport>(
        {
          status: 'healthy',
          latencyMs,
          connectionStatus: 'connected',
          authStatus: 'authenticated',
          warnings: [],
          serverInfo: {
            version: serverVersion,
            poolTotal: poolStats.total,
            poolIdle: poolStats.idle,
          },
          checkedAt: new Date(),
        },
        Date.now() - start
      );
    } catch (err) {
      return ok<HealthReport>(
        {
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          connectionStatus: 'disconnected',
          authStatus: 'unauthenticated',
          warnings: [err instanceof Error ? err.message : 'Ping failed'],
          checkedAt: new Date(),
        },
        Date.now() - start
      );
    }
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  async discover(options?: DiscoveryOptions): Promise<ConnectorResult<DiscoveryResult>> {
    if (!this._discovery) return fail('NOT_CONNECTED', 'Not connected');

    const start = Date.now();
    try {
      const schemas = await this._discovery.getSchemas();
      const limit = options?.limit ?? 200;
      const items: DiscoveredItem[] = [];

      for (const schema of schemas) {
        if (items.length >= limit) break;
        items.push({
          id: `schema:${schema.name}`,
          name: String(schema.name),
          type: 'schema',
          path: String(schema.name),
          metadata: { owner: schema.owner },
        });

        const tables = await this._discovery.getTables(schema.name);
        for (const table of tables) {
          if (items.length >= limit) break;
          items.push({
            id: `table:${schema.name}.${table.name}`,
            name: String(table.name),
            type: 'table',
            path: `${schema.name}.${table.name}`,
            metadata: {
              schema: String(schema.name),
              comment: table.comment,
              isPartitioned: table.isPartitioned,
            },
          });
        }
      }

      return ok<DiscoveryResult>(
        {
          items,
          total: items.length,
          truncated: items.length === limit,
          discoveredAt: new Date(),
        },
        Date.now() - start
      );
    } catch (err) {
      return fail(
        'DISCOVERY_FAILED',
        err instanceof Error ? err.message : String(err),
        true,
        err as Error
      );
    }
  }

  // ─── Metadata ─────────────────────────────────────────────────────────────

  async metadata(_target?: MetadataTarget): Promise<ConnectorResult<ConnectorMetadata>> {
    if (!this._aggregator || !this._pgConfig) return fail('NOT_CONNECTED', 'Not connected');

    const start = Date.now();
    try {
      const report = await this._aggregator.buildReport(this._pgConfig.discovery ?? {});

      // Patch in connection details
      const fullReport: PostgreSQLIntrospectionReport = {
        ...report,
        host: this._pgConfig.host,
        port: this._pgConfig.port,
        database: this._pgConfig.database,
      };

      this._lastReport = fullReport;

      return ok<ConnectorMetadata>(
        {
          connectorId: this.descriptor.id,
          source: {
            host: this._pgConfig.host,
            port: this._pgConfig.port,
            database: this._pgConfig.database,
          },
          entities: fullReport.schemas.flatMap((s) => s.tables),
          introspectionReport: fullReport,
          retrievedAt: new Date(),
        },
        Date.now() - start
      );
    } catch (err) {
      return fail(
        'METADATA_FAILED',
        err instanceof Error ? err.message : String(err),
        true,
        err as Error
      );
    }
  }

  // ─── Validate ─────────────────────────────────────────────────────────────

  async validate(config: PostgreSQLConnectorConfig): Promise<ConnectorResult<ValidationReport>> {
    const pg = config;
    const errors: { field: string; code: string; message: string }[] = [];
    const warnings: { field: string; code: string; message: string }[] = [];

    if (!pg.host) errors.push({ field: 'host', code: 'REQUIRED', message: 'host is required' });
    if (!pg.database)
      errors.push({ field: 'database', code: 'REQUIRED', message: 'database is required' });
    if (!pg.user) errors.push({ field: 'user', code: 'REQUIRED', message: 'user is required' });
    if (!pg.password)
      errors.push({ field: 'password', code: 'REQUIRED', message: 'password is required' });

    if (pg.port !== undefined && (pg.port < 1 || pg.port > 65535)) {
      errors.push({
        field: 'port',
        code: 'INVALID_RANGE',
        message: 'port must be between 1 and 65535',
      });
    }

    if (pg.maxPoolSize !== undefined && pg.maxPoolSize < 1) {
      errors.push({
        field: 'maxPoolSize',
        code: 'INVALID_RANGE',
        message: 'maxPoolSize must be >= 1',
      });
    }

    if (!pg.ssl) {
      warnings.push({
        field: 'ssl',
        code: 'SECURITY',
        message: 'SSL is not configured — not recommended for production',
      });
    }

    return ok<ValidationReport>({ isValid: errors.length === 0, errors, warnings }, 0);
  }

  // ─── Authenticate ─────────────────────────────────────────────────────────

  async authenticate(_credentials: ConnectorCredentials): Promise<ConnectorResult<AuthResult>> {
    // PostgreSQL authentication happens at connection time via the Pool credentials.
    // This method is a no-op unless called before connect() to override credentials.
    return ok<AuthResult>(
      { authenticated: this._state === 'ready', identity: this._pgConfig?.user ?? 'unknown' },
      0
    );
  }

  // ─── Capabilities ─────────────────────────────────────────────────────────

  capabilities(): CapabilitySet {
    return buildCapabilitySet(PG_CAPS);
  }

  // ─── PostgreSQL-specific Public API ───────────────────────────────────────

  /**
   * Run a full introspection and return the structured report.
   * This is the primary data product of this connector.
   */
  async introspect(
    filter?: PostgreSQLConnectorConfig['discovery']
  ): Promise<PostgreSQLIntrospectionReport> {
    if (!this._aggregator || !this._pgConfig) {
      throw new ConnectionError('Not connected — call connect() first');
    }

    const report = await this._aggregator.buildReport(filter ?? this._pgConfig.discovery ?? {});
    const fullReport: PostgreSQLIntrospectionReport = {
      ...report,
      host: this._pgConfig.host,
      port: this._pgConfig.port,
      database: this._pgConfig.database,
    };

    this._lastReport = fullReport;
    return fullReport;
  }

  get lastReport(): PostgreSQLIntrospectionReport | null {
    return this._lastReport;
  }

  get connectionManager(): PostgreSQLConnectionManager | null {
    return this._conn;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createPostgreSQLConnector(): PostgreSQLConnector {
  return new PostgreSQLConnector();
}

export const POSTGRESQL_CONNECTOR_DESCRIPTOR: ConnectorDescriptor = {
  id: 'seltriva.connectors.postgresql',
  name: 'PostgreSQL Enterprise Connector',
  version: '0.1.0',
  type: 'database',
  subtype: 'postgresql',
  vendor: 'Seltriva',
  description:
    'Enterprise PostgreSQL connector with schema discovery, statistics and data profiling',
};
