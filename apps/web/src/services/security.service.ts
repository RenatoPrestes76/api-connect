import { api } from './api-client';

const BASE = '/api/v1/security';

const q = (tenantId: string) => `?tenantId=${tenantId}`;

// ─── Secrets ──────────────────────────────────────────────────────────────────

export const listSecrets = (tenantId: string) => api.get(`${BASE}/secrets${q(tenantId)}`);

export const getSecret = (id: string) => api.get(`${BASE}/secrets/${id}`);

export const decryptSecret = (id: string) => api.post(`${BASE}/secrets/${id}/decrypt`);

export const createSecret = (tenantId: string, data: Record<string, unknown>) =>
  api.post(`${BASE}/secrets${q(tenantId)}`, data);

export const rotateSecret = (id: string, value: string) =>
  api.post(`${BASE}/secrets/${id}/rotate`, { value });

export const deleteSecret = (id: string) => api.delete(`${BASE}/secrets/${id}`);

// ─── MFA ──────────────────────────────────────────────────────────────────────

export const getMfaStatus = (tenantId: string, userId?: string) => {
  const qs = userId ? `${q(tenantId)}&userId=${encodeURIComponent(userId)}` : q(tenantId);
  return api.get(`${BASE}/mfa/status${qs}`);
};

export const setupMfa = (tenantId: string, userId?: string) =>
  api.post(`${BASE}/mfa/setup${q(tenantId)}`, userId ? { userId } : {});

export const verifyMfaToken = (tenantId: string, userId: string, token: string) =>
  api.post(`${BASE}/mfa/verify${q(tenantId)}`, { userId, token });

// ─── SSO ──────────────────────────────────────────────────────────────────────

export const listSsoProviders = (tenantId: string) => api.get(`${BASE}/sso${q(tenantId)}`);

export const initiateSso = (providerId: string) => api.post(`${BASE}/sso/${providerId}/initiate`);

// ─── Policies ─────────────────────────────────────────────────────────────────

export const listPolicies = (tenantId: string) => api.get(`${BASE}/policies${q(tenantId)}`);

export const evaluatePolicies = (tenantId: string, context: Record<string, unknown>) =>
  api.post(`${BASE}/policies/evaluate${q(tenantId)}`, { context });

// ─── Audit ────────────────────────────────────────────────────────────────────

export const listAuditEntries = (tenantId: string, limit = 50, offset = 0) =>
  api.get(`${BASE}/audit${q(tenantId)}&limit=${limit}&offset=${offset}`);

export const verifyAuditChain = () => api.get(`${BASE}/audit/verify`);

export const exportAuditSiem = (tenantId: string) => api.post(`${BASE}/audit/export${q(tenantId)}`);

// ─── Compliance ───────────────────────────────────────────────────────────────

export const getCompliance = (framework?: string) => {
  const qs = framework ? `?framework=${framework}` : '';
  return api.get(`${BASE}/compliance${qs}`);
};

export const createDataRequest = (tenantId: string, data: Record<string, unknown>) =>
  api.post(`${BASE}/compliance/data-request${q(tenantId)}`, data);

// ─── Consent ──────────────────────────────────────────────────────────────────

export const listConsent = (tenantId: string) => api.get(`${BASE}/consent${q(tenantId)}`);

export const grantConsent = (tenantId: string, data: Record<string, unknown>) =>
  api.post(`${BASE}/consent${q(tenantId)}`, data);

// ─── Risk ─────────────────────────────────────────────────────────────────────

export const listRiskEvents = (tenantId: string, resolved?: boolean) => {
  const extra = resolved !== undefined ? `&resolved=${resolved}` : '';
  return api.get(`${BASE}/risk${q(tenantId)}${extra}`);
};

export const getRiskScore = (tenantId: string) => api.get(`${BASE}/risk/score/${tenantId}`);

// ─── Certificates ─────────────────────────────────────────────────────────────

export const listCertificates = (tenantId: string) => api.get(`${BASE}/certificates${q(tenantId)}`);

export const renewCertificate = (id: string) => api.post(`${BASE}/certificates/renew/${id}`);

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getSecurityDashboard = (tenantId: string) =>
  api.get(`${BASE}/dashboard${q(tenantId)}`);
