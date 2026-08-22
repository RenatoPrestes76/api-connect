import { makeErpPlatformClient } from '@/lib/erp-platform-client';
import type { MappingStatus, SemanticMapping } from '@/types/erp-platform';

const client = makeErpPlatformClient('semantic-mapping');

export async function analyzeProfile(
  profileId: string
): Promise<{ summary: { tablesAnalyzed: number; pending: number; approved: number } }> {
  return client.post('/analyze', { profileId });
}

export async function listMappingEntities(profileId: string): Promise<SemanticMapping[]> {
  const data = await client.get<{ entities: SemanticMapping[] }>(
    `/entities?profileId=${encodeURIComponent(profileId)}`
  );
  return data.entities;
}

export async function listMappingsForReview(
  profileId: string,
  status: MappingStatus = 'PENDING'
): Promise<SemanticMapping[]> {
  const data = await client.get<{ mappings: SemanticMapping[] }>(
    `/review?profileId=${encodeURIComponent(profileId)}&status=${status}`
  );
  return data.mappings;
}

export async function decideMapping(input: {
  profileId: string;
  schema: string;
  table: string;
  decision: 'APPROVE' | 'REJECT';
  entity?: string;
}): Promise<SemanticMapping> {
  const data = await client.post<{ mapping: SemanticMapping }>('/approve', input);
  return data.mapping;
}
