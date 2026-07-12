import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { operationsService } from '../services/operations.service';
import type { AlertSeverity, SlaPeriod, ActionType } from '../types/operations';

export function useOperationsOverview() {
  return useQuery({
    queryKey: ['operations', 'overview'],
    queryFn: () => operationsService.getOverview(),
    refetchInterval: 30_000,
  });
}

export function useOperationsHealth(tenantId?: string) {
  return useQuery({
    queryKey: ['operations', 'health', tenantId],
    queryFn: () => operationsService.getHealth(tenantId),
    refetchInterval: 30_000,
  });
}

export function useOperationsAlerts(filters?: {
  tenantId?: string;
  severity?: AlertSeverity;
  resolved?: boolean;
}) {
  return useQuery({
    queryKey: ['operations', 'alerts', filters],
    queryFn: () => operationsService.getAlerts(filters),
    refetchInterval: 15_000,
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => operationsService.resolveAlert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations', 'alerts'] });
      qc.invalidateQueries({ queryKey: ['operations', 'overview'] });
    },
  });
}

export function useOperationsEvents(tenantId?: string, limit?: number) {
  return useQuery({
    queryKey: ['operations', 'events', tenantId, limit],
    queryFn: () => operationsService.getEvents(tenantId, limit),
    refetchInterval: 10_000,
  });
}

export function useOperationsMetrics(tenantId?: string) {
  return useQuery({
    queryKey: ['operations', 'metrics', tenantId],
    queryFn: () => operationsService.getMetrics(tenantId),
    refetchInterval: 60_000,
  });
}

export function useOperationsSla(period?: SlaPeriod, tenantId?: string) {
  return useQuery({
    queryKey: ['operations', 'sla', period, tenantId],
    queryFn: () => operationsService.getSla(period, tenantId),
  });
}

export function useRunAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, payload }: { action: ActionType; payload: Record<string, unknown> }) =>
      operationsService.runAction(action, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations'] });
    },
  });
}
