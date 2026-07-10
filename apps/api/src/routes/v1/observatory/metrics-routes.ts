import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { observatoryStore } from '../../../modules/observatory/observatory-store.js';
import {
  eventBus,
  startDemoEvents,
  trackListeners,
} from '../../../modules/observatory/event-bus.js';

export async function getMetrics(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const limit = Number(ctx.query.get('limit') ?? 288);
  const offset = Number(ctx.query.get('offset') ?? 0);
  const all = observatoryStore.metrics;
  const items = all.slice(offset, offset + limit);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ items, total: all.length, offset, limit }));
}

export async function getHeatmap(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ cells: observatoryStore.heatmap }));
}

export async function streamEvents(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  startDemoEvents();
  trackListeners(1);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');

  const unsubscribe = eventBus.subscribe((event) => {
    const data = JSON.stringify(event);
    res.write(`event: ${event.type}\ndata: ${data}\n\n`);
  });

  // Emit a heartbeat immediately so the client knows the stream is alive
  eventBus.emit_event('HeartBeat', { ts: new Date().toISOString() });

  await new Promise<void>((resolve) => {
    res.on('close', resolve);
    res.on('error', resolve);
  });

  unsubscribe();
  trackListeners(-1);
}
