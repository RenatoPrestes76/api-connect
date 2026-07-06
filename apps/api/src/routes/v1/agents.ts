import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../http/router.js';
import { json, apiError, paginated } from '../../http/router.js';
import { AgentService } from '../../services/agent.service.js';
import type { AgentStatus } from '@prisma/client';

// GET /api/v1/agents
export async function listAgents(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const page = Number(ctx.query.get('page') ?? '1');
  const pageSize = Math.min(Number(ctx.query.get('pageSize') ?? '20'), 100);
  const organizationId = ctx.query.get('organizationId') ?? ctx.orgId;
  const environmentId = ctx.query.get('environmentId') ?? undefined;
  const status = ctx.query.get('status') as AgentStatus | null;

  const { items, total } = await AgentService.list({
    page, pageSize, organizationId, environmentId, status: status ?? undefined,
  });
  paginated(res, items, total, page, pageSize);
}

// GET /api/v1/agents/:id
export async function getAgent(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const agent = await AgentService.findById(id);
  if (!agent) { apiError(res, 'Agent not found', 404, 'NOT_FOUND'); return; }

  json(res, { data: agent });
}

// POST /api/v1/agents/register
export async function registerAgent(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as Record<string, unknown> | undefined;

  if (!body?.organizationId || !body?.environmentId || !body?.name || !body?.version) {
    apiError(res, 'organizationId, environmentId, name and version are required', 400, 'VALIDATION_ERROR');
    return;
  }

  const agent = await AgentService.register({
    organizationId: body['organizationId'] as string,
    environmentId: body['environmentId'] as string,
    name: body['name'] as string,
    version: body['version'] as string,
    hostname: body['hostname'] as string | undefined,
    ipAddress: body['ipAddress'] as string | undefined,
    platform: body['platform'] as string | undefined,
    arch: body['arch'] as string | undefined,
    nodeVersion: body['nodeVersion'] as string | undefined,
    capabilities: body['capabilities'] as string[] | undefined,
    metadata: body['metadata'] as Record<string, unknown> | undefined,
  });

  json(res, { data: agent }, 201);
}

// POST /api/v1/agents/:id/heartbeat
export async function agentHeartbeat(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const body = ctx.body as Record<string, unknown> | undefined;
  const status = (body?.['status'] as AgentStatus) ?? 'ONLINE';

  const agent = await AgentService.heartbeat({
    agentId: id,
    status,
    cpuPct: body?.['cpuPct'] as number | undefined,
    memPct: body?.['memPct'] as number | undefined,
    diskPct: body?.['diskPct'] as number | undefined,
    latencyMs: body?.['latencyMs'] as number | undefined,
    version: body?.['version'] as string | undefined,
    metadata: body?.['metadata'] as Record<string, unknown> | undefined,
  });

  json(res, { data: agent });
}

// GET /api/v1/agents/:id/heartbeats
export async function getAgentHeartbeats(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const limit = Math.min(Number(ctx.query.get('limit') ?? '10'), 100);
  const heartbeats = await AgentService.getRecentHeartbeats(id, limit);
  json(res, { data: heartbeats, meta: { total: heartbeats.length } });
}

// DELETE /api/v1/agents/:id
export async function retireAgent(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) { apiError(res, 'Missing id', 400, 'BAD_REQUEST'); return; }

  const agent = await AgentService.findById(id);
  if (!agent) { apiError(res, 'Agent not found', 404, 'NOT_FOUND'); return; }

  await AgentService.retire(id);
  json(res, { success: true });
}
