// ─── Categories & Permissions ─────────────────────────────────────────────────

export type ConnectorCategory =
  | 'ERP'
  | 'CRM'
  | 'E-commerce'
  | 'Marketplace'
  | 'WMS'
  | 'Banco de dados'
  | 'APIs REST'
  | 'GraphQL'
  | 'Mensageria'
  | 'Armazenamento em nuvem';

export const CONNECTOR_CATEGORIES: ConnectorCategory[] = [
  'ERP',
  'CRM',
  'E-commerce',
  'Marketplace',
  'WMS',
  'Banco de dados',
  'APIs REST',
  'GraphQL',
  'Mensageria',
  'Armazenamento em nuvem',
];

export type ConnectorPermission =
  | 'read:data'
  | 'write:data'
  | 'execute:workflows'
  | 'access:credentials'
  | 'access:network'
  | 'read:audit'
  | 'write:audit';

export type ConnectorStatus =
  | 'available'
  | 'installed'
  | 'update-available'
  | 'deprecated'
  | 'pending-review';

export type MarketplaceAction =
  | 'install'
  | 'uninstall'
  | 'update'
  | 'enable'
  | 'disable'
  | 'publish';

// ─── Manifest & Catalog ───────────────────────────────────────────────────────

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: ConnectorCategory;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  compatibility: { atlasVersion: string; nodeVersion: string };
  permissions: ConnectorPermission[];
  resourceLimits: { cpuCores: number; memoryMb: number };
}

export interface ConnectorVersion {
  version: string;
  releasedAt: string;
  changelog: string;
  breaking: boolean;
}

export interface ConnectorReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface MarketplaceConnector {
  manifest: ConnectorManifest;
  status: ConnectorStatus;
  publishedAt: string;
  updatedAt: string;
  downloads: number;
  rating: number;
  reviewCount: number;
  reviews: ConnectorReview[];
  versions: ConnectorVersion[];
  checksum: string;
  signature: string;
  verified: boolean;
  featured: boolean;
  installedVersion?: string;
  installationId?: string;
}

// ─── Installation ─────────────────────────────────────────────────────────────

export interface ConnectorInstallation {
  id: string;
  connectorId: string;
  connectorName: string;
  version: string;
  installedAt: string;
  updatedAt: string;
  enabled: boolean;
  sandboxId: string;
  resourceUsage: { cpuCores: number; memoryMb: number };
  permissions: ConnectorPermission[];
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface MarketplaceAuditLog {
  id: string;
  action: MarketplaceAction;
  connectorId: string;
  connectorName: string;
  version?: string;
  actor: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ConnectorListResponse {
  total: number;
  offset: number;
  limit: number;
  items: MarketplaceConnector[];
}

export interface InstallationListResponse {
  total: number;
  items: ConnectorInstallation[];
}

export interface UpdateAvailableItem {
  installation: ConnectorInstallation;
  latestVersion: string;
}

export interface UpdateListResponse {
  total: number;
  items: UpdateAvailableItem[];
}

export interface AuditListResponse {
  total: number;
  offset: number;
  limit: number;
  items: MarketplaceAuditLog[];
}

export interface VerificationResult {
  valid: boolean;
  checksum: string;
  message: string;
}

export interface CategoriesResponse {
  categories: ConnectorCategory[];
  counts: Record<string, number>;
}

export interface PublishResponse {
  status: string;
  connectorId: string;
  version: string;
  message: string;
  submittedAt: string;
}
