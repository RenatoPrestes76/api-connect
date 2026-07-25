import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as runtimeService from '@/services/runtime.service';
import type { RuntimeFilters } from '@/services/runtime.service';

const KEY = 'admin-runtimes';

export function useRuntimes(
  filters: RuntimeFilters = {}
): UseQueryResult<Awaited<ReturnType<typeof runtimeService.listRuntimes>>> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => runtimeService.listRuntimes(filters),
  });
}

export function useRestartRuntime(): UseMutationResult<
  Awaited<ReturnType<typeof runtimeService.restartRuntime>>,
  Error,
  Parameters<typeof runtimeService.restartRuntime>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runtimeService.restartRuntime,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateRuntimeVersion(): UseMutationResult<
  Awaited<ReturnType<typeof runtimeService.updateRuntimeVersion>>,
  Error,
  { id: string; version: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: string }) =>
      runtimeService.updateRuntimeVersion(id, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRetireRuntime(): UseMutationResult<
  Awaited<ReturnType<typeof runtimeService.retireRuntime>>,
  Error,
  Parameters<typeof runtimeService.retireRuntime>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runtimeService.retireRuntime,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useIssueRuntimeToken(): UseMutationResult<
  Awaited<ReturnType<typeof runtimeService.issueRuntimeToken>>,
  Error,
  Parameters<typeof runtimeService.issueRuntimeToken>[0]
> {
  return useMutation({ mutationFn: runtimeService.issueRuntimeToken });
}
