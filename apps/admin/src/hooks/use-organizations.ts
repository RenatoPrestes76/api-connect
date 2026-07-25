import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as organizationsService from '@/services/companies.service';
import type { OrganizationFilters } from '@/services/companies.service';

const KEY = 'admin-organizations';

export function useOrganizations(
  filters: OrganizationFilters = {}
): UseQueryResult<Awaited<ReturnType<typeof organizationsService.listOrganizations>>> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => organizationsService.listOrganizations(filters),
  });
}

export function useOrganizationConnectors(
  organizationId: string | undefined
): UseQueryResult<Awaited<ReturnType<typeof organizationsService.listOrganizationConnectors>>> {
  return useQuery({
    queryKey: [KEY, organizationId, 'connectors'],
    queryFn: () => organizationsService.listOrganizationConnectors(organizationId as string),
    enabled: Boolean(organizationId),
  });
}

export function useCreateOrganization(): UseMutationResult<
  Awaited<ReturnType<typeof organizationsService.createOrganization>>,
  Error,
  Parameters<typeof organizationsService.createOrganization>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organizationsService.createOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateOrganization(): UseMutationResult<
  Awaited<ReturnType<typeof organizationsService.updateOrganization>>,
  Error,
  { id: string; patch: Parameters<typeof organizationsService.updateOrganization>[1] }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof organizationsService.updateOrganization>[1];
    }) => organizationsService.updateOrganization(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteOrganization(): UseMutationResult<
  Awaited<ReturnType<typeof organizationsService.deleteOrganization>>,
  Error,
  Parameters<typeof organizationsService.deleteOrganization>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organizationsService.deleteOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
