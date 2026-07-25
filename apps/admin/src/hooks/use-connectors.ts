import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as connectorsService from '@/services/connectors.service';
import type { Connector, ConnectorVersion } from '@/types/control-plane';

const KEY = 'admin-connectors';

export function useConnectors(
  filters: { status?: string; category?: string } = {}
): UseQueryResult<Connector[]> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => connectorsService.listConnectors(filters),
  });
}

export function useConnectorVersions(
  connectorId: string | undefined
): UseQueryResult<ConnectorVersion[]> {
  return useQuery({
    queryKey: [KEY, connectorId, 'versions'],
    queryFn: () => connectorsService.listConnectorVersions(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function useCreateConnectorVersion(): UseMutationResult<
  ConnectorVersion,
  Error,
  { connectorId: string; input: { version: string; changelog?: string } }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectorId,
      input,
    }: {
      connectorId: string;
      input: { version: string; changelog?: string };
    }) => connectorsService.createConnectorVersion(connectorId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function usePublishConnectorVersion(): UseMutationResult<
  ConnectorVersion,
  Error,
  { connectorId: string; versionId: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectorId, versionId }: { connectorId: string; versionId: string }) =>
      connectorsService.publishConnectorVersion(connectorId, versionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
