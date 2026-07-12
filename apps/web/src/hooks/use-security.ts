'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as securityService from '@/services/security.service';

const DEMO_TENANT = 'tenant-enterprise';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useSecurityDashboard(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'dashboard', tenantId],
    queryFn: () => securityService.getSecurityDashboard(tenantId),
  });
}

// ─── Secrets ──────────────────────────────────────────────────────────────────

export function useSecrets(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'secrets', tenantId],
    queryFn: () => securityService.listSecrets(tenantId),
  });
}

export function useDecryptSecret() {
  return useMutation({
    mutationFn: (id: string) => securityService.decryptSecret(id),
  });
}

export function useRotateSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      securityService.rotateSecret(id, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['security', 'secrets'] }),
  });
}

// ─── MFA ──────────────────────────────────────────────────────────────────────

export function useMfaStatus(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'mfa', tenantId],
    queryFn: () => securityService.getMfaStatus(tenantId),
  });
}

export function useSetupMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => securityService.setupMfa(tenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['security', 'mfa'] }),
  });
}

// ─── SSO ──────────────────────────────────────────────────────────────────────

export function useSsoProviders(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'sso', tenantId],
    queryFn: () => securityService.listSsoProviders(tenantId),
  });
}

// ─── Policies ─────────────────────────────────────────────────────────────────

export function usePolicies(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'policies', tenantId],
    queryFn: () => securityService.listPolicies(tenantId),
  });
}

export function useEvaluatePolicies() {
  return useMutation({
    mutationFn: ({ tenantId, context }: { tenantId: string; context: Record<string, unknown> }) =>
      securityService.evaluatePolicies(tenantId, context),
  });
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export function useAuditEntries(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'audit', tenantId],
    queryFn: () => securityService.listAuditEntries(tenantId, 50, 0),
  });
}

export function useVerifyAuditChain() {
  return useMutation({
    mutationFn: () => securityService.verifyAuditChain(),
  });
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export function useCompliance(framework?: string) {
  return useQuery({
    queryKey: ['security', 'compliance', framework],
    queryFn: () => securityService.getCompliance(framework),
  });
}

export function useCreateDataRequest() {
  return useMutation({
    mutationFn: ({ tenantId, data }: { tenantId: string; data: Record<string, unknown> }) =>
      securityService.createDataRequest(tenantId, data),
  });
}

// ─── Consent ──────────────────────────────────────────────────────────────────

export function useConsent(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'consent', tenantId],
    queryFn: () => securityService.listConsent(tenantId),
  });
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

export function useRiskEvents(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'risk', tenantId],
    queryFn: () => securityService.listRiskEvents(tenantId),
  });
}

export function useRiskScore(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'risk-score', tenantId],
    queryFn: () => securityService.getRiskScore(tenantId),
  });
}

// ─── Certificates ─────────────────────────────────────────────────────────────

export function useCertificates(tenantId = DEMO_TENANT) {
  return useQuery({
    queryKey: ['security', 'certificates', tenantId],
    queryFn: () => securityService.listCertificates(tenantId),
  });
}

export function useRenewCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => securityService.renewCertificate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['security', 'certificates'] }),
  });
}
