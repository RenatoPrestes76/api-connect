import { cpGet, cpPost } from '@/lib/control-plane-client';
import type { Deployment } from '@/types/control-plane';

export async function listDeployments(
  filters: { organizationId?: string; environmentId?: string; status?: string } = {}
): Promise<Deployment[]> {
  const params = new URLSearchParams();
  if (filters.organizationId) params.set('organizationId', filters.organizationId);
  if (filters.environmentId) params.set('environmentId', filters.environmentId);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  const data = await cpGet<{ deployments: Deployment[] }>(`/deployments${qs ? `?${qs}` : ''}`);
  return data.deployments;
}

export async function createDeployment(input: {
  organizationId: string;
  environmentId: string;
  pluginId: string;
  pluginVersionId: string;
}): Promise<Deployment> {
  return cpPost<Deployment>('/deployments', input);
}

export async function rollbackDeployment(id: string): Promise<Deployment> {
  return cpPost<Deployment>(`/deployments/${id}/rollback`);
}
