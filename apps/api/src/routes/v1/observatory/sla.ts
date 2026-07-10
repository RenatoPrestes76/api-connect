import { randomUUID } from 'node:crypto';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { observatoryStore } from '../../../modules/observatory/observatory-store.js';
import type { SLADefinition } from '../../../modules/observatory/types.js';

export async function listSLAs(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(observatoryStore.slaDefinitions));
}

export async function getSLA(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const sla = observatoryStore.slaDefinitions.find((s) => s.id === ctx.params?.id);
  if (!sla) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'SLA not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(sla));
}

export async function createSLA(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as Partial<SLADefinition>;
  if (!body.name || !body.maxDurationMs) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'name and maxDurationMs are required' }));
    return;
  }
  const sla: SLADefinition = {
    id: randomUUID(),
    name: body.name,
    description: body.description ?? '',
    workflowId: body.workflowId,
    maxDurationMs: body.maxDurationMs,
    warnThresholdMs: body.warnThresholdMs ?? Math.round(body.maxDurationMs * 0.7),
    active: body.active ?? true,
    createdAt: new Date().toISOString(),
    compliancePct: 100,
    breachCount: 0,
    warnCount: 0,
  };
  observatoryStore.slaDefinitions.push(sla);
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(sla));
}

export async function updateSLA(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const idx = observatoryStore.slaDefinitions.findIndex((s) => s.id === ctx.params?.id);
  if (idx === -1) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'SLA not found' }));
    return;
  }
  const body = ctx.body as Partial<SLADefinition>;
  const updated = { ...observatoryStore.slaDefinitions[idx]!, ...body, id: ctx.params!.id };
  observatoryStore.slaDefinitions[idx] = updated;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(updated));
}

export async function listSLAEvents(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const slaId = ctx.query.get('slaId');
  const breached = ctx.query.get('breached');
  const limit = Number(ctx.query.get('limit') ?? 30);
  const offset = Number(ctx.query.get('offset') ?? 0);
  let items = [...observatoryStore.slaEvents];
  if (slaId) items = items.filter((e) => e.slaId === slaId);
  if (breached !== null) items = items.filter((e) => String(e.breached) === breached);
  items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const total = items.length;
  items = items.slice(offset, offset + limit);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ items, total, offset, limit }));
}
