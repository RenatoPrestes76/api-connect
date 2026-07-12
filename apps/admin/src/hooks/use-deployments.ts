import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as deploymentsService from '@/services/deployments.service';

const KEY = 'admin-deployments';

export function useDeployments(
  filters: { organizationId?: string; environmentId?: string; status?: string } = {}
) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => deploymentsService.listDeployments(filters),
  });
}

export function useCreateDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deploymentsService.createDeployment,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRollbackDeployment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deploymentsService.rollbackDeployment,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
