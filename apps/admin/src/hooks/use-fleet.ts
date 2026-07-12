import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as fleetService from '@/services/fleet.service';
import type { RuntimeCommandType } from '@/types/fleet';

export function useFleetOverview() {
  return useQuery({
    queryKey: ['fleet-overview'],
    queryFn: fleetService.getFleetOverview,
    refetchInterval: 15_000,
  });
}

export function useRuntimeStatusFeed() {
  return useQuery({
    queryKey: ['fleet-runtime-status'],
    queryFn: fleetService.getRuntimeStatusFeed,
    refetchInterval: 15_000,
  });
}

export function useRuntimeDetail(runtimeId: string | undefined) {
  return useQuery({
    queryKey: ['fleet-runtime-detail', runtimeId],
    queryFn: () => fleetService.getRuntimeDetail(runtimeId as string),
    enabled: Boolean(runtimeId),
    refetchInterval: 10_000,
  });
}

export function useIssueRuntimeCommand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ runtimeId, type }: { runtimeId: string; type: RuntimeCommandType }) =>
      fleetService.issueRuntimeCommand(runtimeId, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fleet-runtime-status'] });
      qc.invalidateQueries({ queryKey: ['fleet-runtime-detail'] });
      qc.invalidateQueries({ queryKey: ['admin-runtimes'] });
    },
  });
}

export function useInstallConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectorId,
      organizationId,
      version,
    }: {
      connectorId: string;
      organizationId: string;
      version: string;
    }) => fleetService.installConnector(connectorId, organizationId, version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-connector-logs'] }),
  });
}

export function useRestartConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectorId,
      organizationId,
    }: {
      connectorId: string;
      organizationId: string;
    }) => fleetService.restartConnector(connectorId, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-connector-logs'] }),
  });
}

export function useRemoveConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      connectorId,
      organizationId,
    }: {
      connectorId: string;
      organizationId: string;
    }) => fleetService.removeConnector(connectorId, organizationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-connector-logs'] }),
  });
}

export function useConnectorLogs(
  connectorId: string | undefined,
  organizationId: string | undefined
) {
  return useQuery({
    queryKey: ['fleet-connector-logs', connectorId, organizationId],
    queryFn: () => fleetService.getConnectorLogs(connectorId as string, organizationId as string),
    enabled: Boolean(connectorId && organizationId),
  });
}
