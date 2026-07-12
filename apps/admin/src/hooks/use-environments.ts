import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as environmentsService from '@/services/environments.service';

const KEY = 'admin-environments';

export function useEnvironments(organizationId?: string) {
  return useQuery({
    queryKey: [KEY, organizationId],
    queryFn: () => environmentsService.listEnvironments(organizationId),
  });
}

export function useCreateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: environmentsService.createEnvironment,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: environmentsService.deleteEnvironment,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
