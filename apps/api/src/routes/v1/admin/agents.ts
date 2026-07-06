import type { ServerResponse }         from 'node:http';
import type { RouteContext }            from '../../../http/router.js';
import { json, apiError }               from '../../../http/router.js';
import type { AtlasAgentRepository }    from '@seltriva/agent-identity';
import { AtlasAgent }                   from '@seltriva/agent-identity';
import { computeHealth, HealthStatus }  from '@seltriva/agent-observability';

// ─── Filter / pagination types ───────────────────────────────────────────────

interface AgentFilter {
  companyId?:     string;
  status?:        string;
  healthStatus?:  string;
  connectorType?: string;
  version?:       string;
  hostname?:      string;
}

interface AgentSort {
  by:    'createdAt' | 'lastHeartbeat' | 'lastSynchronization' | 'hostname' | 'version' | 'name';
  order: 'asc' | 'desc';
}

const SORT_FIELDS = new Set(['createdAt','lastHeartbeat','lastSynchronization','hostname','version','name']);

function agentToView(agent: AtlasAgent) {
  const snap = agent.toSnapshot();
  return {
    agentId:             snap.id,
    companyId:           snap.companyId,
    name:                snap.name,
    hostname:            snap.hostname,
    machineId:           snap.machineId,
    connectorType:       snap.connectorType,
    version:             snap.version,
    status:              snap.status,
    healthStatus:        computeHealth(snap.lastHeartbeat),
    lastHeartbeat:       snap.lastHeartbeat?.toISOString() ?? null,
    lastSynchronization: snap.lastSynchronization?.toISOString() ?? null,
    createdAt:           snap.createdAt.toISOString(),
    updatedAt:           snap.updatedAt.toISOString(),
  };
}

function applyFilters(agents: AtlasAgent[], f: AgentFilter): AtlasAgent[] {
  return agents.filter(a => {
    const snap = a.toSnapshot();
    if (f.companyId     && snap.companyId     !== f.companyId)     return false;
    if (f.status        && snap.status        !== f.status)        return false;
    if (f.connectorType && snap.connectorType !== f.connectorType) return false;
    if (f.version       && !snap.version.startsWith(f.version))   return false;
    if (f.hostname      && !snap.hostname.toLowerCase().includes(f.hostname.toLowerCase())) return false;
    if (f.healthStatus) {
      if (computeHealth(snap.lastHeartbeat) !== f.healthStatus) return false;
    }
    return true;
  });
}

function applySort(agents: AtlasAgent[], sort: AgentSort): AtlasAgent[] {
  return [...agents].sort((a, b) => {
    const sa = a.toSnapshot();
    const sb = b.toSnapshot();
    let va: string | number, vb: string | number;

    switch (sort.by) {
      case 'hostname':            va = sa.hostname;  vb = sb.hostname;  break;
      case 'version':             va = sa.version;   vb = sb.version;   break;
      case 'name':                va = sa.name;      vb = sb.name;      break;
      case 'lastHeartbeat':       va = sa.lastHeartbeat?.getTime()       ?? 0; vb = sb.lastHeartbeat?.getTime()       ?? 0; break;
      case 'lastSynchronization': va = sa.lastSynchronization?.getTime() ?? 0; vb = sb.lastSynchronization?.getTime() ?? 0; break;
      default:                    va = sa.createdAt.getTime();  vb = sb.createdAt.getTime();
    }

    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sort.order === 'asc' ? cmp : -cmp;
  });
}

// ─── GET /admin/agents ───────────────────────────────────────────────────────

export function createListAgentsHandler(agentRepo: AtlasAgentRepository) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const q = ctx.query;
    const page     = Math.max(1, parseInt(q.get('page')     ?? '1',  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') ?? '20', 10)));

    const filter: AgentFilter = {
      companyId:     q.get('companyId')     ?? undefined,
      status:        q.get('status')        ?? undefined,
      healthStatus:  q.get('healthStatus')  ?? undefined,
      connectorType: q.get('connectorType') ?? undefined,
      version:       q.get('version')       ?? undefined,
      hostname:      q.get('hostname')      ?? undefined,
    };

    const sortByRaw = q.get('sortBy') ?? 'createdAt';
    const sort: AgentSort = {
      by:    (SORT_FIELDS.has(sortByRaw) ? sortByRaw : 'createdAt') as AgentSort['by'],
      order: q.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    };

    const all      = await agentRepo.findAll();
    const filtered = applyFilters(all, filter);
    const sorted   = applySort(filtered, sort);
    const total      = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const items      = sorted.slice((page - 1) * pageSize, page * pageSize);

    json(res, {
      data: items.map(agentToView),
      meta: { total, page, pageSize, totalPages },
    });
  };
}

// ─── GET /admin/agents/:id ────────────────────────────────────────────────────

export function createGetAgentHandler(agentRepo: AtlasAgentRepository) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const agent = await agentRepo.findById(ctx.params['id']!);
    if (!agent) { apiError(res, 'Agent not found', 404, 'NOT_FOUND'); return; }
    json(res, { data: agentToView(agent) });
  };
}

// ─── GET /admin/companies/:companyId/agents ───────────────────────────────────

export function createListCompanyAgentsHandler(agentRepo: AtlasAgentRepository) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const companyId = ctx.params['companyId']!;
    const agents    = await agentRepo.findByCompany(companyId);
    json(res, { data: agents.map(agentToView), meta: { total: agents.length } });
  };
}

// ─── PATCH /admin/agents/:id/disable ─────────────────────────────────────────

export function createDisableAgentHandler(agentRepo: AtlasAgentRepository) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const agent = await agentRepo.findById(ctx.params['id']!);
    if (!agent) { apiError(res, 'Agent not found', 404, 'NOT_FOUND'); return; }
    agent.disable();
    await agentRepo.update(agent);
    json(res, { data: { agentId: agent.id.toString(), status: agent.status.value } });
  };
}

// ─── PATCH /admin/agents/:id/enable ──────────────────────────────────────────

export function createEnableAgentHandler(agentRepo: AtlasAgentRepository) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const agent = await agentRepo.findById(ctx.params['id']!);
    if (!agent) { apiError(res, 'Agent not found', 404, 'NOT_FOUND'); return; }
    if (!agent.status.isDisabled()) {
      apiError(res, 'Agent is not disabled', 409, 'INVALID_STATE');
      return;
    }
    agent.enable();
    await agentRepo.update(agent);
    json(res, { data: { agentId: agent.id.toString(), status: agent.status.value } });
  };
}

// ─── DELETE /admin/agents/:id ─────────────────────────────────────────────────

export function createDeleteAgentHandler(agentRepo: AtlasAgentRepository) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const id = ctx.params['id']!;
    const agent = await agentRepo.findById(id);
    if (!agent) { apiError(res, 'Agent not found', 404, 'NOT_FOUND'); return; }
    await agentRepo.delete(id);
    res.writeHead(204);
    res.end();
  };
}
