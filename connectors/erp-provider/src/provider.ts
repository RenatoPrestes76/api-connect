import type {
  Connector, ConnectorResult, ValidationResult,
  DiscoveryResult, SyncContext, SyncResult, SyncError,
  ConnectorHealthStatus, ConnectorContext, ConnectorMetadata,
} from '@seltriva/connector-sdk';
import { ok, fail } from '@seltriva/connector-sdk';
import type { DatabaseAdapter, DriverConfig } from '@seltriva/database-sdk';
import { PostgresDriver } from '@seltriva/database-sdk';
import { ERP_METADATA } from './metadata.js';
import { ErpValidator } from './validator.js';
import { DiscoveryEngine } from './discovery.js';
import { HealthChecker } from './health.js';
import { ProductsSync } from './sync/products.js';
import { CustomersSync } from './sync/customers.js';
import { InventorySync } from './sync/inventory.js';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';

export type DatabaseAdapterFactory = (config: DriverConfig) => DatabaseAdapter;

function buildDriverConfig(ctx: ConnectorContext): DriverConfig {
  return {
    host:     ctx.config.getString('host',     'localhost') ?? 'localhost',
    port:     ctx.config.getNumber('port',     5432)        ?? 5432,
    database: ctx.config.getString('database', '')          ?? '',
    username: ctx.config.getString('username', '')          ?? '',
    password: ctx.config.getString('password', '')          ?? '',
  };
}

export class ErpConnector implements Connector {
  private _state: ConnectionState = 'disconnected';

  private readonly _db:        DatabaseAdapter;
  private readonly _validator: ErpValidator;
  private readonly _discovery: DiscoveryEngine;
  private readonly _health:    HealthChecker;
  private readonly _products:  ProductsSync;
  private readonly _customers: CustomersSync;
  private readonly _inventory: InventorySync;

  constructor(
    private readonly _ctx: ConnectorContext,
    dbFactory?: DatabaseAdapterFactory,
  ) {
    const config  = buildDriverConfig(_ctx);
    this._db       = dbFactory ? dbFactory(config) : new PostgresDriver(config);
    const id       = ERP_METADATA.id;
    this._validator = new ErpValidator(_ctx);
    this._discovery = new DiscoveryEngine(id, _ctx, this._db);
    this._health    = new HealthChecker(id, _ctx);
    this._products  = new ProductsSync(_ctx, this._db);
    this._customers = new CustomersSync(_ctx, this._db);
    this._inventory = new InventorySync(_ctx, this._db);
  }

  metadata(): ConnectorMetadata {
    return ERP_METADATA;
  }

  async connect(): Promise<ConnectorResult<void>> {
    const start = Date.now();
    if (this._state === 'connected') return ok(undefined, 0);

    this._state = 'connecting';
    this._ctx.logger.info('Connecting to ERP database');

    if (this._ctx.config.getBoolean('_simulateConnectFailure', false)) {
      this._state = 'disconnected';
      return fail('CONNECT_FAILED', 'Simulated connect failure', true);
    }

    try {
      await this._db.connect();
      this._state = 'connected';
      this._health.onConnected();
      this._ctx.logger.info('Connected to ERP database', {
        host: this._ctx.config.getString('host', ''),
        port: this._ctx.config.getNumber('port', 5432),
        db:   this._ctx.config.getString('database', ''),
      });
      return ok(undefined, Date.now() - start);
    } catch (err) {
      this._state = 'disconnected';
      const msg = err instanceof Error ? err.message : 'Connection failed';
      this._ctx.logger.error('Connect failed', err instanceof Error ? err : undefined);
      return fail('CONNECT_FAILED', msg, true, err instanceof Error ? err : undefined);
    }
  }

  async disconnect(): Promise<ConnectorResult<void>> {
    const start = Date.now();
    if (this._state === 'disconnected') return ok(undefined, 0);

    this._state = 'disconnecting';
    this._ctx.logger.info('Disconnecting from ERP database');
    try {
      await this._db.disconnect();
    } catch {
      // best-effort disconnect
    }
    this._state = 'disconnected';
    this._health.onDisconnected();
    this._ctx.logger.info('Disconnected from ERP database');
    return ok(undefined, Date.now() - start);
  }

  async validate(): Promise<ConnectorResult<ValidationResult>> {
    return this._validator.validate();
  }

  async discover(): Promise<ConnectorResult<DiscoveryResult>> {
    if (this._state !== 'connected') {
      return fail('NOT_CONNECTED', 'Cannot discover: not connected to ERP', true);
    }
    return this._discovery.discover();
  }

  async synchronize(context: SyncContext): Promise<ConnectorResult<SyncResult>> {
    if (this._state !== 'connected') {
      return fail('NOT_CONNECTED', 'Cannot synchronize: not connected to ERP', true);
    }

    const start    = Date.now();
    const entities = context.entities ?? ['products', 'customers', 'inventory'];

    this._ctx.logger.info('Starting synchronization', { jobId: context.jobId, entities });
    this._ctx.eventBus.emit('sync.started', {
      connectorId: ERP_METADATA.id,
      jobId:       context.jobId,
      startedAt:   new Date(),
    });

    let totalSynced  = 0;
    let totalSkipped = 0;
    let totalFailed  = 0;
    const allErrors: SyncError[] = [];

    if (entities.includes('products')) {
      const { result } = await this._products.sync(context);
      totalSynced  += result.synced;
      totalSkipped += result.skipped;
      totalFailed  += result.failed;
      for (const e of result.errors) allErrors.push(e);
    }

    if (entities.includes('customers')) {
      const { result } = await this._customers.sync(context);
      totalSynced  += result.synced;
      totalSkipped += result.skipped;
      totalFailed  += result.failed;
      for (const e of result.errors) allErrors.push(e);
    }

    if (entities.includes('inventory')) {
      const { result } = await this._inventory.sync(context);
      totalSynced  += result.synced;
      totalSkipped += result.skipped;
      totalFailed  += result.failed;
      for (const e of result.errors) allErrors.push(e);
    }

    const durationMs = Date.now() - start;
    const syncResult: SyncResult = {
      synced:     totalSynced,
      skipped:    totalSkipped,
      failed:     totalFailed,
      errors:     allErrors,
      finishedAt: new Date(),
    };

    this._health.onSyncCompleted();

    this._ctx.eventBus.emit('sync.finished', {
      connectorId: ERP_METADATA.id,
      jobId:       context.jobId,
      synced:      totalSynced,
      failed:      totalFailed,
      durationMs,
      finishedAt:  new Date(),
    });

    this._ctx.logger.info('Synchronization complete', { synced: totalSynced, durationMs });
    return ok(syncResult, durationMs);
  }

  async health(): Promise<ConnectorResult<ConnectorHealthStatus>> {
    const base = await this._health.check();
    if (!base.data || this._state !== 'connected') return base;

    try {
      const dbh = await this._db.health();
      return ok(
        { ...base.data, responseTimeMs: dbh.latency },
        dbh.latency,
      );
    } catch {
      return base;
    }
  }

  get state(): ConnectionState {
    return this._state;
  }
}
