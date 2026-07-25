import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as alertsService from '@/services/alerts.service';
import type { RuntimeAlert } from '@/types/fleet';

const KEY = 'fleet-alerts';

export function useAlerts(
  filters: { severity?: string; status?: string; type?: string } = {}
): UseQueryResult<RuntimeAlert[]> {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => alertsService.listAlerts(filters),
    refetchInterval: 15_000,
  });
}

export function useAcknowledgeAlert(): UseMutationResult<RuntimeAlert, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertsService.acknowledgeAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useResolveAlert(): UseMutationResult<RuntimeAlert, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertsService.resolveAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
