import { makeErpPlatformClient } from '@/lib/erp-platform-client';
import type { ActivationKey, AtlasRuntime, AtlasRuntimeStatus } from '@/types/erp-platform';

const client = makeErpPlatformClient('atlas-runtimes');

function buildQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listAtlasRuntimes(
  filters: {
    organizationId?: string;
    status?: AtlasRuntimeStatus;
  } = {}
): Promise<AtlasRuntime[]> {
  const data = await client.get<{ runtimes: AtlasRuntime[] }>(`/runtimes${buildQuery(filters)}`);
  return data.runtimes;
}

export async function getAtlasRuntime(id: string): Promise<{
  runtime: AtlasRuntime;
  certificate: { certificateId: string; expiresAt: string; revoked: boolean } | null;
}> {
  return client.get(`/runtimes/${id}`);
}

export async function blockAtlasRuntime(id: string): Promise<{ runtime: AtlasRuntime }> {
  return client.post(`/runtimes/${id}/block`);
}

export async function reactivateAtlasRuntime(id: string): Promise<{ runtime: AtlasRuntime }> {
  return client.post(`/runtimes/${id}/reactivate`);
}

export async function revokeAtlasRuntimeCredentials(
  id: string
): Promise<{ revoked: boolean; runtimeId: string }> {
  return client.del(`/runtimes/${id}/credentials`);
}

export async function listActivationKeys(): Promise<ActivationKey[]> {
  const data = await client.get<{ activationKeys: ActivationKey[] }>('/activation-keys');
  return data.activationKeys;
}

export async function issueActivationKey(
  organizationCode: string
): Promise<{ activationKey: ActivationKey }> {
  return client.post('/activation-keys', { organizationCode });
}

export async function revokeActivationKey(id: string): Promise<{ activationKey: ActivationKey }> {
  return client.del(`/activation-keys/${id}`);
}
