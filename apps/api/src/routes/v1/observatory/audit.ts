import { randomUUID } from 'node:crypto';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { observatoryStore } from '../../../modules/observatory/observatory-store.js';
import type { AuditLog, AuditOutcome } from '../../../modules/observatory/types.js';

export async function listAuditLogs(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const actor = ctx.query.get('actor');
  const action = ctx.query.get('action');
  const resourceType = ctx.query.get('resourceType');
  const outcome = ctx.query.get('outcome');
  const from = ctx.query.get('from');
  const to = ctx.query.get('to');
  const limit = Number(ctx.query.get('limit') ?? 50);
  const offset = Number(ctx.query.get('offset') ?? 0);

  let items = [...observatoryStore.auditLogs];
  if (actor) items = items.filter((l) => l.actor.includes(actor));
  if (action) items = items.filter((l) => l.action.includes(action));
  if (resourceType) items = items.filter((l) => l.resourceType === resourceType);
  if (outcome) items = items.filter((l) => l.outcome === outcome);
  if (from) items = items.filter((l) => Date.parse(l.timestamp) >= Date.parse(from));
  if (to) items = items.filter((l) => Date.parse(l.timestamp) <= Date.parse(to));

  items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const total = items.length;
  items = items.slice(offset, offset + limit);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ items, total, offset, limit }));
}

export async function createAuditLog(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as Partial<AuditLog>;
  if (!body.actor || !body.action || !body.resourceType) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'actor, action, and resourceType are required' }));
    return;
  }
  const log: AuditLog = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    actor: body.actor,
    action: body.action,
    resourceType: body.resourceType,
    resourceId: body.resourceId ?? randomUUID(),
    resourceName: body.resourceName ?? body.resourceType,
    metadata: body.metadata,
    ip: body.ip,
    outcome: (body.outcome as AuditOutcome) ?? 'success',
  };
  observatoryStore.auditLogs.unshift(log);
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(log));
}
