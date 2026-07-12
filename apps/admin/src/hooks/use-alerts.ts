import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as alertsService from '@/services/alerts.service';

const KEY = 'fleet-alerts';

export function useAlerts(filters: { severity?: string; status?: string; type?: string } = {}) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: () => alertsService.listAlerts(filters),
    refetchInterval: 15_000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertsService.acknowledgeAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertsService.resolveAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
