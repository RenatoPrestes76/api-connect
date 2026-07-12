import { cpGet, cpPost, cpPatch, cpDelete } from '@/lib/control-plane-client';
import type { Organization, OrganizationConnector } from '@/types/control-plane';

export interface OrganizationFilters {
  tenantId?: string;
  status?: string;
  tier?: string;
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters as Record<string, string | undefined>))
    if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listOrganizations(
  filters: OrganizationFilters = {}
): Promise<Organization[]> {
  const data = await cpGet<{ organizations: Organization[] }>(
    `/organizations${buildQuery(filters)}`
  );
  return data.organizations;
}

export async function getOrganization(id: string): Promise<Organization> {
  return cpGet<Organization>(`/organizations/${id}`);
}

export async function createOrganization(input: {
  name: string;
  slug: string;
  tenantId?: string;
  tier?: Organization['tier'];
}): Promise<Organization> {
  return cpPost<Organization>('/organizations', input);
}

export async function updateOrganization(
  id: string,
  patch: Partial<Pick<Organization, 'name' | 'tier' | 'status' | 'tenantId'>>
): Promise<Organization> {
  return cpPatch<Organization>(`/organizations/${id}`, patch);
}

export async function deleteOrganization(id: string): Promise<void> {
  await cpDelete(`/organizations/${id}`);
}

export async function listOrganizationConnectors(
  organizationId: string
): Promise<OrganizationConnector[]> {
  const data = await cpGet<{ installed: OrganizationConnector[] }>(
    `/organizations/${organizationId}/connectors`
  );
  return data.installed;
}
