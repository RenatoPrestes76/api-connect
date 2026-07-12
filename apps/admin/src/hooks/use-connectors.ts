import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as connectorsService from '@/services/connectors.service';

const KEY = 'admin-connectors';

export function useConnectors(filters: { status?: string; category?: string } = {}) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => connectorsService.listConnectors(filters),
  });
}

export function useConnectorVersions(connectorId: string | undefined) {
  return useQuery({
    queryKey: [KEY, connectorId, 'versions'],
    queryFn: () => connectorsService.listConnectorVersions(connectorId as string),
    enabled: Boolean(connectorId),
  });
}

export function useCreateConnectorVersion() {
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

export function usePublishConnectorVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectorId, versionId }: { connectorId: string; versionId: string }) =>
      connectorsService.publishConnectorVersion(connectorId, versionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
