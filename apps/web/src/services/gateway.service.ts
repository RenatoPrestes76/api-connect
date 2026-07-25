import { portalFetch } from '@/lib/portal-fetch';
import type {
  ApiKeyDTO,
  RateLimitRule,
  RateLimitWindow,
  ApiLogEntry,
  GatewaySettings,
  LogLevel,
} from '@/types/gateway';
import type { OrgRole } from '@/types/portal';

export const gatewayService = {
  // ─── API Keys ───────────────────────────────────────────────────────────
  listApiKeys: () => portalFetch<{ total: number; keys: ApiKeyDTO[] }>('/gateway/api-keys'),

  createApiKey: (data: { name: string; environmentId: string; role: OrgRole }) =>
    portalFetch<ApiKeyDTO>('/gateway/api-keys', { method: 'POST', body: data }),

  regenerateApiKey: (id: string) =>
    portalFetch<ApiKeyDTO>(`/gateway/api-keys/${id}/regenerate`, { method: 'POST' }),

  revokeApiKey: (id: string) =>
    portalFetch<ApiKeyDTO>(`/gateway/api-keys/${id}/revoke`, { method: 'POST' }),

  // ─── Rate limits ────────────────────────────────────────────────────────
  listRateLimitRules: () =>
    portalFetch<{ defaults: Record<RateLimitWindow, number>; rules: RateLimitRule[] }>(
      '/gateway/rate-limits'
    ),

  upsertRateLimitRule: (data: { window: RateLimitWindow; limit: number }) =>
    portalFetch<RateLimitRule>('/gateway/rate-limits', { method: 'POST', body: data }),

  deleteRateLimitRule: (id: string) =>
    portalFetch<{ deleted: boolean }>(`/gateway/rate-limits/${id}`, { method: 'DELETE' }),

  // ─── Gateway settings (per environment) ────────────────────────────────
  getSettings: (environmentId: string) =>
    portalFetch<GatewaySettings>(`/gateway/settings/${environmentId}`),

  updateSettings: (
    environmentId: string,
    patch: Partial<{
      corsAllowedOrigins: string[];
      logLevel: LogLevel;
      timeoutMs: number;
      internalBaseUrl: string;
    }>
  ) =>
    portalFetch<GatewaySettings>(`/gateway/settings/${environmentId}`, {
      method: 'PATCH',
      body: patch,
    }),

  // ─── Logs ───────────────────────────────────────────────────────────────
  listLogs: (limit?: number) =>
    portalFetch<{ total: number; entries: ApiLogEntry[] }>(
      `/gateway/logs${limit ? `?limit=${limit}` : ''}`
    ),
};
