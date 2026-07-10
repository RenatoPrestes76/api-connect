import { api } from './api-client';
import type {
  ExecutiveDashboard,
  SystemHealth,
  MetricSample,
  HeatmapCell,
  AlertRule,
  Alert,
  Incident,
  IncidentStatus,
  AuditLog,
  SLADefinition,
  SLAEvent,
  TimelineEvent,
  PaginatedResponse,
} from '@/types/observatory';

const BASE = '/api/v1/observatory';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const fetchDashboard = (): Promise<ExecutiveDashboard> => api.get(`${BASE}/dashboard`);
export const fetchHealth = (): Promise<SystemHealth> => api.get(`${BASE}/health`);

// ─── Metrics ──────────────────────────────────────────────────────────────────

export const fetchMetrics = (limit = 288): Promise<{ items: MetricSample[]; total: number }> =>
  api.get(`${BASE}/metrics?limit=${limit}`);

export const fetchHeatmap = (): Promise<{ cells: HeatmapCell[] }> => api.get(`${BASE}/heatmap`);

// ─── Alert Rules ──────────────────────────────────────────────────────────────

export const fetchAlertRules = (): Promise<AlertRule[]> => api.get(`${BASE}/alert-rules`);
export const fetchAlertRule = (id: string): Promise<AlertRule> =>
  api.get(`${BASE}/alert-rules/${id}`);
export const createAlertRule = (body: Partial<AlertRule>): Promise<AlertRule> =>
  api.post(`${BASE}/alert-rules`, body);
export const updateAlertRule = (id: string, body: Partial<AlertRule>): Promise<AlertRule> =>
  api.put(`${BASE}/alert-rules/${id}`, body);
export const deleteAlertRule = (id: string): Promise<void> =>
  api.delete(`${BASE}/alert-rules/${id}`);

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const fetchAlerts = (params?: {
  severity?: string;
  acknowledged?: boolean;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<Alert>> => {
  const qs = new URLSearchParams();
  if (params?.severity !== undefined) qs.set('severity', params.severity);
  if (params?.acknowledged !== undefined) qs.set('acknowledged', String(params.acknowledged));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  return api.get(`${BASE}/alerts?${qs}`);
};

export const acknowledgeAlert = (id: string): Promise<Alert> =>
  api.post(`${BASE}/alerts/${id}/acknowledge`, {});

// ─── Incidents ────────────────────────────────────────────────────────────────

export const fetchIncidents = (params?: {
  status?: IncidentStatus;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<Incident>> => {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  return api.get(`${BASE}/incidents?${qs}`);
};

export const fetchIncident = (id: string): Promise<Incident> => api.get(`${BASE}/incidents/${id}`);

export const createIncident = (body: {
  title: string;
  description?: string;
  severity: string;
}): Promise<Incident> => api.post(`${BASE}/incidents`, body);

export const updateIncidentStatus = (
  id: string,
  status: IncidentStatus,
  message?: string
): Promise<Incident> => api.post(`${BASE}/incidents/${id}/status`, { status, message });

// ─── Audit ────────────────────────────────────────────────────────────────────

export const fetchAuditLogs = (params?: {
  actor?: string;
  action?: string;
  resourceType?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}): Promise<PaginatedResponse<AuditLog>> => {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
  }
  return api.get(`${BASE}/audit?${qs}`);
};

// ─── SLA ──────────────────────────────────────────────────────────────────────

export const fetchSLAs = (): Promise<SLADefinition[]> => api.get(`${BASE}/sla`);
export const fetchSLA = (id: string): Promise<SLADefinition> => api.get(`${BASE}/sla/${id}`);
export const createSLA = (body: Partial<SLADefinition>): Promise<SLADefinition> =>
  api.post(`${BASE}/sla`, body);
export const updateSLA = (id: string, body: Partial<SLADefinition>): Promise<SLADefinition> =>
  api.put(`${BASE}/sla/${id}`, body);

export const fetchSLAEvents = (params?: {
  slaId?: string;
  breached?: boolean;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<SLAEvent>> => {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
  }
  return api.get(`${BASE}/sla-events?${qs}`);
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

export const fetchTimeline = (params?: {
  executionId?: string;
  workflowId?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<TimelineEvent>> => {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
  }
  return api.get(`${BASE}/timeline?${qs}`);
};
