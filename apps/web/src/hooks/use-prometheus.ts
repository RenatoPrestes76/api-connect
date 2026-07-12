'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prometheusService } from '@/services/prometheus.service';
import type { DashboardType } from '@/types/prometheus';

const Q = {
  telemetryOverview: ['telemetry', 'overview'] as const,
  traces: (p?: object) => ['telemetry', 'traces', p] as const,
  serviceMap: ['telemetry', 'service-map'] as const,
  dashboard: (t: DashboardType) => ['prometheus', 'dashboard', t] as const,
  anomalies: (p?: object) => ['prometheus', 'anomalies', p] as const,
  incidents: (p?: object) => ['prometheus', 'incidents', p] as const,
  predictiveAlerts: (p?: object) => ['prometheus', 'alerts', p] as const,
  recommendations: (p?: object) => ['prometheus', 'recommendations', p] as const,
  selfHealing: ['prometheus', 'self-healing'] as const,
  slo: (p?: object) => ['prometheus', 'slo', p] as const,
  capacity: ['prometheus', 'capacity'] as const,
  costs: (p?: object) => ['prometheus', 'costs', p] as const,
  runbooks: (p?: object) => ['prometheus', 'runbooks', p] as const,
};

export function useTelemetryOverview() {
  return useQuery({
    queryKey: Q.telemetryOverview,
    queryFn: prometheusService.getTelemetryOverview,
    refetchInterval: 30_000,
  });
}

export function useTraces(params?: { service?: string; status?: string; limit?: number }) {
  return useQuery({
    queryKey: Q.traces(params),
    queryFn: () => prometheusService.getTraces(params),
    refetchInterval: 30_000,
  });
}

export function useServiceMap() {
  return useQuery({
    queryKey: Q.serviceMap,
    queryFn: prometheusService.getServiceMap,
    refetchInterval: 30_000,
  });
}

export function useDashboard(type: DashboardType) {
  return useQuery({
    queryKey: Q.dashboard(type),
    queryFn: () => prometheusService.getDashboard(type),
    refetchInterval: 30_000,
  });
}

export function useAnomalies(params?: { severity?: string; status?: string }) {
  return useQuery({
    queryKey: Q.anomalies(params),
    queryFn: () => prometheusService.getAnomalies(params),
    refetchInterval: 20_000,
  });
}

export function useIncidents(params?: { status?: string; severity?: string }) {
  return useQuery({
    queryKey: Q.incidents(params),
    queryFn: () => prometheusService.getIncidents(params),
    refetchInterval: 20_000,
  });
}

export function useResolveIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => prometheusService.resolveIncident(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prometheus', 'incidents'] });
    },
  });
}

export function usePredictiveAlerts(params?: { type?: string }) {
  return useQuery({
    queryKey: Q.predictiveAlerts(params),
    queryFn: () => prometheusService.getPredictiveAlerts(params),
    refetchInterval: 60_000,
  });
}

export function useRecommendations(params?: { category?: string; status?: string }) {
  return useQuery({
    queryKey: Q.recommendations(params),
    queryFn: () => prometheusService.getRecommendations(params),
  });
}

export function useApplyRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => prometheusService.applyRecommendation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prometheus', 'recommendations'] });
    },
  });
}

export function useDismissRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => prometheusService.dismissRecommendation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prometheus', 'recommendations'] });
    },
  });
}

export function useSelfHealingRules() {
  return useQuery({ queryKey: Q.selfHealing, queryFn: prometheusService.getSelfHealingRules });
}

export function useToggleSelfHealingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => prometheusService.toggleSelfHealingRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: Q.selfHealing });
    },
  });
}

export function useSLOTargets(params?: { tenantId?: string; status?: string }) {
  return useQuery({
    queryKey: Q.slo(params),
    queryFn: () => prometheusService.getSLOTargets(params),
    refetchInterval: 60_000,
  });
}

export function useCapacityPlan() {
  return useQuery({ queryKey: Q.capacity, queryFn: prometheusService.getCapacityPlan });
}

export function useCostReport(params?: { tenantId?: string }) {
  return useQuery({
    queryKey: Q.costs(params),
    queryFn: () => prometheusService.getCostReport(params),
  });
}

export function useRunbooks(params?: { mode?: string; trigger?: string }) {
  return useQuery({
    queryKey: Q.runbooks(params),
    queryFn: () => prometheusService.getRunbooks(params),
  });
}

export function useExecuteRunbook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => prometheusService.executeRunbook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prometheus', 'runbooks'] });
    },
  });
}

export function useQueryCopilot() {
  return useMutation({
    mutationFn: (question: string) => prometheusService.queryCopilot(question),
  });
}
