import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as deploymentsService from '@/services/deployments.service';

const KEY = 'admin-deployments';

export function useDeployments(
  filters: { organizationId?: string; environmentId?: string; status?: string } = {}
): UseQueryResult<Awaited<ReturnType<typeof deploymentsService.listDeployments>>> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => deploymentsService.listDeployments(filters),
  });
}

export function useCreateDeployment(): UseMutationResult<
  Awaited<ReturnType<typeof deploymentsService.createDeployment>>,
  Error,
  Parameters<typeof deploymentsService.createDeployment>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deploymentsService.createDeployment,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRollbackDeployment(): UseMutationResult<
  Awaited<ReturnType<typeof deploymentsService.rollbackDeployment>>,
  Error,
  Parameters<typeof deploymentsService.rollbackDeployment>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deploymentsService.rollbackDeployment,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
