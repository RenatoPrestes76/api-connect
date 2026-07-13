/**
 * @seltriva/templates
 * Atlas plugin project templates — complete ready-to-build scaffolds
 * for all 12 supported plugin types.
 *
 * @version 0.1.0
 */

import type { PluginType } from '@seltriva/plugin-sdk';

// ─── Template Registry ───────────────────────────────────────────────────────

export interface TemplateRegistry {
  list(): TemplateSummary[];
  get(id: string): PluginTemplate | null;
  getForType(type: PluginType): PluginTemplate[];
  getDefault(type: PluginType): PluginTemplate;
}

export interface TemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly type: PluginType;
  readonly description: string;
  readonly isDefault: boolean;
  readonly tags: string[];
}

export interface PluginTemplate {
  readonly id: string;
  readonly name: string;
  readonly type: PluginType;
  readonly description: string;
  readonly longDescription?: string;
  readonly tags: string[];
  readonly isDefault: boolean;
  readonly files: TemplateFile[];
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
  readonly scripts: Record<string, string>;
  readonly postInstall?: string[];
}

export interface TemplateFile {
  readonly path: string;
  readonly content: string;
  readonly executable?: boolean;
}

// ─── Template Catalog ────────────────────────────────────────────────────────

export const TEMPLATE_CATALOG: TemplateSummary[] = [
  {
    id: 'connector-basic',
    name: 'Basic Connector',
    type: 'connector',
    description: 'Minimal connector template with connect, disconnect, and test methods',
    isDefault: true,
    tags: ['connector', 'database', 'api'],
  },
  {
    id: 'connector-database',
    name: 'Database Connector',
    type: 'connector',
    description: 'Full database connector with connection pooling and schema discovery',
    isDefault: false,
    tags: ['connector', 'database', 'sql', 'nosql'],
  },
  {
    id: 'erp-profile-rest',
    name: 'ERP REST Profile',
    type: 'erp-profile',
    description: 'ERP profile for REST API systems with OAuth2 authentication',
    isDefault: true,
    tags: ['erp', 'rest', 'oauth2'],
  },
  {
    id: 'erp-profile-soap',
    name: 'ERP SOAP Profile',
    type: 'erp-profile',
    description: 'ERP profile for SOAP/XML-based legacy systems',
    isDefault: false,
    tags: ['erp', 'soap', 'xml', 'legacy'],
  },
  {
    id: 'ai-provider-openai',
    name: 'OpenAI-Compatible Provider',
    type: 'ai-provider',
    description: 'AI provider compatible with the OpenAI Chat Completions API',
    isDefault: true,
    tags: ['ai', 'llm', 'openai'],
  },
  {
    id: 'notification-webhook',
    name: 'Webhook Notification',
    type: 'notification',
    description: 'HTTP webhook notification channel with retry logic',
    isDefault: true,
    tags: ['notification', 'webhook', 'http'],
  },
  {
    id: 'notification-email',
    name: 'Email Notification',
    type: 'notification',
    description: 'SMTP/sendgrid email notification channel',
    isDefault: false,
    tags: ['notification', 'email', 'smtp'],
  },
  {
    id: 'storage-s3',
    name: 'S3-Compatible Storage',
    type: 'storage',
    description: 'Object storage plugin for S3-compatible backends',
    isDefault: true,
    tags: ['storage', 's3', 'object-storage'],
  },
  {
    id: 'transformation-field',
    name: 'Field Transformation',
    type: 'transformation',
    description: 'Transform individual fields with composable transformation rules',
    isDefault: true,
    tags: ['transformation', 'etl', 'data'],
  },
  {
    id: 'validator-schema',
    name: 'Schema Validator',
    type: 'validator',
    description: 'Validate records against JSON Schema with custom error messages',
    isDefault: true,
    tags: ['validator', 'schema', 'data-quality'],
  },
  {
    id: 'sync-strategy-incremental',
    name: 'Incremental Sync Strategy',
    type: 'sync-strategy',
    description: 'Cursor-based incremental synchronization strategy',
    isDefault: true,
    tags: ['sync', 'incremental', 'cursor'],
  },
  {
    id: 'sync-strategy-full',
    name: 'Full Sync Strategy',
    type: 'sync-strategy',
    description: 'Complete full-table synchronization with diff detection',
    isDefault: false,
    tags: ['sync', 'full', 'bulk'],
  },
  {
    id: 'mapping-strategy-auto',
    name: 'Auto Mapping Strategy',
    type: 'mapping-strategy',
    description: 'Automatically map fields by name with fuzzy matching',
    isDefault: true,
    tags: ['mapping', 'auto', 'fuzzy'],
  },
  {
    id: 'security-provider-oauth2',
    name: 'OAuth2 Security Provider',
    type: 'security-provider',
    description: 'OIDC/OAuth2 security provider with PKCE support',
    isDefault: true,
    tags: ['security', 'oauth2', 'oidc', 'sso'],
  },
  {
    id: 'license-provider-offline',
    name: 'Offline License Provider',
    type: 'license-provider',
    description: 'Ed25519 signed offline license validation provider',
    isDefault: true,
    tags: ['license', 'offline', 'air-gapped'],
  },
  {
    id: 'export-provider-csv',
    name: 'CSV Export Provider',
    type: 'export-provider',
    description: 'Export data to CSV/TSV with configurable formatting',
    isDefault: true,
    tags: ['export', 'csv', 'tsv'],
  },
  {
    id: 'export-provider-excel',
    name: 'Excel Export Provider',
    type: 'export-provider',
    description: 'Export data to XLSX with multi-sheet and cell formatting',
    isDefault: false,
    tags: ['export', 'excel', 'xlsx'],
  },
];

export const DEFAULT_TEMPLATES: Record<PluginType, string> = {
  connector: 'connector-basic',
  'erp-profile': 'erp-profile-rest',
  'ai-provider': 'ai-provider-openai',
  notification: 'notification-webhook',
  storage: 'storage-s3',
  transformation: 'transformation-field',
  validator: 'validator-schema',
  'sync-strategy': 'sync-strategy-incremental',
  'mapping-strategy': 'mapping-strategy-auto',
  'security-provider': 'security-provider-oauth2',
  'license-provider': 'license-provider-offline',
  'export-provider': 'export-provider-csv',
} as const;
