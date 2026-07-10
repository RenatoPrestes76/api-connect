import { randomUUID } from 'node:crypto';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { observatoryStore } from '../../../modules/observatory/observatory-store.js';
import type { AlertRule, AlertSeverity, AlertChannel } from '../../../modules/observatory/types.js';

// ─── Alert Rules ──────────────────────────────────────────────────────────────

export async function listAlertRules(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(observatoryStore.alertRules));
}

export async function getAlertRule(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const rule = observatoryStore.alertRules.find((r) => r.id === ctx.params?.id);
  if (!rule) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Alert rule not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(rule));
}

export async function createAlertRule(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as Partial<AlertRule>;
  if (!body.name || !body.condition || !body.severity) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'name, condition, and severity are required' }));
    return;
  }
  const rule: AlertRule = {
    id: randomUUID(),
    name: body.name,
    description: body.description ?? '',
    condition: body.condition,
    severity: body.severity as AlertSeverity,
    channels: (body.channels as AlertChannel[]) ?? ['email'],
    cooldownMs: body.cooldownMs ?? 300_000,
    active: body.active ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    triggeredCount: 0,
  };
  observatoryStore.alertRules.push(rule);
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(rule));
}

export async function updateAlertRule(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const idx = observatoryStore.alertRules.findIndex((r) => r.id === ctx.params?.id);
  if (idx === -1) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Alert rule not found' }));
    return;
  }
  const body = ctx.body as Partial<AlertRule>;
  const updated = {
    ...observatoryStore.alertRules[idx]!,
    ...body,
    id: ctx.params!.id,
    updatedAt: new Date().toISOString(),
  };
  observatoryStore.alertRules[idx] = updated;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(updated));
}

export async function deleteAlertRule(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const idx = observatoryStore.alertRules.findIndex((r) => r.id === ctx.params?.id);
  if (idx === -1) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Alert rule not found' }));
    return;
  }
  observatoryStore.alertRules.splice(idx, 1);
  res.writeHead(204);
  res.end();
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function listAlerts(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const severity = ctx.query.get('severity');
  const acknowledged = ctx.query.get('acknowledged');
  const limit = Number(ctx.query.get('limit') ?? 50);
  const offset = Number(ctx.query.get('offset') ?? 0);
  let items = [...observatoryStore.alerts];
  if (severity) items = items.filter((a) => a.severity === severity);
  if (acknowledged !== null) items = items.filter((a) => String(a.acknowledged) === acknowledged);
  const total = items.length;
  items = items.slice(offset, offset + limit);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ items, total, offset, limit }));
}

export async function acknowledgeAlert(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const alert = observatoryStore.alerts.find((a) => a.id === ctx.params?.id);
  if (!alert) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Alert not found' }));
    return;
  }
  alert.acknowledged = true;
  alert.acknowledgedAt = new Date().toISOString();
  alert.acknowledgedBy = (ctx.body as { by?: string })?.by ?? 'user';
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(alert));
}
