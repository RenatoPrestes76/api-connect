'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalService } from '@/services/portal.service';
import type {
  SupportSeverity,
  SupportCategory,
  SupportStatus,
  OrgRole,
  Organization,
  EnvironmentKind,
  OnboardingStep,
} from '@/types/portal';

export function usePortalDashboard(tenantId?: string) {
  return useQuery({
    queryKey: ['portal', 'dashboard', tenantId],
    queryFn: () => portalService.getDashboard(tenantId),
    refetchInterval: 30_000,
  });
}

export function useSupportTickets(params?: { status?: SupportStatus; tenantId?: string }) {
  return useQuery({
    queryKey: ['portal', 'support', params],
    queryFn: () => portalService.listTickets(params),
  });
}

export function useCreateTicket(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description: string;
      severity: SupportSeverity;
      category: SupportCategory;
    }) => portalService.createTicket(data, tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'support'] }),
  });
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportStatus }) =>
      portalService.updateTicketStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'support'] }),
  });
}

export function useApiKeys(tenantId?: string) {
  return useQuery({
    queryKey: ['portal', 'api-keys', tenantId],
    queryFn: () => portalService.listApiKeys(tenantId),
  });
}

export function useCreateApiKey(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; scopes: string[]; expiresAt?: string }) =>
      portalService.createApiKey(data, tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalService.revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'api-keys'] }),
  });
}

export function usePortalConnectors(tenantId?: string) {
  return useQuery({
    queryKey: ['portal', 'connectors', tenantId],
    queryFn: () => portalService.listConnectors(tenantId),
    refetchInterval: 30_000,
  });
}

export function usePortalUsers() {
  return useQuery({
    queryKey: ['portal', 'users'],
    queryFn: () => portalService.listUsers(),
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; name: string; role: OrgRole }) =>
      portalService.inviteUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal', 'users'] });
      qc.invalidateQueries({ queryKey: ['portal', 'invites'] });
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: OrgRole }) =>
      portalService.updateUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'users'] }),
  });
}

export function useRemoveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalService.removeUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'users'] }),
  });
}

// ─── Organization identity (Sprint 46.4) ─────────────────────────────────────

export function usePortalSession() {
  return useQuery({
    queryKey: ['portal', 'session'],
    queryFn: () => portalService.me(),
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => portalService.login(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'session'] }),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      razaoSocial: string;
      cnpj: string;
      internalCode: string;
      plan?: Organization['plan'];
      owner: { name: string; email: string; password: string };
    }) => portalService.register(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'session'] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => portalService.logout(),
    onSuccess: () => qc.clear(),
  });
}

export function useOrganization() {
  return useQuery({
    queryKey: ['portal', 'organization'],
    queryFn: () => portalService.getOrganization(),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Partial<
        Pick<Organization, 'name' | 'razaoSocial' | 'cnpj' | 'internalCode' | 'status' | 'plan'>
      >
    ) => portalService.updateOrganization(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'organization'] }),
  });
}

export function useEnvironments() {
  return useQuery({
    queryKey: ['portal', 'environments'],
    queryFn: () => portalService.listEnvironments(),
  });
}

export function useCreateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      kind: EnvironmentKind;
      region?: string;
      timezone?: string;
    }) => portalService.createEnvironment(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'environments'] }),
  });
}

export function useDeleteEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalService.deleteEnvironment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'environments'] }),
  });
}

export function useInvites() {
  return useQuery({
    queryKey: ['portal', 'invites'],
    queryFn: () => portalService.listInvites(),
  });
}

export function useInvite(token: string | null) {
  return useQuery({
    queryKey: ['portal', 'invite', token],
    queryFn: () => portalService.getInvite(token as string),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      portalService.acceptInvite(token, password),
  });
}

export function useAuditLog(limit?: number) {
  return useQuery({
    queryKey: ['portal', 'audit-log', limit],
    queryFn: () => portalService.getAuditLog(limit),
  });
}

export function useCompleteOnboardingStep(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (step: OnboardingStep) => portalService.completeOnboardingStep(step, tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'dashboard'] }),
  });
}
