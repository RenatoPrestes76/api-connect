import { cpGet, cpPost, cpPatch, cpDelete } from '@/lib/control-plane-client';
import type { Tenant } from '@/types/control-plane';

export async function listTenants(status?: string): Promise<Tenant[]> {
  const qs = status ? `?status=${status}` : '';
  const data = await cpGet<{ tenants: Tenant[] }>(`/tenants${qs}`);
  return data.tenants;
}

export async function getTenant(id: string): Promise<Tenant> {
  return cpGet<Tenant>(`/tenants/${id}`);
}

export async function createTenant(input: {
  name: string;
  slug: string;
  primaryContactEmail?: string;
}): Promise<Tenant> {
  return cpPost<Tenant>('/tenants', input);
}

export async function updateTenant(
  id: string,
  patch: Partial<Pick<Tenant, 'name' | 'status' | 'primaryContactEmail'>>
): Promise<Tenant> {
  return cpPatch<Tenant>(`/tenants/${id}`, patch);
}

export async function deleteTenant(id: string): Promise<void> {
  await cpDelete(`/tenants/${id}`);
}
