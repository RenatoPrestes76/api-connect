import { cpGet, cpPost } from '@/lib/control-plane-client';
import type { Runtime } from '@/types/control-plane';

export interface RuntimeFilters {
  organizationId?: string;
  environmentId?: string;
  status?: string;
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters as Record<string, string | undefined>))
    if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listRuntimes(filters: RuntimeFilters = {}): Promise<Runtime[]> {
  const data = await cpGet<{ runtimes: Runtime[] }>(`/runtimes${buildQuery(filters)}`);
  return data.runtimes;
}

export async function getRuntime(id: string): Promise<Runtime> {
  return cpGet<Runtime>(`/runtimes/${id}`);
}

export async function restartRuntime(id: string): Promise<Runtime> {
  return cpPost<Runtime>(`/runtimes/${id}/restart`);
}

export async function updateRuntimeVersion(id: string, version: string): Promise<Runtime> {
  return cpPost<Runtime>(`/runtimes/${id}/update`, { version });
}

export async function retireRuntime(id: string): Promise<Runtime> {
  return cpPost<Runtime>(`/runtimes/${id}/retire`);
}

export async function issueRuntimeToken(
  id: string
): Promise<{ token: string; expiresAt: string; tokenPrefix: string }> {
  return cpPost(`/runtimes/${id}/token`);
}
