import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as organizationsService from '@/services/companies.service';
import type { OrganizationFilters } from '@/services/companies.service';

const KEY = 'admin-organizations';

export function useOrganizations(filters: OrganizationFilters = {}) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => organizationsService.listOrganizations(filters),
  });
}

export function useOrganizationConnectors(organizationId: string | undefined) {
  return useQuery({
    queryKey: [KEY, organizationId, 'connectors'],
    queryFn: () => organizationsService.listOrganizationConnectors(organizationId as string),
    enabled: Boolean(organizationId),
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organizationsService.createOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateOrganization() {
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

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organizationsService.deleteOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
