import { ATLAS_API_URL } from '../lib/constants.js';
import type {
  Agent, AgentListResponse, DashboardMetrics,
  ActivityData, Company, AgentFilter,
} from '../types/atlas.js';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ATLAS_API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  const json = await res.json() as { data: T };
  return json.data;
}

function buildQuery(filter: AgentFilter): string {
  const p = new URLSearchParams();
  if (filter.companyId)     p.set('companyId',     filter.companyId);
  if (filter.healthStatus)  p.set('healthStatus',  filter.healthStatus);
  if (filter.connectorType) p.set('connectorType', filter.connectorType);
  if (filter.version)       p.set('version',       filter.version);
  if (filter.hostname)      p.set('hostname',       filter.hostname);
  if (filter.page)          p.set('page',           String(filter.page));
  if (filter.pageSize)      p.set('pageSize',       String(filter.pageSize));
  if (filter.sortBy)        p.set('sortBy',         filter.sortBy);
  if (filter.sortOrder)     p.set('sortOrder',      filter.sortOrder);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function listAgents(filter: AgentFilter = {}): Promise<AgentListResponse> {
  const res = await fetch(`${ATLAS_API_URL}/admin/agents${buildQuery(filter)}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<AgentListResponse>;
}

export async function getAgent(id: string): Promise<Agent> {
  return apiFetch<Agent>(`/admin/agents/${id}`);
}

export async function getCompanyAgents(companyId: string): Promise<Agent[]> {
  return apiFetch<Agent[]>(`/admin/companies/${companyId}/agents`);
}

export async function disableAgent(id: string): Promise<void> {
  await fetch(`${ATLAS_API_URL}/admin/agents/${id}/disable`, { method: 'PATCH' });
}

export async function enableAgent(id: string): Promise<void> {
  await fetch(`${ATLAS_API_URL}/admin/agents/${id}/enable`, { method: 'PATCH' });
}

export async function deleteAgent(id: string): Promise<void> {
  await fetch(`${ATLAS_API_URL}/admin/agents/${id}`, { method: 'DELETE' });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiFetch<DashboardMetrics>('/admin/dashboard/metrics');
}

export async function getDashboardActivity(sinceMs = 3_600_000): Promise<ActivityData> {
  return apiFetch<ActivityData>(`/admin/dashboard/activity?sinceMs=${sinceMs}&limit=50`);
}

// ─── Companies (derived from agents) ─────────────────────────────────────────

export async function listCompanies(): Promise<Company[]> {
  const { data } = await listAgents({ pageSize: 500 });
  const map = new Map<string, { total: number; online: number }>();
  for (const a of data) {
    const c = map.get(a.companyId) ?? { total: 0, online: 0 };
    c.total++;
    if (a.healthStatus === 'ONLINE') c.online++;
    map.set(a.companyId, c);
  }
  return Array.from(map.entries()).map(([id, v]) => ({
    companyId:   id,
    agentCount:  v.total,
    onlineCount: v.online,
  }));
}
