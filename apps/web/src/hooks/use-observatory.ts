'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as obs from '@/services/observatory.service';
import type { IncidentStatus } from '@/types/observatory';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const useDashboard = (live = false) =>
  useQuery({
    queryKey: ['observatory', 'dashboard'],
    queryFn: obs.fetchDashboard,
    refetchInterval: live ? 10_000 : false,
  });

export const useSystemHealth = (live = false) =>
  useQuery({
    queryKey: ['observatory', 'health'],
    queryFn: obs.fetchHealth,
    refetchInterval: live ? 15_000 : false,
  });

// ─── Metrics ──────────────────────────────────────────────────────────────────

export const useMetrics = (limit = 288, live = false) =>
  useQuery({
    queryKey: ['observatory', 'metrics', limit],
    queryFn: () => obs.fetchMetrics(limit),
    refetchInterval: live ? 30_000 : false,
  });

export const useHeatmap = () =>
  useQuery({
    queryKey: ['observatory', 'heatmap'],
    queryFn: obs.fetchHeatmap,
  });

// ─── Alert Rules ──────────────────────────────────────────────────────────────

export const useAlertRules = () =>
  useQuery({
    queryKey: ['observatory', 'alert-rules'],
    queryFn: obs.fetchAlertRules,
  });

export const useCreateAlertRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: obs.createAlertRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observatory', 'alert-rules'] });
    },
  });
};

export const useUpdateAlertRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof obs.updateAlertRule>[1] }) =>
      obs.updateAlertRule(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observatory', 'alert-rules'] });
    },
  });
};

export const useDeleteAlertRule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: obs.deleteAlertRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observatory', 'alert-rules'] });
    },
  });
};

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const useAlerts = (params?: Parameters<typeof obs.fetchAlerts>[0], live = false) =>
  useQuery({
    queryKey: ['observatory', 'alerts', params],
    queryFn: () => obs.fetchAlerts(params),
    refetchInterval: live ? 10_000 : false,
  });

export const useAcknowledgeAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: obs.acknowledgeAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observatory', 'alerts'] });
    },
  });
};

// ─── Incidents ────────────────────────────────────────────────────────────────

export const useIncidents = (params?: Parameters<typeof obs.fetchIncidents>[0], live = false) =>
  useQuery({
    queryKey: ['observatory', 'incidents', params],
    queryFn: () => obs.fetchIncidents(params),
    refetchInterval: live ? 15_000 : false,
  });

export const useIncident = (id: string) =>
  useQuery({
    queryKey: ['observatory', 'incidents', id],
    queryFn: () => obs.fetchIncident(id),
    enabled: !!id,
  });

export const useCreateIncident = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: obs.createIncident,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observatory', 'incidents'] });
    },
  });
};

export const useUpdateIncidentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      message,
    }: {
      id: string;
      status: IncidentStatus;
      message?: string;
    }) => obs.updateIncidentStatus(id, status, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observatory', 'incidents'] });
    },
  });
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export const useAuditLogs = (params?: Parameters<typeof obs.fetchAuditLogs>[0]) =>
  useQuery({
    queryKey: ['observatory', 'audit', params],
    queryFn: () => obs.fetchAuditLogs(params),
  });

// ─── SLA ──────────────────────────────────────────────────────────────────────

export const useSLAs = () =>
  useQuery({
    queryKey: ['observatory', 'sla'],
    queryFn: obs.fetchSLAs,
  });

export const useCreateSLA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: obs.createSLA,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['observatory', 'sla'] });
    },
  });
};

export const useSLAEvents = (params?: Parameters<typeof obs.fetchSLAEvents>[0]) =>
  useQuery({
    queryKey: ['observatory', 'sla-events', params],
    queryFn: () => obs.fetchSLAEvents(params),
  });

// ─── Timeline ─────────────────────────────────────────────────────────────────

export const useTimeline = (params?: Parameters<typeof obs.fetchTimeline>[0]) =>
  useQuery({
    queryKey: ['observatory', 'timeline', params],
    queryFn: () => obs.fetchTimeline(params),
  });
