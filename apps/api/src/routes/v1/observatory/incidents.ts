import { randomUUID } from 'node:crypto';
import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { observatoryStore } from '../../../modules/observatory/observatory-store.js';
import { eventBus } from '../../../modules/observatory/event-bus.js';
import type {
  Incident,
  IncidentEvent,
  IncidentStatus,
  IncidentSeverity,
} from '../../../modules/observatory/types.js';

export async function listIncidents(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const status = ctx.query.get('status');
  const severity = ctx.query.get('severity');
  const limit = Number(ctx.query.get('limit') ?? 20);
  const offset = Number(ctx.query.get('offset') ?? 0);
  let items = [...observatoryStore.incidents];
  if (status) items = items.filter((i) => i.status === status);
  if (severity) items = items.filter((i) => i.severity === severity);
  items.sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const total = items.length;
  items = items.slice(offset, offset + limit);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ items, total, offset, limit }));
}

export async function getIncident(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const incident = observatoryStore.incidents.find((i) => i.id === ctx.params?.id);
  if (!incident) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Incident not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(incident));
}

export async function createIncident(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as Partial<Incident>;
  if (!body.title || !body.severity) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'title and severity are required' }));
    return;
  }
  const now = new Date().toISOString();
  const incident: Incident = {
    id: randomUUID(),
    title: body.title,
    description: body.description ?? '',
    status: 'OPEN',
    severity: body.severity as IncidentSeverity,
    openedAt: now,
    updatedAt: now,
    events: [
      {
        id: randomUUID(),
        incidentId: '',
        status: 'OPEN',
        message: body.description ?? 'Incident opened',
        author: 'system',
        timestamp: now,
      },
    ],
  };
  // fix self-reference after creation
  incident.events[0]!.incidentId = incident.id;
  observatoryStore.incidents.push(incident);
  eventBus.emit_event('IncidentOpened', {
    incidentId: incident.id,
    title: incident.title,
    severity: incident.severity,
  });
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(incident));
}

export async function updateIncidentStatus(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const incident = observatoryStore.incidents.find((i) => i.id === ctx.params?.id);
  if (!incident) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Incident not found' }));
    return;
  }

  const { status, message, author } = ctx.body as {
    status: IncidentStatus;
    message?: string;
    author?: string;
  };
  if (!status) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'status is required' }));
    return;
  }

  const now = new Date().toISOString();
  incident.status = status;
  incident.updatedAt = now;
  if (status === 'RESOLVED' || status === 'FIXED') incident.resolvedAt = now;
  if (status === 'CLOSED') incident.closedAt = now;

  const event: IncidentEvent = {
    id: randomUUID(),
    incidentId: incident.id,
    status,
    message: message ?? `Status updated to ${status}`,
    author: author ?? 'user',
    timestamp: now,
  };
  incident.events.push(event);

  if (status === 'RESOLVED') eventBus.emit_event('IncidentResolved', { incidentId: incident.id });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(incident));
}
