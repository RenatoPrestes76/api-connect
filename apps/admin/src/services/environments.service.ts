import { cpGet, cpPost, cpDelete } from '@/lib/control-plane-client';
import type { Environment } from '@/types/control-plane';

export async function listEnvironments(organizationId?: string): Promise<Environment[]> {
  const qs = organizationId ? `?organizationId=${organizationId}` : '';
  const data = await cpGet<{ environments: Environment[] }>(`/environments${qs}`);
  return data.environments;
}

export async function getEnvironment(id: string): Promise<Environment> {
  return cpGet<Environment>(`/environments/${id}`);
}

export async function createEnvironment(input: {
  organizationId: string;
  name: string;
  slug: string;
  kind: Environment['kind'];
}): Promise<Environment> {
  return cpPost<Environment>('/environments', input);
}

export async function deleteEnvironment(id: string): Promise<void> {
  await cpDelete(`/environments/${id}`);
}
