import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as featureFlagsService from '@/services/feature-flags.service';

const KEY = 'admin-feature-flags';

export function useFeatureFlags(
  filters: { organizationId?: string; environmentId?: string } = {}
): UseQueryResult<Awaited<ReturnType<typeof featureFlagsService.listFeatureFlags>>> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => featureFlagsService.listFeatureFlags(filters),
  });
}

export function useCreateFeatureFlag(): UseMutationResult<
  Awaited<ReturnType<typeof featureFlagsService.createFeatureFlag>>,
  Error,
  Parameters<typeof featureFlagsService.createFeatureFlag>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: featureFlagsService.createFeatureFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useToggleFeatureFlag(): UseMutationResult<
  Awaited<ReturnType<typeof featureFlagsService.toggleFeatureFlag>>,
  Error,
  Parameters<typeof featureFlagsService.toggleFeatureFlag>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: featureFlagsService.toggleFeatureFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteFeatureFlag(): UseMutationResult<
  Awaited<ReturnType<typeof featureFlagsService.deleteFeatureFlag>>,
  Error,
  Parameters<typeof featureFlagsService.deleteFeatureFlag>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: featureFlagsService.deleteFeatureFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
