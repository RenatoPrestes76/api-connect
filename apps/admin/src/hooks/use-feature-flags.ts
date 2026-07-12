import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as featureFlagsService from '@/services/feature-flags.service';

const KEY = 'admin-feature-flags';

export function useFeatureFlags(filters: { organizationId?: string; environmentId?: string } = {}) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => featureFlagsService.listFeatureFlags(filters),
  });
}

export function useCreateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: featureFlagsService.createFeatureFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useToggleFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: featureFlagsService.toggleFeatureFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: featureFlagsService.deleteFeatureFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
