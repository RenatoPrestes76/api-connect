import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as semanticMappingService from '@/services/semantic-mapping.service';
import type { MappingStatus } from '@/types/erp-platform';

const KEY = 'admin-semantic-mapping';

export function useMappingEntities(
  profileId: string
): UseQueryResult<Awaited<ReturnType<typeof semanticMappingService.listMappingEntities>>> {
  return useQuery({
    queryKey: [KEY, 'entities', profileId],
    queryFn: () => semanticMappingService.listMappingEntities(profileId),
    enabled: Boolean(profileId),
  });
}

export function useMappingsForReview(
  profileId: string,
  status: MappingStatus = 'PENDING'
): UseQueryResult<Awaited<ReturnType<typeof semanticMappingService.listMappingsForReview>>> {
  return useQuery({
    queryKey: [KEY, 'review', profileId, status],
    queryFn: () => semanticMappingService.listMappingsForReview(profileId, status),
    enabled: Boolean(profileId),
  });
}

export function useAnalyzeProfile(): UseMutationResult<
  Awaited<ReturnType<typeof semanticMappingService.analyzeProfile>>,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: semanticMappingService.analyzeProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDecideMapping(): UseMutationResult<
  Awaited<ReturnType<typeof semanticMappingService.decideMapping>>,
  Error,
  Parameters<typeof semanticMappingService.decideMapping>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: semanticMappingService.decideMapping,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
