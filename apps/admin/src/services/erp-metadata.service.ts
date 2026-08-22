import { makeErpPlatformClient } from '@/lib/erp-platform-client';
import type {
  DiscoveryRequest,
  DiscoveryStatus,
  ErpMetadataCache,
  ErpMetadataTableSummary,
} from '@/types/erp-platform';

const client = makeErpPlatformClient('erp-metadata');

function buildQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listDiscoveryRequests(
  filters: {
    runtimeId?: string;
    organizationId?: string;
    status?: DiscoveryStatus;
  } = {}
): Promise<DiscoveryRequest[]> {
  const data = await client.get<{ requests: DiscoveryRequest[] }>(
    `/requests${buildQuery(filters)}`
  );
  return data.requests;
}

export async function getDiscoveryRequest(id: string): Promise<DiscoveryRequest> {
  const data = await client.get<{ request: DiscoveryRequest }>(`/requests/${id}`);
  return data.request;
}

export async function requestDiscovery(input: {
  runtimeId: string;
  organizationId: string;
  profileId: string;
}): Promise<DiscoveryRequest> {
  const data = await client.post<{ request: DiscoveryRequest }>('/discover', input);
  return data.request;
}

export async function getTablesForProfile(profileId: string): Promise<ErpMetadataTableSummary[]> {
  const data = await client.get<{ tables: ErpMetadataTableSummary[] }>(
    `/tables?profileId=${encodeURIComponent(profileId)}`
  );
  return data.tables;
}

export async function getSchemaCacheForProfile(
  profileId: string
): Promise<{ cache: ErpMetadataCache }> {
  return client.get(`/schema?profileId=${encodeURIComponent(profileId)}`);
}
