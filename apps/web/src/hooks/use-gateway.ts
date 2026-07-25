'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gatewayService } from '@/services/gateway.service';
import type { RateLimitWindow, LogLevel } from '@/types/gateway';
import type { OrgRole } from '@/types/portal';

// ─── API Keys ─────────────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery({
    queryKey: ['gateway', 'api-keys'],
    queryFn: () => gatewayService.listApiKeys(),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; environmentId: string; role: OrgRole }) =>
      gatewayService.createApiKey(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateway', 'api-keys'] }),
  });
}

export function useRegenerateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gatewayService.regenerateApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateway', 'api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gatewayService.revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateway', 'api-keys'] }),
  });
}

// ─── Rate limits ────────────────────────────────────────────────────────────

export function useRateLimitRules() {
  return useQuery({
    queryKey: ['gateway', 'rate-limits'],
    queryFn: () => gatewayService.listRateLimitRules(),
  });
}

export function useUpsertRateLimitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { window: RateLimitWindow; limit: number }) =>
      gatewayService.upsertRateLimitRule(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateway', 'rate-limits'] }),
  });
}

export function useDeleteRateLimitRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gatewayService.deleteRateLimitRule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gateway', 'rate-limits'] }),
  });
}

// ─── Gateway settings ───────────────────────────────────────────────────────

export function useGatewaySettings(environmentId: string | null) {
  return useQuery({
    queryKey: ['gateway', 'settings', environmentId],
    queryFn: () => gatewayService.getSettings(environmentId as string),
    enabled: Boolean(environmentId),
  });
}

export function useUpdateGatewaySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      environmentId,
      patch,
    }: {
      environmentId: string;
      patch: Partial<{
        corsAllowedOrigins: string[];
        logLevel: LogLevel;
        timeoutMs: number;
        internalBaseUrl: string;
      }>;
    }) => gatewayService.updateSettings(environmentId, patch),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: ['gateway', 'settings', variables.environmentId] }),
  });
}

// ─── Logs ───────────────────────────────────────────────────────────────────

export function useApiLogs(limit?: number) {
  return useQuery({
    queryKey: ['gateway', 'logs', limit],
    queryFn: () => gatewayService.listLogs(limit),
    refetchInterval: 15_000,
  });
}
