import { api } from './api-client';
import type {
  GovernancePolicy,
  GovernanceOverview,
  AuditLog,
  ComplianceStatusResult,
  ComplianceEvidence,
  Risk,
  ChangeRequest,
  CreatePolicyPayload,
  CreateRiskPayload,
  CreateChangePayload,
  ApproveChangePayload,
  RejectChangePayload,
} from '@/types/governance';

export const governanceService = {
  // Policies
  getPolicies: (params?: {
    category?: string;
    enabled?: boolean;
  }): Promise<{ total: number; policies: GovernancePolicy[] }> => {
    const qs = new URLSearchParams();
    if (params?.category !== undefined) qs.set('category', params.category);
    if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled));
    const q = qs.toString() ? `?${qs}` : '';
    return api.get(`/api/v1/governance/policies${q}`);
  },
  createPolicy: (payload: CreatePolicyPayload): Promise<GovernancePolicy> =>
    api.post('/api/v1/governance/policies', payload),

  // Audit
  getAuditLogs: (params?: {
    actor?: string;
    action?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<{ total: number; logs: AuditLog[] }> => {
    const qs = new URLSearchParams();
    if (params?.actor) qs.set('actor', params.actor);
    if (params?.action) qs.set('action', params.action);
    if (params?.tenantId) qs.set('tenantId', params.tenantId);
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString() ? `?${qs}` : '';
    return api.get(`/api/v1/audit/logs${q}`);
  },
  exportAudit: (format: 'json' | 'csv' | 'pdf'): Promise<unknown> =>
    api.get(`/api/v1/audit/export?format=${format}`),

  // Compliance
  getComplianceStatus: (): Promise<ComplianceStatusResult> => api.get('/api/v1/compliance/status'),
  getEvidence: (params?: {
    framework?: string;
    status?: string;
  }): Promise<{ total: number; evidence: ComplianceEvidence[] }> => {
    const qs = new URLSearchParams();
    if (params?.framework) qs.set('framework', params.framework);
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString() ? `?${qs}` : '';
    return api.get(`/api/v1/compliance/evidence${q}`);
  },

  // Risk
  getRisks: (params?: {
    category?: string;
    status?: string;
    severity?: string;
  }): Promise<{ total: number; risks: Risk[] }> => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.status) qs.set('status', params.status);
    if (params?.severity) qs.set('severity', params.severity);
    const q = qs.toString() ? `?${qs}` : '';
    return api.get(`/api/v1/risk${q}`);
  },
  createRisk: (payload: CreateRiskPayload): Promise<Risk> => api.post('/api/v1/risk', payload),

  // Changes
  getChanges: (params?: {
    status?: string;
    type?: string;
    priority?: string;
  }): Promise<{ total: number; changes: ChangeRequest[] }> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.type) qs.set('type', params.type);
    if (params?.priority) qs.set('priority', params.priority);
    const q = qs.toString() ? `?${qs}` : '';
    return api.get(`/api/v1/changes${q}`);
  },
  createChange: (payload: CreateChangePayload): Promise<ChangeRequest> =>
    api.post('/api/v1/changes', payload),
  approveChange: (id: string, payload: ApproveChangePayload): Promise<ChangeRequest> =>
    api.post(`/api/v1/changes/${id}/approve`, payload),
  rejectChange: (id: string, payload: RejectChangePayload): Promise<ChangeRequest> =>
    api.post(`/api/v1/changes/${id}/reject`, payload),
};
