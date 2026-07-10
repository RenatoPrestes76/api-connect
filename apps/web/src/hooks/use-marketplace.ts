'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConnectors,
  fetchConnector,
  fetchCategories,
  searchConnectors,
  fetchInstalled,
  fetchUpdates,
  installConnector,
  uninstallConnector,
  updateConnector,
  enableConnector,
  disableConnector,
  publishConnector,
  fetchMarketplaceAudit,
  verifyConnector,
} from '@/services/marketplace.service';
import type { ListConnectorsParams, PublishPayload } from '@/services/marketplace.service';

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const useConnectors = (params: ListConnectorsParams = {}) =>
  useQuery({
    queryKey: ['marketplace', 'connectors', params],
    queryFn: () => fetchConnectors(params),
  });

export const useConnector = (id: string) =>
  useQuery({
    queryKey: ['marketplace', 'connector', id],
    queryFn: () => fetchConnector(id),
    enabled: !!id,
  });

export const useCategories = () =>
  useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: fetchCategories,
  });

export const useConnectorSearch = (q: string) =>
  useQuery({
    queryKey: ['marketplace', 'search', q],
    queryFn: () => searchConnectors(q),
    enabled: q.length > 1,
  });

export const useVerifyConnector = (id: string) =>
  useQuery({
    queryKey: ['marketplace', 'verify', id],
    queryFn: () => verifyConnector(id),
    enabled: !!id,
  });

// ─── Installations ────────────────────────────────────────────────────────────

export const useInstalled = () =>
  useQuery({
    queryKey: ['marketplace', 'installed'],
    queryFn: fetchInstalled,
  });

export const useUpdates = () =>
  useQuery({
    queryKey: ['marketplace', 'updates'],
    queryFn: fetchUpdates,
  });

export const useInstallConnector = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectorId, version }: { connectorId: string; version?: string }) =>
      installConnector(connectorId, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
};

export const useUninstallConnector = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (installationId: string) => uninstallConnector(installationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
};

export const useUpdateConnector = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ installationId, version }: { installationId: string; version?: string }) =>
      updateConnector(installationId, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
};

export const useEnableConnector = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (installationId: string) => enableConnector(installationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace', 'installed'] });
    },
  });
};

export const useDisableConnector = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (installationId: string) => disableConnector(installationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace', 'installed'] });
    },
  });
};

// ─── Developer ────────────────────────────────────────────────────────────────

export const usePublishConnector = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PublishPayload) => publishConnector(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace', 'audit'] });
    },
  });
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export const useMarketplaceAudit = (params: { connectorId?: string; action?: string } = {}) =>
  useQuery({
    queryKey: ['marketplace', 'audit', params],
    queryFn: () => fetchMarketplaceAudit(params),
  });
