import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { hubStore, type SyncRecord } from './hub-store.js';

export async function hubSyncHistory(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const q = ctx.query;
  const connector = q.get('connector');
  const result = q.get('result');
  const limit = Math.min(100, Math.max(1, parseInt(q.get('limit') ?? '20', 10)));
  const offset = Math.max(0, parseInt(q.get('offset') ?? '0', 10));

  let records = [...hubStore.syncHistory];
  if (connector) records = records.filter((s) => s.connector === connector);
  if (result) records = records.filter((s) => s.result === result);

  const total = records.length;
  json(res, { data: records.slice(offset, offset + limit), total });
}

export async function hubRunSync(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as { connectorId?: string } | undefined;
  const connectorId = body?.connectorId;
  const connector = connectorId ? hubStore.connectors.get(connectorId) : undefined;

  const record: SyncRecord = {
    id: randomUUID(),
    connectorId: connectorId ?? '',
    connector: connector?.name ?? 'Unknown',
    agentId: connector?.agentId ?? '',
    startedAt: new Date().toISOString(),
    result: 'RUNNING',
    synced: 0,
    skipped: 0,
    failed: 0,
    entities: [],
    errors: [],
  };
  hubStore.syncHistory.unshift(record);
  json(res, record, 201);
}

export async function hubCancelSync(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const record = hubStore.syncHistory.find((s) => s.id === ctx.params['id']);
  if (!record) {
    apiError(res, 'Sync record not found', 404, 'NOT_FOUND');
    return;
  }
  if (record.result !== 'RUNNING') {
    apiError(res, 'Sync is not running', 409, 'INVALID_STATE');
    return;
  }
  record.result = 'CANCELLED';
  record.finishedAt = new Date().toISOString();
  json(res, record);
}

export async function hubRetrySync(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const original = hubStore.syncHistory.find((s) => s.id === ctx.params['id']);
  if (!original) {
    apiError(res, 'Sync record not found', 404, 'NOT_FOUND');
    return;
  }
  const retry: SyncRecord = {
    id: randomUUID(),
    connectorId: original.connectorId,
    connector: original.connector,
    agentId: original.agentId,
    startedAt: new Date().toISOString(),
    result: 'RUNNING',
    synced: 0,
    skipped: 0,
    failed: 0,
    entities: original.entities,
    errors: [],
  };
  hubStore.syncHistory.unshift(retry);
  json(res, retry, 201);
}
