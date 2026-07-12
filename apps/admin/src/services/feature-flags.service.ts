import { cpGet, cpPost, cpDelete } from '@/lib/control-plane-client';
import type { FeatureFlag } from '@/types/control-plane';

export async function listFeatureFlags(
  filters: { organizationId?: string; environmentId?: string } = {}
): Promise<FeatureFlag[]> {
  const params = new URLSearchParams();
  if (filters.organizationId) params.set('organizationId', filters.organizationId);
  if (filters.environmentId) params.set('environmentId', filters.environmentId);
  const qs = params.toString();
  const data = await cpGet<{ flags: FeatureFlag[] }>(`/feature-flags${qs ? `?${qs}` : ''}`);
  return data.flags;
}

export async function createFeatureFlag(input: {
  key: string;
  organizationId?: string;
  environmentId?: string;
  kind?: FeatureFlag['kind'];
  enabled?: boolean;
  rolloutPercent?: number;
  description?: string;
}): Promise<FeatureFlag> {
  return cpPost<FeatureFlag>('/feature-flags', input);
}

export async function toggleFeatureFlag(id: string): Promise<FeatureFlag> {
  return cpPost<FeatureFlag>(`/feature-flags/${id}/toggle`);
}

export async function deleteFeatureFlag(id: string): Promise<void> {
  await cpDelete(`/feature-flags/${id}`);
}
