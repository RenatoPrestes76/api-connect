import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { haService } from '../services/ha.service';
import type { BackupType, NodeRole, NodeStatus } from '../types/ha';

export function useClusterOverview() {
  return useQuery({
    queryKey: ['ha', 'cluster'],
    queryFn: () => haService.getCluster(),
    refetchInterval: 30_000,
  });
}

export function useClusterNodes(filters?: { status?: NodeStatus; role?: NodeRole }) {
  return useQuery({
    queryKey: ['ha', 'nodes', filters],
    queryFn: () => haService.getNodes(filters),
    refetchInterval: 30_000,
  });
}

export function useFailoverEvents(limit?: number) {
  return useQuery({
    queryKey: ['ha', 'failovers', limit],
    queryFn: () => haService.getFailovers(limit),
  });
}

export function useTriggerFailover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      fromNodeId,
      toNodeId,
      reason,
    }: {
      fromNodeId: string;
      toNodeId: string;
      reason?: string;
    }) => haService.triggerFailover(fromNodeId, toNodeId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ha'] });
    },
  });
}

export function useBackups(filters?: {
  tenantId?: string;
  status?: import('../types/ha').BackupStatus;
}) {
  return useQuery({
    queryKey: ['ha', 'backups', filters],
    queryFn: () => haService.getBackups(filters),
    refetchInterval: 60_000,
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, type }: { tenantId: string; type?: BackupType }) =>
      haService.createBackup(tenantId, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ha', 'backups'] });
      qc.invalidateQueries({ queryKey: ['ha', 'cluster'] });
    },
  });
}

export function useRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      backupId,
      tenantId,
      environment,
    }: {
      backupId: string;
      tenantId: string;
      environment?: string;
    }) => haService.restore(backupId, tenantId, environment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ha'] });
    },
  });
}

export function useRecoveryTests(tenantId?: string) {
  return useQuery({
    queryKey: ['ha', 'recovery', tenantId],
    queryFn: () => haService.getRecoveryTests(tenantId),
  });
}

export function useRunRecoveryTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => haService.runRecoveryTest(tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ha', 'recovery'] });
      qc.invalidateQueries({ queryKey: ['ha', 'cluster'] });
    },
  });
}
