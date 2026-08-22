import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as canonicalModelService from '@/services/canonical-model.service';

const KEY = 'admin-canonical-model';

export function useCanonicalModel(
  organizationId: string,
  status: 'latest' | 'approved' = 'approved'
): UseQueryResult<Awaited<ReturnType<typeof canonicalModelService.getCanonicalModel>>> {
  return useQuery({
    queryKey: [KEY, organizationId, status],
    queryFn: () => canonicalModelService.getCanonicalModel(organizationId, status),
    enabled: Boolean(organizationId),
    retry: false,
  });
}

export function useBuildCanonicalModel(): UseMutationResult<
  Awaited<ReturnType<typeof canonicalModelService.buildCanonicalModel>>,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: canonicalModelService.buildCanonicalModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useApproveCanonicalModel(): UseMutationResult<
  Awaited<ReturnType<typeof canonicalModelService.approveCanonicalModel>>,
  Error,
  { organizationId: string; modelId: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, modelId }) =>
      canonicalModelService.approveCanonicalModel(organizationId, modelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
