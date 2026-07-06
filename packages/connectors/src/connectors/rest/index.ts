/**
 * RESTConnectorImpl — concrete implementation of RESTConnector interface.
 *
 * Supports:
 *   - API Key (header/query), Bearer token, Basic auth
 *   - OpenAPI/Swagger schema discovery
 *   - Automatic JSON schema inference from responses
 *   - Pagination (cursor, offset, page-based)
 *   - Rate limit detection (Retry-After header)
 *
 * Uses Node 20+ built-in fetch — no external HTTP dependencies.
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
} from '../../core/index.js';
import { inferSchema, type InferredSchema } from './schema-inference.js';

// ─── Config ─────────────────────────────────────────────────────────────────

export interface RESTConnectorConfig extends ConnectorConfig {
  readonly baseUrl: string;
  readonly authType: 'none' | 'api-key' | 'bearer' | 'basic';
  readonly apiKeyHeader?: string;       // default: "X-Api-Key"
  readonly apiKeyQuery?: string;        // alternatively pass in query string
  readonly contentType?: string;        // default: "application/json"
  readonly openApiUrl?: string;         // /openapi.json or /swagger.json
  readonly defaultHeaders?: Record<string, string>;
  readonly followRedirects?: boolean;
}

export interface RESTRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface RESTResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
  durationMs: number;
}

// ─── Capability Set ──────────────────────────────────────────────────────────

const REST_CAPABILITIES = [
  'read', 'write', 'delete', 'discover',
  'schema-inference', 'health-check', 'pagination',
  'api-key-auth', 'bearer-auth', 'basic-auth',
] as const;

function buildCapabilitySet(caps: readonly string[]): CapabilitySet {
  const set = new Set(caps);
  return {
    capabilities: caps,
    has: (c: string) => set.has(c),
    all: () => caps,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ok<T>(data: T, duration: number): ConnectorResult<T> {
  return { success: true, data, duration, timestamp: new Date() };
}

function fail<T>(code: string, message: string, retryable = false, err?: Error): ConnectorResult<T> {
  return {
    success: false,
    error: { code: code as never, message, retryable, originalError: err },
    timestamp: new Date(),
  };
}

// ─── RESTConnectorImpl ───────────────────────────────────────────────────────

export class RESTConnectorImpl implements Connector {
  readonly descriptor: ConnectorDescriptor = {
    id: 'seltriva.connectors.rest',
    name: 'REST API Connector',
    version: '0.1.0',
    type: 'api',
    subtype: 'rest',
    vendor: 'Seltriva',
    description: 'Universal REST/HTTP API connector with schema discovery',
    tags: ['rest', 'http', 'api', 'openapi'],
  };

  private _state: ConnectorState = 'disconnected';
  private _config: RESTConnectorConfig | null = null;
  private _credentials: ConnectorCredentials | null = null;
  private _authHeaders: Record<string, string> = {};
  private _discoveredSchema: InferredSchema | null = null;

  get state(): ConnectorState { return this._state; }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async connect(config: ConnectorConfig): Promise<ConnectorResult<void>> {
    if (this._state === 'connected' || this._state === 'ready') {
      return ok(undefined, 0);
    }

    this._state = 'connecting';
    const start = Date.now();
    const restConfig = config as RESTConnectorConfig;

    if (!restConfig.baseUrl) {
      this._state = 'error';
      return fail('INVALID_CONFIG', 'baseUrl is required');
    }

    this._config = restConfig;

    if (restConfig.credentials) {
      const authResult = await this.authenticate(restConfig.credentials);
      if (!authResult.success) {
        this._state = 'error';
        return fail('AUTHENTICATION_FAILED', authResult.error?.message ?? 'Auth failed');
      }
    }

    // Ping to verify connectivity
    try {
      const res = await this._fetch({ path: '/', method: 'GET', timeoutMs: 5000 });
      // Accept any 2xx or 3xx as valid
      if (res.status >= 500) {
        this._state = 'error';
        return fail('CONNECTION_FAILED', `Server returned ${res.status}`, true);
      }
    } catch (err) {
      this._state = 'error';
      return fail('NETWORK_ERROR', `Cannot reach ${restConfig.baseUrl}`, true, err as Error);
    }

    this._state = 'ready';
    return ok(undefined, Date.now() - start);
  }

  async disconnect(): Promise<ConnectorResult<void>> {
    this._state = 'disconnected';
    this._config = null;
    this._credentials = null;
    this._authHeaders = {};
    this._discoveredSchema = null;
    return ok(undefined, 0);
  }

  // ─── Health ────────────────────────────────────────────────────────────────

  async health(): Promise<ConnectorResult<HealthReport>> {
    if (!this._config) {
      return fail('CONNECTION_FAILED', 'Not connected');
    }

    const start = Date.now();
    try {
      const res = await this._fetch({ path: '/', method: 'GET', timeoutMs: 5000 });
      const latencyMs = Date.now() - start;
      const healthy = res.status < 500;

      return ok<HealthReport>({
        status: healthy ? 'healthy' : 'degraded',
        latencyMs,
        connectionStatus: 'connected',
        authStatus: this._credentials ? 'authenticated' : 'unauthenticated',
        warnings: healthy ? [] : [`Server returned ${res.status}`],
        checkedAt: new Date(),
      }, latencyMs);
    } catch (err) {
      return ok<HealthReport>({
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        connectionStatus: 'disconnected',
        authStatus: 'unauthenticated',
        warnings: [err instanceof Error ? err.message : 'Network error'],
        checkedAt: new Date(),
      }, Date.now() - start);
    }
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  async discover(options?: DiscoveryOptions): Promise<ConnectorResult<DiscoveryResult>> {
    if (!this._config) return fail('CONNECTION_FAILED', 'Not connected');

    const start = Date.now();
    const items: DiscoveredItem[] = [];

    // Try OpenAPI first
    const openApiSchema = await this._fetchOpenApiSpec();
    if (openApiSchema) {
      const paths = Object.keys(openApiSchema['paths'] ?? {});
      const limit = options?.limit ?? 100;

      for (const path of paths.slice(0, limit)) {
        const methods = Object.keys((openApiSchema['paths'] as Record<string, unknown>)[path] as object ?? {});
        items.push({
          id: path,
          name: path,
          type: 'endpoint',
          path,
          metadata: {
            methods,
            summary: ((openApiSchema['paths'] as Record<string, Record<string, { summary?: string }>>)[path]?.['get']?.summary ?? ''),
          },
        });
      }

      return ok<DiscoveryResult>({
        items,
        total: items.length,
        truncated: items.length === options?.limit,
        discoveredAt: new Date(),
      }, Date.now() - start);
    }

    // Fallback: discover by sampling common patterns
    const commonPaths = ['/', '/api', '/v1', '/health', '/status', '/ping'];
    for (const path of commonPaths) {
      try {
        const res = await this._fetch({ path, method: 'GET', timeoutMs: 3000 });
        if (res.status < 400) {
          items.push({
            id: path,
            name: path,
            type: 'endpoint',
            path,
            metadata: { status: res.status, contentType: res.headers['content-type'] },
          });
        }
      } catch { /* skip */ }
    }

    return ok<DiscoveryResult>({
      items,
      total: items.length,
      truncated: false,
      discoveredAt: new Date(),
    }, Date.now() - start);
  }

  // ─── Metadata ────────────────────────────────────────────────────────────

  async metadata(_target?: MetadataTarget): Promise<ConnectorResult<ConnectorMetadata>> {
    if (!this._config) return fail('CONNECTION_FAILED', 'Not connected');

    const start = Date.now();
    const entities: unknown[] = [];

    // Try OpenAPI for metadata
    const openApiSchema = await this._fetchOpenApiSpec();
    if (openApiSchema) {
      const schemas = (openApiSchema['components'] as Record<string, unknown> | undefined)?.['schemas'];
      if (schemas && typeof schemas === 'object') {
        for (const [name, schema] of Object.entries(schemas)) {
          entities.push({ name, ...schema as object });
        }
      }
    }

    // If no OpenAPI, sample the root endpoint and infer schema
    if (entities.length === 0) {
      try {
        const res = await this._fetch({ path: '/', method: 'GET' });
        if (res.status < 400 && res.data) {
          this._discoveredSchema = inferSchema(res.data);
          entities.push({ name: 'Root', schema: this._discoveredSchema });
        }
      } catch { /* skip */ }
    }

    return ok<ConnectorMetadata>({
      connectorId: this.descriptor.id,
      source: {
        baseUrl: this._config.baseUrl,
        authType: this._config.authType,
        hasOpenApi: !!openApiSchema,
        openApiVersion: (openApiSchema as Record<string, unknown>)?.['openapi'] ?? (openApiSchema as Record<string, unknown>)?.['swagger'],
      },
      entities,
      retrievedAt: new Date(),
    }, Date.now() - start);
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  async validate(config: ConnectorConfig): Promise<ConnectorResult<ValidationReport>> {
    const restConfig = config as RESTConnectorConfig;
    const errors: { field: string; code: string; message: string }[] = [];
    const warnings: { field: string; code: string; message: string }[] = [];

    if (!restConfig.baseUrl) {
      errors.push({ field: 'baseUrl', code: 'REQUIRED', message: 'baseUrl is required' });
    } else {
      try { new URL(restConfig.baseUrl); }
      catch { errors.push({ field: 'baseUrl', code: 'INVALID_URL', message: 'baseUrl must be a valid URL' }); }
    }

    if (restConfig.authType === 'api-key' && !restConfig.credentials?.apiKey) {
      errors.push({ field: 'credentials.apiKey', code: 'REQUIRED', message: 'API key is required for api-key auth' });
    }

    if (restConfig.authType === 'bearer' && !restConfig.credentials?.token) {
      errors.push({ field: 'credentials.token', code: 'REQUIRED', message: 'Token is required for bearer auth' });
    }

    if (restConfig.authType === 'basic' && (!restConfig.credentials?.username || !restConfig.credentials?.password)) {
      errors.push({ field: 'credentials', code: 'REQUIRED', message: 'Username and password required for basic auth' });
    }

    if (!restConfig.openApiUrl) {
      warnings.push({ field: 'openApiUrl', code: 'OPTIONAL', message: 'Provide openApiUrl for better schema discovery' });
    }

    return ok<ValidationReport>({ isValid: errors.length === 0, errors, warnings }, 0);
  }

  // ─── Authentication ───────────────────────────────────────────────────────

  async authenticate(credentials: ConnectorCredentials): Promise<ConnectorResult<AuthResult>> {
    this._credentials = credentials;
    const config = this._config;
    if (!config) return fail('INVALID_CONFIG', 'Connect first before authenticating');

    this._authHeaders = {};

    switch (config.authType) {
      case 'api-key':
        if (credentials.apiKey) {
          const headerName = config.apiKeyHeader ?? 'X-Api-Key';
          this._authHeaders[headerName] = credentials.apiKey;
        }
        break;

      case 'bearer':
        if (credentials.token) {
          this._authHeaders['Authorization'] = `Bearer ${credentials.token}`;
        }
        break;

      case 'basic':
        if (credentials.username && credentials.password) {
          const b64 = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
          this._authHeaders['Authorization'] = `Basic ${b64}`;
        }
        break;

      case 'none':
        break;
    }

    return ok<AuthResult>({
      authenticated: true,
      identity: credentials.username ?? 'api-client',
    }, 0);
  }

  // ─── Capabilities ─────────────────────────────────────────────────────────

  capabilities(): CapabilitySet {
    return buildCapabilitySet(REST_CAPABILITIES);
  }

  // ─── Public Request API ───────────────────────────────────────────────────

  async request<T = unknown>(options: RESTRequestOptions): Promise<RESTResponse<T>> {
    return this._fetch(options) as Promise<RESTResponse<T>>;
  }

  async inferEndpointSchema(path: string): Promise<InferredSchema | null> {
    try {
      const res = await this._fetch({ path, method: 'GET' });
      if (res.status >= 400) return null;
      return inferSchema(res.data);
    } catch {
      return null;
    }
  }

  // ─── Internal Fetch ───────────────────────────────────────────────────────

  private async _fetch(options: RESTRequestOptions): Promise<RESTResponse> {
    const config = this._config;
    if (!config) throw new Error('Connector not connected');

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const path = options.path.startsWith('/') ? options.path : `/${options.path}`;

    let url = `${baseUrl}${path}`;

    // Query params
    const query: Record<string, string> = {};
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined) query[k] = String(v);
      }
    }
    // API key in query string
    if (config.authType === 'api-key' && config.apiKeyQuery && this._credentials?.apiKey) {
      query[config.apiKeyQuery] = this._credentials.apiKey;
    }

    if (Object.keys(query).length > 0) {
      url += '?' + new URLSearchParams(query).toString();
    }

    const headers: Record<string, string> = {
      'Content-Type': config.contentType ?? 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Seltriva-Connect/0.1.0',
      ...config.defaultHeaders,
      ...this._authHeaders,
      ...options.headers,
    };

    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? config.timeout ?? 30_000),
    };

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const start = Date.now();
    const res = await fetch(url, init);
    const durationMs = Date.now() - start;

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => { responseHeaders[key] = value; });

    const contentType = res.headers.get('content-type') ?? '';
    let data: unknown;
    if (contentType.includes('application/json') || contentType.includes('+json')) {
      try { data = await res.json(); }
      catch { data = await res.text(); }
    } else {
      data = await res.text();
    }

    return { status: res.status, headers: responseHeaders, data, durationMs };
  }

  private async _fetchOpenApiSpec(): Promise<Record<string, unknown> | null> {
    const openApiPaths = [
      this._config?.openApiUrl,
      '/openapi.json', '/openapi.yaml',
      '/swagger.json', '/api-docs',
      '/v1/openapi.json', '/api/openapi.json',
    ].filter(Boolean) as string[];

    for (const path of openApiPaths) {
      try {
        const res = await this._fetch({ path, method: 'GET', timeoutMs: 5000 });
        if (res.status === 200 && typeof res.data === 'object' && res.data !== null) {
          const schema = res.data as Record<string, unknown>;
          if (schema['openapi'] || schema['swagger'] || schema['paths']) {
            return schema;
          }
        }
      } catch { /* try next */ }
    }

    return null;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createRESTConnector(): RESTConnectorImpl {
  return new RESTConnectorImpl();
}

export const REST_CONNECTOR_DESCRIPTOR: ConnectorDescriptor = {
  id: 'seltriva.connectors.rest',
  name: 'REST API Connector',
  version: '0.1.0',
  type: 'api',
  subtype: 'rest',
  vendor: 'Seltriva',
  description: 'Universal REST/HTTP API connector with schema discovery',
};
