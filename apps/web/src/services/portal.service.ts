import { api } from '@/services/api-client';
import type {
  PortalDashboard,
  SupportTicket,
  SupportSeverity,
  SupportCategory,
  SupportStatus,
  ApiKey,
  PortalConnector,
  PortalUser,
  UserRole,
  OnboardingStep,
} from '@/types/portal';

const h = (tenantId?: string) => (tenantId ? { headers: { 'x-tenant-id': tenantId } } : {});

export const portalService = {
  getDashboard: (tenantId?: string) =>
    api.get<PortalDashboard>('/api/v1/portal/dashboard', h(tenantId)),

  completeOnboardingStep: (step: OnboardingStep, tenantId?: string) =>
    api.post<{ progress: PortalDashboard['onboarding'] }>(
      '/api/v1/portal/onboarding/complete-step',
      { step },
      h(tenantId)
    ),

  // Support
  listTickets: (params?: { status?: SupportStatus; tenantId?: string }) =>
    api.get<{ total: number; tickets: SupportTicket[] }>(
      `/api/v1/portal/support${params?.status ? `?status=${params.status}` : ''}`,
      h(params?.tenantId)
    ),

  getTicket: (id: string) => api.get<SupportTicket>(`/api/v1/portal/support/${id}`),

  createTicket: (
    data: {
      title: string;
      description: string;
      severity: SupportSeverity;
      category: SupportCategory;
    },
    tenantId?: string
  ) => api.post<SupportTicket>('/api/v1/portal/support', data, h(tenantId)),

  updateTicketStatus: (id: string, status: SupportStatus) =>
    api.put<SupportTicket>(`/api/v1/portal/support/${id}/status`, { status }),

  // API Keys
  listApiKeys: (tenantId?: string) =>
    api.get<{ total: number; keys: ApiKey[] }>('/api/v1/portal/api-keys', h(tenantId)),

  createApiKey: (data: { name: string; scopes: string[]; expiresAt?: string }, tenantId?: string) =>
    api.post<ApiKey>('/api/v1/portal/api-keys', data, h(tenantId)),

  revokeApiKey: (id: string) =>
    api.post<{ revoked: boolean }>(`/api/v1/portal/api-keys/${id}/revoke`),

  deleteApiKey: (id: string) => api.delete<{ deleted: boolean }>(`/api/v1/portal/api-keys/${id}`),

  // Connectors
  listConnectors: (tenantId?: string) =>
    api.get<{
      summary: { total: number; healthy: number; degraded: number; error: number };
      connectors: PortalConnector[];
    }>('/api/v1/portal/connectors', h(tenantId)),

  // Users
  listUsers: (tenantId?: string) =>
    api.get<{ total: number; users: PortalUser[] }>('/api/v1/portal/users', h(tenantId)),

  inviteUser: (data: { email: string; name: string; role: UserRole }, tenantId?: string) =>
    api.post<PortalUser>('/api/v1/portal/users/invite', data, h(tenantId)),

  updateUserRole: (id: string, role: UserRole) =>
    api.put<PortalUser>(`/api/v1/portal/users/${id}/role`, { role }),

  removeUser: (id: string) => api.delete<{ deleted: boolean }>(`/api/v1/portal/users/${id}`),
};
