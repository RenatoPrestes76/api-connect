import { api } from './api-client';
import type {
  OperationsOverview,
  TenantHealth,
  OperationsAlert,
  OperationsEvent,
  OperationsMetric,
  SlaRecord,
  ActionResult,
  AlertSeverity,
  SlaPeriod,
  ActionType,
} from '../types/operations';

export const operationsService = {
  getOverview(): Promise<OperationsOverview> {
    return api.get('/api/v1/operations/overview');
  },

  getHealth(tenantId?: string): Promise<{ total: number; tenants: TenantHealth[] }> {
    const qs = tenantId ? `?tenantId=${tenantId}` : '';
    return api.get(`/api/v1/operations/health${qs}`);
  },

  getAlerts(filters?: {
    tenantId?: string;
    severity?: AlertSeverity;
    resolved?: boolean;
  }): Promise<{ total: number; alerts: OperationsAlert[] }> {
    const params = new URLSearchParams();
    if (filters?.tenantId) params.set('tenantId', filters.tenantId);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.resolved !== undefined) params.set('resolved', String(filters.resolved));
    const qs = params.toString() ? `?${params}` : '';
    return api.get(`/api/v1/operations/alerts${qs}`);
  },

  resolveAlert(id: string): Promise<OperationsAlert> {
    return api.patch(`/api/v1/operations/alerts/${id}`);
  },

  getEvents(
    tenantId?: string,
    limit?: number
  ): Promise<{ total: number; events: OperationsEvent[] }> {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params}` : '';
    return api.get(`/api/v1/operations/events${qs}`);
  },

  getMetrics(tenantId?: string): Promise<any> {
    const qs = tenantId ? `?tenantId=${tenantId}` : '';
    return api.get(`/api/v1/operations/metrics${qs}`);
  },

  getSla(
    period?: SlaPeriod,
    tenantId?: string
  ): Promise<{
    period: SlaPeriod;
    total: number;
    compliant: number;
    nonCompliant: number;
    records: SlaRecord[];
  }> {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (tenantId) params.set('tenantId', tenantId);
    const qs = params.toString() ? `?${params}` : '';
    return api.get(`/api/v1/operations/sla${qs}`);
  },

  runAction(action: ActionType, payload: Record<string, unknown>): Promise<ActionResult> {
    return api.post(`/api/v1/operations/actions/${action}`, payload);
  },
};
