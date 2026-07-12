import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tenantsService from '@/services/tenants.service';

const KEY = 'admin-tenants';

export function useTenants(status?: string) {
  return useQuery({ queryKey: [KEY, status], queryFn: () => tenantsService.listTenants(status) });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tenantsService.createTenant,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateTenant() {
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

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tenantsService.deleteTenant,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
