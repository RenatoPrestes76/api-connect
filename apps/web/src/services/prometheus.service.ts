import type {
  TelemetryOverview,
  Trace,
  ServiceMap,
  ExecutiveDashboard,
  OperationsDashboard,
  AIDashboard,
  ConnectorMetric,
  Anomaly,
  Incident,
  PredictiveAlert,
  AIRecommendation,
  SelfHealingRule,
  SLOTarget,
  CapacityPlan,
  CostReport,
  Runbook,
  CopilotResponse,
  DashboardType,
} from '@/types/prometheus';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message ?? res.statusText);
  }
  return res.json();
}

export const prometheusService = {
  getTelemetryOverview: (): Promise<TelemetryOverview> => req(`${BASE}/telemetry/overview`),

  getTraces: (params?: {
    service?: string;
    status?: string;
    limit?: number;
  }): Promise<{ traces: Trace[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.service) q.set('service', params.service);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    return req(`${BASE}/telemetry/traces?${q}`);
  },

  getTraceById: (id: string): Promise<Trace> => req(`${BASE}/telemetry/traces/${id}`),

  getServiceMap: (): Promise<ServiceMap> => req(`${BASE}/telemetry/service-map`),

  getDashboard: (
    type: DashboardType
  ): Promise<ExecutiveDashboard | OperationsDashboard | AIDashboard | ConnectorMetric[]> =>
    req(`${BASE}/prometheus/dashboards/${type}`),

  getAnomalies: (params?: {
    severity?: string;
    status?: string;
  }): Promise<{ anomalies: Anomaly[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    return req(`${BASE}/prometheus/anomalies?${q}`);
  },

  getIncidents: (params?: {
    status?: string;
    severity?: string;
  }): Promise<{ incidents: Incident[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.severity) q.set('severity', params.severity);
    return req(`${BASE}/prometheus/incidents?${q}`);
  },

  getIncidentTimeline: (
    id: string
  ): Promise<{ incidentId: string; timeline: Incident['timeline']; total: number }> =>
    req(`${BASE}/prometheus/incidents/${id}/timeline`),

  getIncidentRCA: (
    id: string
  ): Promise<{ incidentId: string; hypotheses: Incident['rca']; total: number }> =>
    req(`${BASE}/prometheus/incidents/${id}/rca`),

  resolveIncident: (id: string): Promise<Incident> =>
    req(`${BASE}/prometheus/incidents/${id}/resolve`, { method: 'POST' }),

  getPredictiveAlerts: (params?: {
    type?: string;
  }): Promise<{ alerts: PredictiveAlert[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    return req(`${BASE}/prometheus/alerts/predictive?${q}`);
  },

  getRecommendations: (params?: {
    category?: string;
    status?: string;
  }): Promise<{ recommendations: AIRecommendation[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.status) q.set('status', params.status);
    return req(`${BASE}/prometheus/recommendations?${q}`);
  },

  applyRecommendation: (id: string): Promise<AIRecommendation> =>
    req(`${BASE}/prometheus/recommendations/${id}/apply`, { method: 'POST' }),

  dismissRecommendation: (id: string): Promise<AIRecommendation> =>
    req(`${BASE}/prometheus/recommendations/${id}/dismiss`, { method: 'POST' }),

  getSelfHealingRules: (): Promise<{ rules: SelfHealingRule[]; total: number; enabled: number }> =>
    req(`${BASE}/prometheus/self-healing`),

  toggleSelfHealingRule: (id: string): Promise<SelfHealingRule> =>
    req(`${BASE}/prometheus/self-healing/${id}/toggle`, { method: 'POST' }),

  getSLOTargets: (params?: {
    tenantId?: string;
    status?: string;
  }): Promise<{ targets: SLOTarget[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.tenantId) q.set('tenantId', params.tenantId);
    if (params?.status) q.set('status', params.status);
    return req(`${BASE}/prometheus/slo?${q}`);
  },

  getCapacityPlan: (): Promise<CapacityPlan> => req(`${BASE}/prometheus/capacity`),

  getCostReport: (params?: { tenantId?: string }): Promise<CostReport> => {
    const q = new URLSearchParams();
    if (params?.tenantId) q.set('tenantId', params.tenantId);
    return req(`${BASE}/prometheus/costs?${q}`);
  },

  getRunbooks: (params?: {
    mode?: string;
    trigger?: string;
  }): Promise<{ runbooks: Runbook[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.mode) q.set('mode', params.mode);
    if (params?.trigger) q.set('trigger', params.trigger);
    return req(`${BASE}/prometheus/runbooks?${q}`);
  },

  getRunbookById: (id: string): Promise<Runbook> => req(`${BASE}/prometheus/runbooks/${id}`),

  executeRunbook: (id: string): Promise<Runbook> =>
    req(`${BASE}/prometheus/runbooks/${id}/execute`, { method: 'POST' }),

  queryCopilot: (question: string): Promise<CopilotResponse> =>
    req(`${BASE}/prometheus/copilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }),
};
