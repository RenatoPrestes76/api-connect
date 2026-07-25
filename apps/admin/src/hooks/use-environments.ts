import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as environmentsService from '@/services/environments.service';

const KEY = 'admin-environments';

export function useEnvironments(
  organizationId?: string
): UseQueryResult<Awaited<ReturnType<typeof environmentsService.listEnvironments>>> {
  return useQuery({
    queryKey: [KEY, organizationId],
    queryFn: () => environmentsService.listEnvironments(organizationId),
  });
}

export function useCreateEnvironment(): UseMutationResult<
  Awaited<ReturnType<typeof environmentsService.createEnvironment>>,
  Error,
  Parameters<typeof environmentsService.createEnvironment>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: environmentsService.createEnvironment,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteEnvironment(): UseMutationResult<
  Awaited<ReturnType<typeof environmentsService.deleteEnvironment>>,
  Error,
  Parameters<typeof environmentsService.deleteEnvironment>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: environmentsService.deleteEnvironment,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
