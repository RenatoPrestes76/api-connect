import { api } from './api-client';
import type {
  ConnectorListResponse,
  MarketplaceConnector,
  CategoriesResponse,
  InstallationListResponse,
  UpdateListResponse,
  ConnectorInstallation,
  AuditListResponse,
  VerificationResult,
  PublishResponse,
} from '@/types/marketplace';

const BASE = '/api/v1/marketplace';

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface ListConnectorsParams {
  q?: string;
  category?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

export const fetchConnectors = (
  params: ListConnectorsParams = {}
): Promise<ConnectorListResponse> => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.featured) qs.set('featured', 'true');
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get(`${BASE}/connectors${suffix}`);
};

export const fetchConnector = (id: string): Promise<MarketplaceConnector> =>
  api.get(`${BASE}/connectors/${id}`);

export const fetchCategories = (): Promise<CategoriesResponse> => api.get(`${BASE}/categories`);

export const searchConnectors = (
  q: string,
  limit = 10
): Promise<{ results: MarketplaceConnector[] }> =>
  api.get(`${BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}`);

export const verifyConnector = (id: string): Promise<VerificationResult> =>
  api.get(`${BASE}/connectors/${id}/verify`);

// ─── Installations ────────────────────────────────────────────────────────────

export const fetchInstalled = (): Promise<InstallationListResponse> => api.get(`${BASE}/installed`);

export const fetchUpdates = (): Promise<UpdateListResponse> => api.get(`${BASE}/updates`);

export const installConnector = (
  connectorId: string,
  version?: string
): Promise<ConnectorInstallation> => api.post(`${BASE}/install`, { connectorId, version });

export const uninstallConnector = (installationId: string): Promise<ConnectorInstallation> =>
  api.post(`${BASE}/uninstall`, { installationId });

export const updateConnector = (
  installationId: string,
  version?: string
): Promise<ConnectorInstallation> => api.post(`${BASE}/update`, { installationId, version });

export const enableConnector = (installationId: string): Promise<ConnectorInstallation> =>
  api.post(`${BASE}/enable`, { installationId });

export const disableConnector = (installationId: string): Promise<ConnectorInstallation> =>
  api.post(`${BASE}/disable`, { installationId });

// ─── Developer ────────────────────────────────────────────────────────────────

export interface PublishPayload {
  connectorId: string;
  name: string;
  version: string;
  description?: string;
  category?: string;
  author?: string;
}

export const publishConnector = (payload: PublishPayload): Promise<PublishResponse> =>
  api.post(`${BASE}/publish`, payload);

// ─── Audit ────────────────────────────────────────────────────────────────────

export const fetchMarketplaceAudit = (
  params: { connectorId?: string; action?: string; limit?: number; offset?: number } = {}
): Promise<AuditListResponse> => {
  const qs = new URLSearchParams();
  if (params.connectorId) qs.set('connectorId', params.connectorId);
  if (params.action) qs.set('action', params.action);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return api.get(`${BASE}/audit${suffix}`);
};
