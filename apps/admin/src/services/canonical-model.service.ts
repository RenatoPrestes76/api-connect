import { makeErpPlatformClient } from '@/lib/erp-platform-client';
import type { CanonicalModel } from '@/types/erp-platform';

const client = makeErpPlatformClient('canonical-model');

export async function buildCanonicalModel(organizationId: string): Promise<{
  model: CanonicalModel;
  profilesConsidered: number;
  profilesContributing: number;
}> {
  return client.post('/build', { organizationId });
}

export async function getCanonicalModel(
  organizationId: string,
  status: 'latest' | 'approved' = 'approved'
): Promise<{ model: CanonicalModel }> {
  return client.get(`/${organizationId}?status=${status}`);
}

export async function approveCanonicalModel(
  organizationId: string,
  modelId: string
): Promise<{ model: CanonicalModel }> {
  return client.post('/approve', { organizationId, modelId });
}
