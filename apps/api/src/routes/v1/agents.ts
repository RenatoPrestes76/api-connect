import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../http/router.js';
import { json, apiError, paginated } from '../../http/router.js';
import { AgentService } from '../../services/agent.service.js';
import type { AgentStatus } from '@prisma/client';

/**
 * ATLAS master audit — same class of BOLA as organizations.ts: `:id`
 * handlers below used to fetch/mutate/list-heartbeats-of ANY agent by id
 * (a real, Prisma-backed model with hostname/ipAddress/telemetry) with no
 * check that it belongs to the caller's own organization. Fixed by
 * verifying `agent.organizationId === ctx.orgId` after every lookup,
 * matching the "404, not 403, on mismatch" convention already used
 * elsewhere in this codebase (e.g. billing/invoices.ts) so a caller can't
 * distinguish "doesn't exist" from "exists but isn't yours".
 */
function assertOwnAgent(
  ctx: RouteContext,
  res: ServerResponse,
  agent: { organizationId: string } | null
): boolean {
  if (!ctx.orgId) {
    apiError(
      res,
      'Authenticated session has no associated organization',
      403,
      'ORGANIZATION_NOT_LINKED'
    );
    return false;
  }
  if (!agent || agent.organizationId !== ctx.orgId) {
    apiError(res, 'Agent not found', 404, 'NOT_FOUND');
    return false;
  }
  return true;
}

// GET /api/v1/agents
export async function listAgents(ctx: RouteContext, res: ServerResponse): Promise<void> {
  if (!ctx.orgId) {
    apiError(
      res,
      'Authenticated session has no associated organization',
      403,
      'ORGANIZATION_NOT_LINKED'
    );
    return;
  }
  const page = Number(ctx.query.get('page') ?? '1');
  const pageSize = Math.min(Number(ctx.query.get('pageSize') ?? '20'), 100);
  const organizationId = ctx.orgId;
  const environmentId = ctx.query.get('environmentId') ?? undefined;
  const status = ctx.query.get('status') as AgentStatus | null;

  const { items, total } = await AgentService.list({
    page,
    pageSize,
    organizationId,
    environmentId,
    status: status ?? undefined,
  });
  paginated(res, items, total, page, pageSize);
}

// GET /api/v1/agents/:id
export async function getAgent(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) {
    apiError(res, 'Missing id', 400, 'BAD_REQUEST');
    return;
  }

  const agent = await AgentService.findById(id);
  if (!assertOwnAgent(ctx, res, agent)) return;

  json(res, { data: agent });
}

// POST /api/v1/agents/register
export async function registerAgent(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const body = ctx.body as Record<string, unknown> | undefined;

  if (!ctx.orgId) {
    apiError(
      res,
      'Authenticated session has no associated organization',
      403,
      'ORGANIZATION_NOT_LINKED'
    );
    return;
  }
  if (!body?.environmentId || !body?.name || !body?.version) {
    apiError(res, 'environmentId, name and version are required', 400, 'VALIDATION_ERROR');
    return;
  }

  const agent = await AgentService.register({
    organizationId: ctx.orgId,
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
  if (!id) {
    apiError(res, 'Missing id', 400, 'BAD_REQUEST');
    return;
  }

  const existing = await AgentService.findById(id);
  if (!assertOwnAgent(ctx, res, existing)) return;

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
  if (!id) {
    apiError(res, 'Missing id', 400, 'BAD_REQUEST');
    return;
  }

  const agent = await AgentService.findById(id);
  if (!assertOwnAgent(ctx, res, agent)) return;

  const limit = Math.min(Number(ctx.query.get('limit') ?? '10'), 100);
  const heartbeats = await AgentService.getRecentHeartbeats(id, limit);
  json(res, { data: heartbeats, meta: { total: heartbeats.length } });
}

// DELETE /api/v1/agents/:id
export async function retireAgent(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const { id } = ctx.params;
  if (!id) {
    apiError(res, 'Missing id', 400, 'BAD_REQUEST');
    return;
  }

  const agent = await AgentService.findById(id);
  if (!assertOwnAgent(ctx, res, agent)) return;

  await AgentService.retire(id);
  json(res, { success: true });
}
