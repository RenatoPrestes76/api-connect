/**
 * @seltriva/testing
 * Atlas plugin testing framework — test harness, mocks, and assertion helpers.
 *
 * @version 0.1.0
 */

import type {
  Plugin,
  PluginContext,
  PluginManifest,
  PluginResult,
  PluginLogger,
  IPluginConfig,
  IPluginStorage,
  IPluginCredentialStore,
  IPluginEventEmitter,
  IPluginMetrics,
  IPluginHttpClient,
  HttpRequestOptions,
} from '@seltriva/plugin-sdk';

// ─── Test Harness ────────────────────────────────────────────────────────────

export interface IPluginTestHarness<T extends Plugin = Plugin> {
  readonly plugin: T;
  readonly context: MockPluginContext;
  init(): Promise<PluginResult<void>>;
  start(): Promise<PluginResult<void>>;
  stop(): Promise<PluginResult<void>>;
  destroy(): Promise<PluginResult<void>>;
  reset(): void;
}

export interface PluginTestHarnessOptions {
  readonly config?: Record<string, unknown>;
  readonly credentials?: Record<string, string>;
  readonly environment?: 'development' | 'staging' | 'production';
  readonly mockHttp?: MockHttpHandler;
}

export function createTestHarness<T extends Plugin>(
  plugin: T,
  options?: PluginTestHarnessOptions,
): IPluginTestHarness<T> {
  const ctx = createMockContext(plugin.manifest, options);
  return {
    plugin,
    context: ctx,
    init:    () => plugin.init(ctx),
    start:   () => plugin.start(),
    stop:    () => plugin.stop(),
    destroy: () => plugin.destroy(),
    reset:   () => ctx.reset(),
  };
}

// ─── Mock Context ────────────────────────────────────────────────────────────

export interface MockPluginContext extends PluginContext {
  readonly logs: LogRecord[];
  readonly events: EventRecord[];
  readonly metrics: MockMetricsStore;
  readonly httpCalls: HttpCallRecord[];
  reset(): void;
}

export interface LogRecord {
  readonly level: 'error' | 'warn' | 'info' | 'debug';
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly timestamp: Date;
}

export interface EventRecord {
  readonly event: string;
  readonly payload: unknown;
  readonly timestamp: Date;
}

export interface MockMetricsStore {
  readonly counters: Record<string, number>;
  readonly gauges: Record<string, number>;
  readonly timings: Record<string, number[]>;
  increment(name: string, value?: number): void;
  gauge(name: string, value: number): void;
  timing(name: string, durationMs: number): void;
  reset(): void;
}

export interface HttpCallRecord {
  readonly method: string;
  readonly url: string;
  readonly body?: unknown;
  readonly options?: HttpRequestOptions;
  readonly respondedWith: unknown;
  readonly timestamp: Date;
}

export type MockHttpHandler = (
  method: string,
  url: string,
  body?: unknown,
) => PluginResult<unknown>;

export function createMockContext(
  manifest: PluginManifest,
  options?: PluginTestHarnessOptions,
): MockPluginContext {
  const logs:      LogRecord[]    = [];
  const events:    EventRecord[]  = [];
  const httpCalls: HttpCallRecord[] = [];
  const storage    = new Map<string, Buffer>();
  const credentials = new Map<string, string>(
    Object.entries(options?.credentials ?? {}),
  );
  const config     = options?.config ?? {};

  const metricsStore: MockMetricsStore = {
    counters: {},
    gauges:   {},
    timings:  {},
    increment(name, value = 1) { this.counters[name] = (this.counters[name] ?? 0) + value; },
    gauge(name, value)          { this.gauges[name] = value; },
    timing(name, ms)            { (this.timings[name] ??= []).push(ms); },
    reset() {
      Object.keys(this.counters).forEach(k => delete this.counters[k]);
      Object.keys(this.gauges).forEach(k => delete this.gauges[k]);
      Object.keys(this.timings).forEach(k => delete this.timings[k]);
    },
  };

  const logger: PluginLogger = {
    error: (msg, ctx) => logs.push({ level: 'error', message: msg, context: ctx, timestamp: new Date() }),
    warn:  (msg, ctx) => logs.push({ level: 'warn',  message: msg, context: ctx, timestamp: new Date() }),
    info:  (msg, ctx) => logs.push({ level: 'info',  message: msg, context: ctx, timestamp: new Date() }),
    debug: (msg, ctx) => logs.push({ level: 'debug', message: msg, context: ctx, timestamp: new Date() }),
    child: (_b) => logger,
  };

  const pluginConfig: IPluginConfig = {
    get: <T>(key: string) => config[key] as T | undefined,
    getRequired: <T>(key: string) => {
      if (config[key] === undefined) throw new Error(`Config key "${key}" is required`);
      return config[key] as T;
    },
    getAll: () => ({ ...config }),
    validate: () => ({ ok: true, value: undefined }),
  };

  const pluginStorage: IPluginStorage = {
    get:    async (key) => storage.get(key) ?? null,
    set:    async (key, val) => { storage.set(key, val); },
    delete: async (key) => { storage.delete(key); },
    list:   async (prefix) => [...storage.keys()].filter(k => !prefix || k.startsWith(prefix)),
  };

  const credStore: IPluginCredentialStore = {
    get:    async (id) => credentials.get(id) ?? null,
    set:    async (id, val) => { credentials.set(id, val); },
    delete: async (id) => { credentials.delete(id); },
  };

  const handlers = new Map<string, Array<(p: unknown) => void>>();
  const eventEmitter: IPluginEventEmitter = {
    emit:  (ev, payload) => {
      events.push({ event: ev, payload, timestamp: new Date() });
      handlers.get(ev)?.forEach(h => h(payload));
    },
    on:    (ev, h) => {
      (handlers.get(ev) ?? handlers.set(ev, []).get(ev)!).push(h);
      return () => { const a = handlers.get(ev); if (a) { const i = a.indexOf(h); if (i >= 0) a.splice(i, 1); } };
    },
    once:  (ev, h) => {
      const unsub = eventEmitter.on(ev, (p) => { h(p); unsub(); });
      return unsub;
    },
  };

  const mockHttp = options?.mockHttp;
  const httpClient: IPluginHttpClient = {
    get:    async <T>(url: string, opts?: HttpRequestOptions) => {
      const result = mockHttp ? mockHttp('GET', url) : { ok: true, value: null };
      httpCalls.push({ method: 'GET', url, options: opts, respondedWith: result, timestamp: new Date() });
      return result as PluginResult<T>;
    },
    post:   async <T>(url: string, body?: unknown, opts?: HttpRequestOptions) => {
      const result = mockHttp ? mockHttp('POST', url, body) : { ok: true, value: null };
      httpCalls.push({ method: 'POST', url, body, options: opts, respondedWith: result, timestamp: new Date() });
      return result as PluginResult<T>;
    },
    put:    async <T>(url: string, body?: unknown, opts?: HttpRequestOptions) => {
      const result = mockHttp ? mockHttp('PUT', url, body) : { ok: true, value: null };
      httpCalls.push({ method: 'PUT', url, body, options: opts, respondedWith: result, timestamp: new Date() });
      return result as PluginResult<T>;
    },
    delete: async <T>(url: string, opts?: HttpRequestOptions) => {
      const result = mockHttp ? mockHttp('DELETE', url) : { ok: true, value: null };
      httpCalls.push({ method: 'DELETE', url, options: opts, respondedWith: result, timestamp: new Date() });
      return result as PluginResult<T>;
    },
  };

  const ctx: MockPluginContext = {
    pluginId:    manifest.id as import('@seltriva/plugin-sdk').PluginId,
    version:     manifest.version,
    environment: options?.environment ?? 'development',
    logger,
    config:      pluginConfig,
    storage:     pluginStorage,
    credentials: credStore,
    events:      eventEmitter as unknown as import('@seltriva/plugin-sdk').IPluginEventEmitter,
    metrics:     metricsStore,
    http:        httpClient,
    logs,
    events:      events as unknown as typeof eventEmitter,
    metrics:     metricsStore,
    httpCalls,
    reset() {
      logs.length      = 0;
      events.length    = 0;
      httpCalls.length = 0;
      storage.clear();
      metricsStore.reset();
    },
  } as unknown as MockPluginContext;

  return ctx;
}

// ─── Assertion Helpers ───────────────────────────────────────────────────────

export function assertOk<T>(result: PluginResult<T>): T {
  if (!result.ok) {
    throw new Error(`Expected ok result but got error: [${result.error.code}] ${result.error.message}`);
  }
  return result.value;
}

export function assertFail<T>(result: PluginResult<T>): import('@seltriva/plugin-sdk').PluginError {
  if (result.ok) {
    throw new Error(`Expected error result but got ok with value: ${JSON.stringify(result.value)}`);
  }
  return result.error;
}

export function assertLogContains(
  logs: LogRecord[],
  level: LogRecord['level'],
  text: string,
): void {
  const found = logs.some(l => l.level === level && l.message.includes(text));
  if (!found) {
    throw new Error(
      `Expected ${level} log containing "${text}" but got:\n` +
      logs.map(l => `  [${l.level}] ${l.message}`).join('\n'),
    );
  }
}

export function assertMetricRecorded(
  store: MockMetricsStore,
  name: string,
  expectedValue?: number,
): void {
  const val = store.counters[name] ?? store.gauges[name];
  if (val === undefined) {
    throw new Error(`Expected metric "${name}" to be recorded but it was not`);
  }
  if (expectedValue !== undefined && val !== expectedValue) {
    throw new Error(`Expected metric "${name}" = ${expectedValue} but got ${val}`);
  }
}

// ─── Test Suite Builder ──────────────────────────────────────────────────────

export interface PluginTestSuite {
  readonly name: string;
  readonly tests: PluginTest[];
}

export interface PluginTest {
  readonly name: string;
  readonly fn: () => Promise<void>;
  readonly timeout?: number;
  readonly skip?: boolean;
}

export function describePlugin(name: string, tests: PluginTest[]): PluginTestSuite {
  return { name, tests };
}

export function pluginTest(name: string, fn: () => Promise<void>, options?: { timeout?: number; skip?: boolean }): PluginTest {
  return { name, fn, ...options };
}
