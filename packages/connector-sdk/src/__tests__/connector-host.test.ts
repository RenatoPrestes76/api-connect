import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectorHost } from '../core/connector-host.js';
import { EventBus } from '../events/event-bus.js';
import { HealthRegistry } from '../health/health-registry.js';
import { ConnectorScheduler } from '../scheduler/connector-scheduler.js';
import type { Connector, ConnectorResult, ConnectorHealthStatus } from '../interfaces/connector.js';
import type { ConnectorMetadata } from '../interfaces/metadata.js';
import type { LoadedPlugin } from '../loader/plugin-loader.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  const metadata: ConnectorMetadata = {
    id: 'com.test.conn',
    name: 'Test',
    displayName: 'Test Connector',
    version: '1.0.0',
    sdkVersion: '0.1.0',
    vendor: 'test',
    category: 'database',
    description: 'test',
    compatibility: { min: '0.1.0' },
    dependencies: [],
    permissions: [],
    capabilities: {
      canDiscover: true,
      canSynchronize: true,
      canValidate: true,
      canStream: false,
      canBulkWrite: false,
      supportsSSL: false,
    },
    updatable: true,
  };

  const health: ConnectorHealthStatus = {
    status: 'healthy',
    responseTimeMs: 5,
  };

  return {
    metadata: () => metadata,
    connect: vi.fn().mockResolvedValue({ ok: true, durationMs: 0 }),
    disconnect: vi.fn().mockResolvedValue({ ok: true, durationMs: 0 }),
    validate: vi.fn(),
    discover: vi.fn(),
    synchronize: vi.fn(),
    health: vi.fn().mockResolvedValue({ ok: true, data: health, durationMs: 5 }),
    ...overrides,
  };
}

function makePlugin(id: string, connector: Connector): LoadedPlugin {
  return {
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      sdkVersion: '0.1.0',
      vendor: 'test',
      category: 'database',
      description: 'test',
      entry: 'index.js',
      hash: 'a'.repeat(64),
      signature: '',
      publicKeyId: '',
      capabilities: {
        canDiscover: true,
        canSynchronize: true,
        canValidate: true,
        canStream: false,
        canBulkWrite: false,
        supportsSSL: false,
      },
      updatable: true,
    },
    connector,
  };
}

function makeHost(healthPollIntervalMs = 60_000) {
  const bus = new EventBus();
  const healthReg = new HealthRegistry();
  const scheduler = new ConnectorScheduler();
  const host = new ConnectorHost(bus, healthReg, scheduler, { healthPollIntervalMs });
  return { host, bus, healthReg, scheduler };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConnectorHost — registration', () => {
  it('registers a plugin and finds it by id', () => {
    const { host } = makeHost();
    const connector = makeConnector();
    const plugin = makePlugin('conn-a', connector);

    host.register(plugin);
    expect(host.get('conn-a')).not.toBeNull();
    expect(host.size).toBe(1);
  });

  it('unregister removes the plugin', () => {
    const { host } = makeHost();
    host.register(makePlugin('conn-b', makeConnector()));
    host.unregister('conn-b');
    expect(host.get('conn-b')).toBeNull();
  });
});

describe('ConnectorHost — lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start() calls connect() and emits connector.started', async () => {
    const { host, bus } = makeHost();
    const started = vi.fn();
    bus.on('connector.started', started);

    const connector = makeConnector();
    host.register(makePlugin('conn', connector));
    await host.start('conn');

    expect(connector.connect).toHaveBeenCalledOnce();
    expect(started).toHaveBeenCalledOnce();
    expect(host.get('conn')!.status).toBe('running');
  });

  it('start() emits connector.failed when connect() returns ok:false', async () => {
    const { host, bus } = makeHost();
    const failed = vi.fn();
    bus.on('connector.failed', failed);

    const failResult: ConnectorResult<void> = {
      ok: false,
      error: { code: 'CONNECT_FAILED', message: 'refused', retryable: true },
      durationMs: 0,
    };
    const connector = makeConnector({
      connect: vi.fn().mockResolvedValue(failResult),
    });
    host.register(makePlugin('conn-fail', connector));
    await host.start('conn-fail');

    expect(failed).toHaveBeenCalledOnce();
    expect(host.get('conn-fail')!.status).toBe('failed');
  });

  it('stop() calls disconnect() and emits connector.stopped', async () => {
    const { host, bus } = makeHost();
    const stopped = vi.fn();
    bus.on('connector.stopped', stopped);

    const connector = makeConnector();
    host.register(makePlugin('conn', connector));
    await host.start('conn');
    await host.stop('conn');

    expect(connector.disconnect).toHaveBeenCalledOnce();
    expect(stopped).toHaveBeenCalledOnce();
    expect(host.get('conn')!.status).toBe('stopped');
  });

  it('restart() stops then re-starts a connector', async () => {
    const { host } = makeHost();
    const connector = makeConnector();
    host.register(makePlugin('conn', connector));
    await host.start('conn');
    await host.restart('conn');

    expect(connector.connect).toHaveBeenCalledTimes(2);
    expect(connector.disconnect).toHaveBeenCalledTimes(1);
    expect(host.get('conn')!.status).toBe('running');
  });

  it('health poll updates HealthRegistry', async () => {
    const { host, healthReg, scheduler } = makeHost(200);
    const connector = makeConnector();
    host.register(makePlugin('conn', connector));
    await host.start('conn');

    scheduler.start();
    await vi.advanceTimersByTimeAsync(250);

    expect(healthReg.get('conn')).not.toBeNull();
    expect(healthReg.get('conn')!.status.status).toBe('healthy');
  });

  it('health.changed is emitted when status transitions', async () => {
    const { host, bus, scheduler } = makeHost(200);
    const changed = vi.fn();
    bus.on('health.changed', changed);

    let callCount = 0;
    const connector = makeConnector({
      health: vi.fn().mockImplementation(async () => {
        callCount++;
        const status: HealthStatusKind = callCount === 1 ? 'healthy' : 'degraded';
        return { ok: true, data: { status, responseTimeMs: 5 }, durationMs: 5 };
      }),
    });
    host.register(makePlugin('conn', connector));
    await host.start('conn');

    scheduler.start();
    await vi.advanceTimersByTimeAsync(250); // first poll (healthy)
    await vi.advanceTimersByTimeAsync(250); // second poll (degraded)

    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0][0].currentStatus).toBe('degraded');
  });

  it('throws when trying to start an unregistered connector', async () => {
    const { host } = makeHost();
    await expect(host.start('ghost')).rejects.toThrow();
  });
});

// Keep TS happy with the HealthStatusKind used in health.changed test
type HealthStatusKind = 'healthy' | 'degraded' | 'unhealthy';
