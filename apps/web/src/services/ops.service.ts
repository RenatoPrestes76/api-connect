import { api } from './api-client';

const BASE = '/api/v1/ops';

// ─── Health ──────────────────────────────────────────────────────────────────
export const getHealth = () => api.get(`${BASE}/health`);
export const getReadiness = () => api.get(`${BASE}/ready`);

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const getOpsDashboard = () => api.get(`${BASE}/dashboard`);

// ─── Queues ──────────────────────────────────────────────────────────────────
export const getQueues = (priority?: string) =>
  api.get(`${BASE}/queues${priority ? `?priority=${priority}` : ''}`);

export const enqueueJob = (data: {
  type: string;
  priority?: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}) => api.post(`${BASE}/queues/enqueue`, data);

export const retryDlqJob = (jobId: string) => api.post(`${BASE}/queues/dlq/retry`, { jobId });

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const listFeatureFlags = () => api.get(`${BASE}/feature-flags`);
export const getFeatureFlag = (id: string) => api.get(`${BASE}/feature-flags/${id}`);
export const createFeatureFlag = (data: Record<string, unknown>) =>
  api.post(`${BASE}/feature-flags`, data);
export const updateFeatureFlag = (id: string, data: Record<string, unknown>) =>
  api.put(`${BASE}/feature-flags/${id}`, data);
export const evaluateFeatureFlag = (id: string, context: Record<string, unknown>) =>
  api.post(`${BASE}/feature-flags/${id}/evaluate`, { context });
export const deleteFeatureFlag = (id: string) => api.delete(`${BASE}/feature-flags/${id}`);

// ─── SLO ─────────────────────────────────────────────────────────────────────
export const getSlos = () => api.get(`${BASE}/slo`);
export const getSlo = (id: string) => api.get(`${BASE}/slo/${id}`);

// ─── DR ──────────────────────────────────────────────────────────────────────
export const getDr = () => api.get(`${BASE}/dr`);
export const getDrBackups = () => api.get(`${BASE}/dr/backups`);
export const triggerBackup = (type: string) => api.post(`${BASE}/dr/backup/trigger`, { type });
export const runDrTest = (data: Record<string, unknown>) => api.post(`${BASE}/dr/test`, data);

// ─── Circuit Breakers ─────────────────────────────────────────────────────────
export const getCircuitBreakers = () => api.get(`${BASE}/circuit-breakers`);
export const resetCircuit = (name: string) =>
  api.post(`${BASE}/circuit-breakers/${name}/reset`, {});
