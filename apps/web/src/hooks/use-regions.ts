import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { regionsService } from '@/services/regions.service';
import type { FailoverPayload, MigratePayload, SyncPayload } from '@/types/regions';

export function useGlobalOverview() {
  return useQuery({
    queryKey: ['global-overview'],
    queryFn: () => regionsService.getGlobalOverview(),
    refetchInterval: 30_000,
  });
}

export function useRegions(params?: { status?: string; continent?: string }) {
  return useQuery({
    queryKey: ['regions', params],
    queryFn: () => regionsService.getRegions(params),
    refetchInterval: 30_000,
  });
}

export function useRegionStatus() {
  return useQuery({
    queryKey: ['region-status'],
    queryFn: () => regionsService.getRegionStatus(),
    refetchInterval: 30_000,
  });
}

export function useReplication(params?: {
  sourceRegion?: string;
  targetRegion?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['replication', params],
    queryFn: () => regionsService.getReplication(params),
    refetchInterval: 30_000,
  });
}

export function useTriggerFailover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FailoverPayload) => regionsService.triggerFailover(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-overview'] });
      qc.invalidateQueries({ queryKey: ['regions'] });
    },
  });
}

export function useMigrateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MigratePayload) => regionsService.migrateTenant(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['global-overview'] });
      qc.invalidateQueries({ queryKey: ['regions'] });
    },
  });
}

export function useSyncRegions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SyncPayload) => regionsService.syncRegions(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['replication'] });
      qc.invalidateQueries({ queryKey: ['global-overview'] });
    },
  });
}
