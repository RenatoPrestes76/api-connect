import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as erpMetadataService from '@/services/erp-metadata.service';
import type { DiscoveryStatus } from '@/types/erp-platform';

const KEY = 'admin-discovery-requests';
const TABLES_KEY = 'admin-erp-metadata-tables';

export function useDiscoveryRequests(
  filters: {
    runtimeId?: string;
    organizationId?: string;
    status?: DiscoveryStatus;
  } = {}
): UseQueryResult<Awaited<ReturnType<typeof erpMetadataService.listDiscoveryRequests>>> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => erpMetadataService.listDiscoveryRequests(filters),
  });
}

export function useDiscoveryRequest(
  id: string
): UseQueryResult<Awaited<ReturnType<typeof erpMetadataService.getDiscoveryRequest>>> {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: () => erpMetadataService.getDiscoveryRequest(id),
    enabled: Boolean(id),
  });
}

export function useRequestDiscovery(): UseMutationResult<
  Awaited<ReturnType<typeof erpMetadataService.requestDiscovery>>,
  Error,
  Parameters<typeof erpMetadataService.requestDiscovery>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: erpMetadataService.requestDiscovery,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useErpMetadataTables(
  profileId: string
): UseQueryResult<Awaited<ReturnType<typeof erpMetadataService.getTablesForProfile>>> {
  return useQuery({
    queryKey: [TABLES_KEY, profileId],
    queryFn: () => erpMetadataService.getTablesForProfile(profileId),
    enabled: Boolean(profileId),
  });
}

export function useErpMetadataSchemaCache(
  profileId: string
): UseQueryResult<Awaited<ReturnType<typeof erpMetadataService.getSchemaCacheForProfile>>> {
  return useQuery({
    queryKey: [TABLES_KEY, 'schema', profileId],
    queryFn: () => erpMetadataService.getSchemaCacheForProfile(profileId),
    enabled: Boolean(profileId),
    retry: false,
  });
}
