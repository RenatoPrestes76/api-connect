import type {
  ConnectorResult, ConnectorHealthStatus, ConnectorContext, HealthStatusKind,
} from '@seltriva/connector-sdk';
import { ok } from '@seltriva/connector-sdk';

export class HealthChecker {
  private _lastStatus:  HealthStatusKind | null = null;
  private _lastSync:    Date | undefined;
  private _uptimeSince: Date | undefined;
  private _isConnected  = false;

  constructor(
    private readonly _connectorId: string,
    private readonly _ctx: ConnectorContext,
  ) {}

  onConnected(): void {
    this._isConnected = true;
    this._uptimeSince = new Date();
  }

  onDisconnected(): void {
    this._isConnected = false;
    this._uptimeSince = undefined;
  }

  onSyncCompleted(): void {
    this._lastSync = new Date();
  }

  async check(): Promise<ConnectorResult<ConnectorHealthStatus>> {
    const start  = Date.now();
    const status: HealthStatusKind = this._isConnected ? 'healthy' : 'unhealthy';

    const healthStatus: ConnectorHealthStatus = {
      status,
      responseTimeMs: Date.now() - start,
      lastSync:       this._lastSync,
      uptimeSince:    this._uptimeSince,
      message:        this._isConnected ? undefined : 'Not connected to ERP',
    };

    if (this._lastStatus !== null && this._lastStatus !== status) {
      this._ctx.eventBus.emit('health.changed', {
        connectorId:    this._connectorId,
        previousStatus: this._lastStatus,
        currentStatus:  status,
        changedAt:      new Date(),
      });
    }

    this._lastStatus = status;
    return ok(healthStatus, Date.now() - start);
  }
}
