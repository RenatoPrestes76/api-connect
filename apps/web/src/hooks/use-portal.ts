'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalService } from '@/services/portal.service';
import type {
  SupportSeverity,
  SupportCategory,
  SupportStatus,
  UserRole,
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

export function usePortalUsers(tenantId?: string) {
  return useQuery({
    queryKey: ['portal', 'users', tenantId],
    queryFn: () => portalService.listUsers(tenantId),
  });
}

export function useInviteUser(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; name: string; role: UserRole }) =>
      portalService.inviteUser(data, tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'users'] }),
  });
}

export function useCompleteOnboardingStep(tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (step: OnboardingStep) => portalService.completeOnboardingStep(step, tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'dashboard'] }),
  });
}
