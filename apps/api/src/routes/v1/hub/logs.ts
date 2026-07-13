import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { hubStore } from './hub-store.js';

export async function hubLogs(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const q = ctx.query;
  const connector = q.get('connector');
  const level = q.get('level');
  const search = q.get('search');
  const limit = Math.min(1000, Math.max(1, parseInt(q.get('limit') ?? '100', 10)));
  const offset = Math.max(0, parseInt(q.get('offset') ?? '0', 10));
  const isExport = q.get('export') === 'true';

  let entries = [...hubStore.logs];
  if (connector) entries = entries.filter((l) => l.connector === connector);
  if (level) entries = entries.filter((l) => l.level === level);
  if (search)
    entries = entries.filter((l) => l.message.toLowerCase().includes(search.toLowerCase()));

  const total = entries.length;
  const page = entries.slice(offset, offset + limit);

  if (isExport) {
    const text = page
      .map(
        (e) =>
          `[${e.timestamp}] ${e.level.toUpperCase().padEnd(5)} ${e.connector ? `[${e.connector}] ` : ''}${e.message}`
      )
      .join('\n');
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="atlas-logs.txt"',
    });
    res.end(text);
    return;
  }

  json(res, { data: page, total });
}
