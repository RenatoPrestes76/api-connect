// ─── Categories ───────────────────────────────────────────────────────────────

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

// ─── Permissions ──────────────────────────────────────────────────────────────

export type ConnectorPermission =
  | 'read:data'
  | 'write:data'
  | 'execute:workflows'
  | 'access:credentials'
  | 'access:network'
  | 'read:audit'
  | 'write:audit';

// ─── Status ───────────────────────────────────────────────────────────────────

export type ConnectorStatus =
  | 'available'
  | 'installed'
  | 'update-available'
  | 'deprecated'
  | 'pending-review';

// ─── Manifest ─────────────────────────────────────────────────────────────────

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
  compatibility: {
    atlasVersion: string;
    nodeVersion: string;
  };
  permissions: ConnectorPermission[];
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
  };
}

// ─── Versions ─────────────────────────────────────────────────────────────────

export interface ConnectorVersion {
  version: string;
  releasedAt: string;
  changelog: string;
  breaking: boolean;
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export interface ConnectorReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// ─── Catalog Entry ────────────────────────────────────────────────────────────

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
  resourceUsage: {
    cpuCores: number;
    memoryMb: number;
  };
  permissions: ConnectorPermission[];
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export type MarketplaceAction =
  | 'install'
  | 'uninstall'
  | 'update'
  | 'enable'
  | 'disable'
  | 'publish';

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
