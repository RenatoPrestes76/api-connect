import { randomUUID } from 'node:crypto';
import type { Connector, SyncContext } from '../interfaces/connector.js';
import type { EventBus } from '../events/event-bus.js';
import type { HealthRegistry } from '../health/health-registry.js';
import type { ConnectorScheduler } from '../scheduler/connector-scheduler.js';
import { PluginRegistry } from './plugin-registry.js';
import type { LoadedPlugin } from '../loader/plugin-loader.js';

export interface ConnectorHostOptions {
  /** Interval (ms) between automatic health polls. Default: 30 000. */
  healthPollIntervalMs?: number;
  /** Interval (ms) between automatic sync jobs. 0 = disabled. Default: 0. */
  syncIntervalMs?:       number;
}

const DEFAULT_HEALTH_POLL_MS = 30_000;

/**
 * ConnectorHost
 *
 * The Runtime's face to the SDK. It manages the full lifecycle of every
 * loaded plugin: register → start → running → stop.
 *
 * Responsibilities:
 *  - Wraps every connector call in try/catch (isolation).
 *  - Emits typed events on every state transition.
 *  - Schedules health polls automatically for each running connector.
 *  - Updates the HealthRegistry after each poll.
 *  - Restarts individual connectors without affecting others.
 */
export class ConnectorHost {
  private readonly _registry: PluginRegistry;
  private readonly _healthPollMs: number;
  private readonly _syncIntervalMs: number;

  constructor(
    private readonly _eventBus:       EventBus,
    private readonly _healthRegistry:  HealthRegistry,
    private readonly _scheduler:       ConnectorScheduler,
    private readonly _opts:            ConnectorHostOptions = {},
  ) {
    this._registry     = new PluginRegistry();
    this._healthPollMs = _opts.healthPollIntervalMs ?? DEFAULT_HEALTH_POLL_MS;
    this._syncIntervalMs = _opts.syncIntervalMs ?? 0;
  }

  // ── Registration ────────────────────────────────────────────────────────────

  register(plugin: LoadedPlugin): void {
    this._registry.register(plugin);
  }

  unregister(id: string): void {
    this._stopScheduledJobs(id);
    this._healthRegistry.remove(id);
    this._registry.unregister(id);
  }

  get(id: string) { return this._registry.get(id); }
  list()          { return this._registry.all(); }
  get size()      { return this._registry.size; }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async start(id: string): Promise<void> {
    const entry = this._requireEntry(id);
    if (entry.status === 'running') return;

    this._registry.setStatus(id, 'starting');

    const connector = entry.plugin.connector;
    const result    = await this._safeCall(id, () => connector.connect());

    if (!result.ok) {
      this._registry.recordFailure(id, new Error(result.error?.message ?? 'connect() failed'));
      this._eventBus.emit('connector.failed', {
        connectorId: id,
        error:       result.error?.message ?? 'connect() failed',
        code:        result.error?.code    ?? 'CONNECT_FAILED',
        failedAt:    new Date(),
        retryable:   result.error?.retryable ?? false,
      });
      return;
    }

    entry.status    = 'running';
    entry.startedAt = new Date();

    this._eventBus.emit('connector.started', {
      connectorId: id,
      version:     entry.plugin.manifest.version,
      startedAt:   entry.startedAt,
    });

    this._scheduleHealthPoll(id, connector);
    if (this._syncIntervalMs > 0) {
      this._scheduleSyncJob(id, connector);
    }
  }

  async stop(id: string): Promise<void> {
    const entry = this._requireEntry(id);
    if (entry.status === 'stopped' || entry.status === 'registered') return;

    this._registry.setStatus(id, 'stopping');
    this._stopScheduledJobs(id);

    const connector = entry.plugin.connector;
    await this._safeCall(id, () => connector.disconnect());

    entry.status    = 'stopped';
    entry.stoppedAt = new Date();

    this._healthRegistry.remove(id);
    this._eventBus.emit('connector.stopped', {
      connectorId: id,
      stoppedAt:   entry.stoppedAt,
      graceful:    true,
    });
  }

  async restart(id: string): Promise<void> {
    await this.stop(id);
    this._registry.setStatus(id, 'registered');
    await this.start(id);
  }

  async startAll(): Promise<void> {
    for (const entry of this._registry.all()) {
      await this.start(entry.plugin.manifest.id);
    }
  }

  async stopAll(): Promise<void> {
    for (const entry of this._registry.all()) {
      await this.stop(entry.plugin.manifest.id);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _requireEntry(id: string) {
    const entry = this._registry.get(id);
    if (!entry) throw new Error(`Connector "${id}" is not registered`);
    return entry;
  }

  private async _safeCall<T>(
    connectorId: string,
    fn: () => Promise<T>,
  ): Promise<T extends { ok: boolean } ? T : { ok: true; data: T }> {
    try {
      const result = await fn();
      // If the result is already a ConnectorResult, return it as-is
      if (typeof result === 'object' && result !== null && 'ok' in result) {
        return result as never;
      }
      return { ok: true, data: result } as never;
    } catch (err) {
      this._registry.recordFailure(connectorId, err as Error);
      this._eventBus.emit('connector.failed', {
        connectorId,
        error:     (err as Error).message,
        code:      'UNHANDLED_EXCEPTION',
        failedAt:  new Date(),
        retryable: false,
      });
      return { ok: false, error: { code: 'UNHANDLED_EXCEPTION', message: (err as Error).message, retryable: false } } as never;
    }
  }

  private _scheduleHealthPoll(id: string, connector: Connector): void {
    this._scheduler.schedule(id, {
      label:      `${id}:health`,
      intervalMs: this._healthPollMs,
      task: async () => {
        const result = await this._safeCall(id, () => connector.health());
        if (result.ok && result.data) {
          const prev = this._healthRegistry.get(id)?.status.status;
          this._healthRegistry.update(id, result.data);
          if (prev && prev !== result.data.status) {
            this._eventBus.emit('health.changed', {
              connectorId:    id,
              previousStatus: prev,
              currentStatus:  result.data.status,
              changedAt:      new Date(),
            });
          }
        }
      },
    });
  }

  private _scheduleSyncJob(id: string, connector: Connector): void {
    this._scheduler.schedule(id, {
      label:      `${id}:sync`,
      intervalMs: this._syncIntervalMs,
      task: async () => {
        const jobId: string = randomUUID();
        this._eventBus.emit('sync.started', { connectorId: id, jobId, startedAt: new Date() });
        const started  = Date.now();
        const ctx: SyncContext = { jobId };
        const result   = await this._safeCall(id, () => connector.synchronize(ctx));
        const duration = Date.now() - started;
        this._eventBus.emit('sync.finished', {
          connectorId: id,
          jobId,
          synced:      result.ok ? (result.data?.synced ?? 0) : 0,
          failed:      result.ok ? (result.data?.failed ?? 0) : 1,
          durationMs:  duration,
          finishedAt:  new Date(),
        });
      },
    });
  }

  private _stopScheduledJobs(id: string): void {
    this._scheduler.cancelAll(id);
  }
}
