import { api } from '@/services/api-client';
import { portalFetch } from '@/lib/portal-fetch';
import type {
  PortalDashboard,
  SupportTicket,
  SupportSeverity,
  SupportCategory,
  SupportStatus,
  PortalConnector,
  PortalUser,
  OnboardingStep,
  OrgRole,
  Organization,
  Environment,
  EnvironmentKind,
  OrgInvite,
  OrgAuditEntry,
  ConnectorCatalogCategory,
  ConnectorCatalogEntry,
  ConnectorCatalogDetail,
} from '@/types/portal';

export interface PortalSessionUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: OrgRole;
}

const h = (tenantId?: string): Record<string, string> | undefined =>
  tenantId ? { 'x-tenant-id': tenantId } : undefined;

export const portalService = {
  getDashboard: (tenantId?: string) =>
    api.get<PortalDashboard>('/api/v1/portal/dashboard', undefined, h(tenantId)),

  completeOnboardingStep: (step: OnboardingStep, tenantId?: string) =>
    api.post<{ progress: PortalDashboard['onboarding'] }>(
      '/api/v1/portal/onboarding/complete-step',
      { step },
      undefined,
      h(tenantId)
    ),

  // Support
  listTickets: (params?: { status?: SupportStatus; tenantId?: string }) =>
    api.get<{ total: number; tickets: SupportTicket[] }>(
      `/api/v1/portal/support${params?.status ? `?status=${params.status}` : ''}`,
      undefined,
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
  ) => api.post<SupportTicket>('/api/v1/portal/support', data, undefined, h(tenantId)),

  updateTicketStatus: (id: string, status: SupportStatus) =>
    api.put<SupportTicket>(`/api/v1/portal/support/${id}/status`, { status }),

  // Connectors
  listConnectors: (tenantId?: string) =>
    api.get<{
      summary: { total: number; healthy: number; degraded: number; error: number };
      connectors: PortalConnector[];
    }>('/api/v1/portal/connectors', undefined, h(tenantId)),

  // ─── Organization identity (Sprint 46.4) ─────────────────────────────────
  // Everything below goes through the same-origin /api/portal/* Next proxy
  // (portalFetch), not the api-client — it needs the httpOnly session cookie.

  register: (data: {
    name: string;
    razaoSocial: string;
    cnpj: string;
    internalCode: string;
    plan?: Organization['plan'];
    owner: { name: string; email: string; password: string };
  }) =>
    portalFetch<{ organization: Organization; user: PortalSessionUser }>('/auth/register', {
      method: 'POST',
      body: data,
    }),

  login: (data: { email: string; password: string }) =>
    portalFetch<{ user: PortalSessionUser }>('/auth/login', { method: 'POST', body: data }),

  logout: () => portalFetch<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => portalFetch<{ user: PortalSessionUser; permissions: string[] }>('/auth/me'),

  getOrganization: () => portalFetch<Organization>('/organization'),

  updateOrganization: (
    patch: Partial<
      Pick<Organization, 'name' | 'razaoSocial' | 'cnpj' | 'internalCode' | 'status' | 'plan'>
    >
  ) => portalFetch<Organization>('/organization', { method: 'PATCH', body: patch }),

  listEnvironments: () =>
    portalFetch<{ total: number; environments: Environment[] }>('/environments'),

  createEnvironment: (data: {
    name: string;
    kind: EnvironmentKind;
    region?: string;
    timezone?: string;
  }) => portalFetch<Environment>('/environments', { method: 'POST', body: data }),

  deleteEnvironment: (id: string) =>
    portalFetch<{ deleted: boolean }>(`/environments/${id}`, { method: 'DELETE' }),

  listInvites: () => portalFetch<{ total: number; invites: OrgInvite[] }>('/invites'),

  getInvite: (token: string) => portalFetch<OrgInvite>(`/invites/${token}`),

  acceptInvite: (token: string, password: string) =>
    portalFetch<{ user: PortalSessionUser }>(`/invites/${token}/accept`, {
      method: 'POST',
      body: { password },
    }),

  getAuditLog: (limit?: number) =>
    portalFetch<{ total: number; entries: OrgAuditEntry[] }>(
      `/audit-log${limit ? `?limit=${limit}` : ''}`
    ),

  // Users
  listUsers: () => portalFetch<{ total: number; users: PortalUser[] }>('/users'),

  inviteUser: (data: { email: string; name: string; role: OrgRole }) =>
    portalFetch<{ invite: OrgInvite; token: string }>('/invites', { method: 'POST', body: data }),

  updateUserRole: (id: string, role: OrgRole) =>
    portalFetch<PortalUser>(`/users/${id}/role`, { method: 'PUT', body: { role } }),

  removeUser: (id: string) =>
    portalFetch<{ deleted: boolean }>(`/users/${id}`, { method: 'DELETE' }),

  // Connector catalog (Sprint 46.6, read-only browse)
  listConnectorCatalog: (category?: ConnectorCatalogCategory) =>
    portalFetch<{ total: number; connectors: ConnectorCatalogEntry[] }>(
      `/connector-catalog${category ? `?category=${category}` : ''}`
    ),

  getConnectorCatalogEntry: (id: string) =>
    portalFetch<ConnectorCatalogDetail>(`/connector-catalog/${id}`),
};
