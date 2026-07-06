/**
 * PostgreSQLConnector — unit tests (all dependencies mocked)
 *
 * Tests: lifecycle (connect/disconnect/state), health, validate,
 * discover, capabilities, introspect, read-only guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgreSQLConnector, createPostgreSQLConnector } from '../connector.js';
import type { PostgreSQLConnectorConfig } from '../types.js';

// ─── Module Mocks ─────────────────────────────────────────────────────────────

const mockConnManager = {
  connect:     vi.fn().mockResolvedValue(undefined),
  disconnect:  vi.fn().mockResolvedValue(undefined),
  acquire:     vi.fn(),
  query:       vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  ping:        vi.fn().mockResolvedValue({ latencyMs: 5, serverVersion: 'PostgreSQL 15.3' }),
  poolStats:   vi.fn().mockReturnValue({ total: 2, idle: 1, waiting: 0 }),
  onError:     vi.fn().mockReturnValue(() => undefined),
  isConnected: true,
  connectedAt: new Date(),
};

const mockRunner = {
  query:         vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  recentMetrics: [],
};

const mockDiscovery = {
  getServerInfo:     vi.fn().mockResolvedValue({ serverVersion: '15.3', encoding: 'UTF8', collation: 'en-US', timezone: 'UTC' }),
  getExtensions:     vi.fn().mockResolvedValue([]),
  getSchemas:        vi.fn().mockResolvedValue([
    { name: 'public', owner: 'postgres' },
  ]),
  getTables:         vi.fn().mockResolvedValue([]),
  getViews:          vi.fn().mockResolvedValue([]),
  getMaterializedViews: vi.fn().mockResolvedValue([]),
  getSequences:      vi.fn().mockResolvedValue([]),
  getEnums:          vi.fn().mockResolvedValue([]),
  discoverTable:     vi.fn().mockResolvedValue({ name: 'test', columns: [], primaryKey: null, foreignKeys: [], indexes: [], isPartitioned: false, comment: null }),
};

const mockStatistics = {
  getTableStatistics: vi.fn().mockResolvedValue({}),
  profileTable:       vi.fn().mockResolvedValue({}),
};

const mockAggregator = {
  buildReport: vi.fn().mockResolvedValue({
    generatedAt:   new Date().toISOString(),
    serverVersion: '15.3',
    encoding:      'UTF8',
    collation:     'en-US',
    timezone:      'UTC',
    extensions:    [],
    schemas:       [],
    host:          'localhost',
    port:          5432,
    database:      'testdb',
  }),
};

vi.mock('../connection.js', () => ({
  PostgreSQLConnectionManager: vi.fn().mockImplementation(() => mockConnManager),
}));

vi.mock('../query-runner.js', () => ({
  QueryRunner:                vi.fn().mockImplementation(() => mockRunner),
  CircuitBreaker:             vi.fn().mockImplementation(() => ({})),
  DEFAULT_QUERY_RUNNER_OPTIONS: {
    statementTimeoutMs: 30_000,
    maxRetries:         3,
    retryDelayMs:       500,
    circuitBreaker:     { failureThreshold: 5, openDurationMs: 30_000, successThreshold: 1 },
  },
}));

vi.mock('../schema-discovery.js', () => ({
  SchemaDiscovery: vi.fn().mockImplementation(() => mockDiscovery),
}));

vi.mock('../statistics.js', () => ({
  TableStatisticsEngine: vi.fn().mockImplementation(() => mockStatistics),
}));

vi.mock('../metadata.js', () => ({
  MetadataAggregator: vi.fn().mockImplementation(() => mockAggregator),
}));

// ─── Config Fixture ───────────────────────────────────────────────────────────

const VALID_CONFIG: PostgreSQLConnectorConfig = {
  id:       'pg-test',
  name:     'Test PG',
  type:     'database',
  host:     'localhost',
  port:     5432,
  database: 'testdb',
  user:     'atlas',
  password: 'secret',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createPostgreSQLConnector()', () => {
  it('returns a PostgreSQLConnector instance', () => {
    const connector = createPostgreSQLConnector();
    expect(connector).toBeInstanceOf(PostgreSQLConnector);
  });

  it('starts in disconnected state', () => {
    const connector = createPostgreSQLConnector();
    expect(connector.state).toBe('disconnected');
  });
});

describe('PostgreSQLConnector', () => {
  let connector: PostgreSQLConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnManager.connect.mockResolvedValue(undefined);
    connector = createPostgreSQLConnector();
  });

  // ─── descriptor ─────────────────────────────────────────────────────────

  describe('descriptor', () => {
    it('has the canonical connector ID', () => {
      expect(connector.descriptor.id).toBe('seltriva.connectors.postgresql');
    });

    it('reports postgresql type and subtype', () => {
      expect(connector.descriptor.type).toBe('database');
      expect(connector.descriptor.subtype).toBe('postgresql');
    });
  });

  // ─── validate() ─────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('accepts a valid config', async () => {
      const result = await connector.validate(VALID_CONFIG);
      expect(result.success).toBe(true);
      expect(result.data?.isValid).toBe(true);
      expect(result.data?.errors).toHaveLength(0);
    });

    it('rejects config without host', async () => {
      const result = await connector.validate({ ...VALID_CONFIG, host: '' });
      expect(result.data?.isValid).toBe(false);
      expect(result.data?.errors.some((e) => /host/i.test(e.message))).toBe(true);
    });

    it('rejects config without database', async () => {
      const result = await connector.validate({ ...VALID_CONFIG, database: '' });
      expect(result.data?.isValid).toBe(false);
      expect(result.data?.errors.some((e) => /database/i.test(e.message))).toBe(true);
    });

    it('rejects config without user', async () => {
      const result = await connector.validate({ ...VALID_CONFIG, user: '' });
      expect(result.data?.isValid).toBe(false);
      expect(result.data?.errors.some((e) => /user/i.test(e.message))).toBe(true);
    });

    it('rejects config without password', async () => {
      const result = await connector.validate({ ...VALID_CONFIG, password: '' });
      expect(result.data?.isValid).toBe(false);
      expect(result.data?.errors.some((e) => /password/i.test(e.message))).toBe(true);
    });

    it('rejects out-of-range port', async () => {
      const result = await connector.validate({ ...VALID_CONFIG, port: 99999 });
      expect(result.data?.isValid).toBe(false);
    });

    it('adds SSL warning when ssl is not configured', async () => {
      const result = await connector.validate({ ...VALID_CONFIG, ssl: undefined });
      expect(result.data?.warnings?.some((w) => /ssl/i.test(w.message))).toBe(true);
    });
  });

  // ─── connect() ──────────────────────────────────────────────────────────

  describe('connect()', () => {
    it('transitions to ready state', async () => {
      const result = await connector.connect(VALID_CONFIG);
      expect(result.success).toBe(true);
      expect(connector.state).toBe('ready');
    });

    it('is idempotent — second connect returns immediately', async () => {
      await connector.connect(VALID_CONFIG);
      await connector.connect(VALID_CONFIG);

      const { PostgreSQLConnectionManager } = await import('../connection.js');
      expect(PostgreSQLConnectionManager).toHaveBeenCalledTimes(1);
    });

    it('returns error when pool connect throws', async () => {
      mockConnManager.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await connector.connect(VALID_CONFIG);

      expect(result.success).toBe(false);
      expect(connector.state).toBe('error');
    });

    it('returns error for invalid config (empty host)', async () => {
      const result = await connector.connect({ ...VALID_CONFIG, host: '' });
      expect(result.success).toBe(false);
    });
  });

  // ─── disconnect() ───────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('transitions back to disconnected state', async () => {
      await connector.connect(VALID_CONFIG);
      const result = await connector.disconnect();

      expect(result.success).toBe(true);
      expect(connector.state).toBe('disconnected');
    });

    it('is idempotent when already disconnected', async () => {
      const result = await connector.disconnect();
      expect(result.success).toBe(true);
    });
  });

  // ─── health() ───────────────────────────────────────────────────────────

  describe('health()', () => {
    it('returns unhealthy when not connected', async () => {
      const result = await connector.health();
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('unhealthy');
    });

    it('returns healthy after connect', async () => {
      await connector.connect(VALID_CONFIG);
      const result = await connector.health();

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('healthy');
      expect(result.data?.latencyMs).toBe(5);
    });
  });

  // ─── capabilities() ─────────────────────────────────────────────────────

  describe('capabilities()', () => {
    it('declares read-only capability', () => {
      const caps = connector.capabilities();
      expect(caps.has('read-only')).toBe(true);
    });

    it('declares schema-discovery capabilities', () => {
      const caps = connector.capabilities();
      expect(caps.has('discover')).toBe(true);
      expect(caps.has('schema-inference')).toBe(true);
      expect(caps.has('statistics')).toBe(true);
    });

    it('declares connection-level capabilities', () => {
      const caps = connector.capabilities();
      expect(caps.has('ssl')).toBe(true);
      expect(caps.has('connection-pooling')).toBe(true);
      expect(caps.has('circuit-breaker')).toBe(true);
    });
  });

  // ─── discover() ─────────────────────────────────────────────────────────

  describe('discover()', () => {
    it('returns error when not connected', async () => {
      const result = await connector.discover();
      expect(result.success).toBe(false);
    });

    it('returns schemas and tables as discovered items', async () => {
      mockDiscovery.getSchemas.mockResolvedValueOnce([
        { name: 'public', owner: 'postgres' },
      ]);
      mockDiscovery.getTables.mockResolvedValueOnce([
        { name: 'pedido', comment: null, isPartitioned: false },
      ]);

      await connector.connect(VALID_CONFIG);
      const result = await connector.discover();

      expect(result.success).toBe(true);
      expect(result.data?.items.length).toBeGreaterThan(0);
    });
  });

  // ─── introspect() ───────────────────────────────────────────────────────

  describe('introspect()', () => {
    it('throws when not connected', async () => {
      await expect(connector.introspect()).rejects.toThrow(/not connected/i);
    });

    it('returns PostgreSQLIntrospectionReport after connect', async () => {
      await connector.connect(VALID_CONFIG);
      const report = await connector.introspect();

      expect(report).toBeDefined();
      expect(report.serverVersion).toBe('15.3');
      expect(report.host).toBe('localhost');
      expect(report.database).toBe('testdb');
    });

    it('passes filter to aggregator.buildReport', async () => {
      await connector.connect(VALID_CONFIG);
      const filter = { includeSchemas: ['vendas'] };

      await connector.introspect(filter);
      expect(mockAggregator.buildReport).toHaveBeenCalledWith(filter);
    });
  });

  // ─── metadata() ─────────────────────────────────────────────────────────

  describe('metadata()', () => {
    it('returns error when not connected', async () => {
      const result = await connector.metadata();
      expect(result.success).toBe(false);
    });

    it('returns ConnectorMetadata with introspection report', async () => {
      await connector.connect(VALID_CONFIG);
      const result = await connector.metadata();

      expect(result.success).toBe(true);
      expect(result.data?.introspectionReport).toBeDefined();
    });
  });
});
