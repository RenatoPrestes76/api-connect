import { api } from './api-client';
import type { DiscoveryAnalysis, DiscoveryEntity, DiscoverySuggestion, DiscoveryGraph } from '@/types/index';

export interface AnalyzeRequest {
  schema: {
    name:   string;
    tables: unknown[];
    relations: unknown[];
    discoveredAt: string;
  };
  source?: {
    host?:        string;
    port?:        number;
    database?:    string;
    connectorId?: string;
  };
}

export async function analyzeSchema(req: AnalyzeRequest): Promise<DiscoveryAnalysis> {
  return api.post<DiscoveryAnalysis>('/api/v1/discovery/analyze-schema', req);
}

export async function getEntities(
  analysisId: string,
  opts: { entity?: string; minConfidence?: number } = {},
  signal?: AbortSignal,
): Promise<{ analysisId: string; total: number; entities: DiscoveryEntity[] }> {
  const params = new URLSearchParams({ analysisId });
  if (opts.entity)        params.set('entity', opts.entity);
  if (opts.minConfidence) params.set('minConfidence', String(opts.minConfidence));
  return api.get(`/api/v1/discovery/entities?${params}`, signal);
}

export async function getSuggestions(
  analysisId: string,
  priority?: 1 | 2 | 3,
  signal?: AbortSignal,
): Promise<{ analysisId: string; total: number; suggestions: DiscoverySuggestion[] }> {
  const params = new URLSearchParams({ analysisId });
  if (priority) params.set('priority', String(priority));
  return api.get(`/api/v1/discovery/suggestions?${params}`, signal);
}

export async function getGraph(
  analysisId: string,
  signal?: AbortSignal,
): Promise<{ analysisId: string; graph: DiscoveryGraph }> {
  return api.get(`/api/v1/discovery/graph?analysisId=${encodeURIComponent(analysisId)}`, signal);
}

export async function listDiscoveryRuns(signal?: AbortSignal): Promise<DiscoveryAnalysis[]> {
  return api.get<DiscoveryAnalysis[]>('/api/v1/hub/discovery', signal);
}
