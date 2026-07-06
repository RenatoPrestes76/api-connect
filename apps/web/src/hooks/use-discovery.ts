'use client';
import { useQuery } from '@tanstack/react-query';
import {
  listDiscoveryRuns,
  getEntities,
  getSuggestions,
  getGraph,
} from '@/services/discovery.service';

export function useDiscoveryRuns() {
  return useQuery({
    queryKey: ['discovery-runs'],
    queryFn:  ({ signal }) => listDiscoveryRuns(signal),
  });
}

export function useDiscoveryEntities(
  analysisId: string,
  opts: { entity?: string; minConfidence?: number } = {},
) {
  return useQuery({
    queryKey: ['discovery-entities', analysisId, opts],
    queryFn:  ({ signal }) => getEntities(analysisId, opts, signal),
    enabled:  !!analysisId,
  });
}

export function useDiscoverySuggestions(analysisId: string, priority?: 1 | 2 | 3) {
  return useQuery({
    queryKey: ['discovery-suggestions', analysisId, priority],
    queryFn:  ({ signal }) => getSuggestions(analysisId, priority, signal),
    enabled:  !!analysisId,
  });
}

export function useDiscoveryGraph(analysisId: string) {
  return useQuery({
    queryKey: ['discovery-graph', analysisId],
    queryFn:  ({ signal }) => getGraph(analysisId, signal),
    enabled:  !!analysisId,
  });
}
