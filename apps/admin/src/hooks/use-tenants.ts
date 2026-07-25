import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as tenantsService from '@/services/tenants.service';

const KEY = 'admin-tenants';

export function useTenants(
  status?: string
): UseQueryResult<Awaited<ReturnType<typeof tenantsService.listTenants>>> {
  return useQuery({ queryKey: [KEY, status], queryFn: () => tenantsService.listTenants(status) });
}

export function useCreateTenant(): UseMutationResult<
  Awaited<ReturnType<typeof tenantsService.createTenant>>,
  Error,
  Parameters<typeof tenantsService.createTenant>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tenantsService.createTenant,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateTenant(): UseMutationResult<
  Awaited<ReturnType<typeof tenantsService.updateTenant>>,
  Error,
  { id: string; patch: Parameters<typeof tenantsService.updateTenant>[1] }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof tenantsService.updateTenant>[1];
    }) => tenantsService.updateTenant(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteTenant(): UseMutationResult<
  Awaited<ReturnType<typeof tenantsService.deleteTenant>>,
  Error,
  Parameters<typeof tenantsService.deleteTenant>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tenantsService.deleteTenant,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
