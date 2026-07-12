import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as runtimeService from '@/services/runtime.service';
import type { RuntimeFilters } from '@/services/runtime.service';

const KEY = 'admin-runtimes';

export function useRuntimes(filters: RuntimeFilters = {}) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => runtimeService.listRuntimes(filters),
  });
}

export function useRestartRuntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runtimeService.restartRuntime,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateRuntimeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: string }) =>
      runtimeService.updateRuntimeVersion(id, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useRetireRuntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runtimeService.retireRuntime,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useIssueRuntimeToken() {
  return useMutation({ mutationFn: runtimeService.issueRuntimeToken });
}
