import type { RouteContext } from '../../../http/router.js';
import type { ServerResponse } from 'node:http';
import { copilotStore } from '../../../modules/ai-copilot/copilot-store.js';
import type { CopilotAction } from '../../../modules/ai-copilot/copilot-store.js';

export async function listCopilotAudit(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const action = ctx.query.get('action') as CopilotAction | null;
  const conversationId = ctx.query.get('conversationId');
  const modelUsed = ctx.query.get('modelUsed');
  const from = ctx.query.get('from');
  const to = ctx.query.get('to');
  const limit = Number(ctx.query.get('limit') ?? 50);
  const offset = Number(ctx.query.get('offset') ?? 0);

  let items = [...copilotStore.auditLogs];

  if (action) items = items.filter((l) => l.action === action);
  if (conversationId) items = items.filter((l) => l.conversationId === conversationId);
  if (modelUsed) items = items.filter((l) => l.modelUsed === modelUsed);
  if (from) items = items.filter((l) => Date.parse(l.timestamp) >= Date.parse(from));
  if (to) items = items.filter((l) => Date.parse(l.timestamp) <= Date.parse(to));

  items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const total = items.length;
  items = items.slice(offset, offset + limit);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ items, total, offset, limit }));
}
