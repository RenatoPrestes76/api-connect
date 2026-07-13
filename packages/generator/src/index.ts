/**
 * @seltriva/generator
 * Atlas code generator — scaffold complete plugin projects from templates.
 *
 * @version 0.1.0
 */

import type { PluginType } from '@seltriva/plugin-sdk';

// ─── Generator Interface ─────────────────────────────────────────────────────

export interface IPluginGenerator {
  generate(input: GeneratorInput): Promise<GeneratorResult>;
  preview(input: GeneratorInput): Promise<GeneratedFile[]>;
  listTemplates(): TemplateDescriptor[];
  getTemplate(type: PluginType): TemplateDescriptor;
}

// ─── Generator Input / Output ────────────────────────────────────────────────

export interface GeneratorInput {
  readonly pluginName: string; // e.g. "my-connector"
  readonly pluginId: string; // e.g. "com.acme.my-connector"
  readonly type: PluginType;
  readonly template?: string; // optional template override
  readonly author: GeneratorAuthor;
  readonly description?: string;
  readonly license?: string; // SPDX, default "MIT"
  readonly version?: string; // default "0.1.0"
  readonly outputDir: string;
  readonly options?: GeneratorOptions;
}

export interface GeneratorAuthor {
  readonly name: string;
  readonly email?: string;
  readonly organization?: string;
}

export interface GeneratorOptions {
  readonly addTests?: boolean;
  readonly addExamples?: boolean;
  readonly addDocumentation?: boolean;
  readonly packageManager?: 'npm' | 'pnpm' | 'yarn';
  readonly typescript?: boolean;
}

export interface GeneratorResult {
  readonly pluginName: string;
  readonly type: PluginType;
  readonly outputDir: string;
  readonly files: GeneratedFile[];
  readonly nextSteps: NextStep[];
  readonly durationMs: number;
}

export interface GeneratedFile {
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly content: string;
  readonly category: FileCategory;
  readonly created: boolean;
}

export type FileCategory = 'manifest' | 'source' | 'config' | 'test' | 'documentation' | 'tooling';

export interface NextStep {
  readonly order: number;
  readonly command?: string;
  readonly description: string;
}

// ─── Template Descriptor ─────────────────────────────────────────────────────

export interface TemplateDescriptor {
  readonly id: string;
  readonly name: string;
  readonly type: PluginType;
  readonly description: string;
  readonly category: string;
  readonly files: TemplateFileDescriptor[];
  readonly variables: TemplateVariable[];
  readonly requiredCapabilities?: string[];
  readonly exampleUseCase?: string;
}

export interface TemplateFileDescriptor {
  readonly path: string;
  readonly template: string;
  readonly category: FileCategory;
  readonly optional?: boolean;
}

export interface TemplateVariable {
  readonly name: string;
  readonly description: string;
  readonly type: 'string' | 'boolean' | 'enum';
  readonly default?: unknown;
  readonly choices?: string[];
  readonly required?: boolean;
}

// ─── Template Variables ──────────────────────────────────────────────────────

export interface TemplateRenderContext {
  readonly pluginName: string;
  readonly pluginId: string;
  readonly pluginType: PluginType;
  readonly pluginClass: string;
  readonly pluginDescription: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly authorOrganization: string;
  readonly license: string;
  readonly version: string;
  readonly year: number;
  readonly sdkVersion: string;
  readonly platformVersion: string;
  readonly hasTests: boolean;
  readonly hasDocs: boolean;
  readonly packageManager: string;
  readonly [key: string]: unknown;
}

// ─── File Templates ──────────────────────────────────────────────────────────

export const TEMPLATE_FILES: Record<string, string> = {
  'atlas-plugin.json': `{
  "id": "{{pluginId}}",
  "name": "{{pluginName}}",
  "displayName": "{{pluginName}}",
  "version": "{{version}}",
  "type": "{{pluginType}}",
  "description": "{{pluginDescription}}",
  "author": {
    "name": "{{authorName}}",
    "email": "{{authorEmail}}"
  },
  "license": "{{license}}",
  "runtime": {
    "nodeVersion": ">=20.0.0"
  },
  "capabilities": [],
  "permissions": [],
  "entryPoint": "dist/index.js",
  "platformVersion": ">=0.1.0",
  "sdkVersion": ">=0.1.0"
}`,

  'package.json': `{
  "name": "{{pluginId}}",
  "version": "{{version}}",
  "description": "{{pluginDescription}}",
  "license": "{{license}}",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "package": "atlas package",
    "publish:plugin": "atlas publish"
  },
  "dependencies": {
    "@seltriva/plugin-sdk": "latest"
  },
  "devDependencies": {
    "@seltriva/testing": "latest",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}`,

  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}`,

  'src/index.ts': `import type {
  Plugin,
  PluginContext,
  PluginManifest,
  PluginResult,
  PluginHealthStatus,
} from '@seltriva/plugin-sdk';
import manifest from '../atlas-plugin.json' assert { type: 'json' };

export class {{pluginClass}} implements Plugin {
  readonly manifest: PluginManifest = manifest as PluginManifest;

  private context!: PluginContext;

  async init(context: PluginContext): Promise<PluginResult<void>> {
    this.context = context;
    this.context.logger.info('Plugin initializing');
    return { ok: true, value: undefined };
  }

  async start(): Promise<PluginResult<void>> {
    this.context.logger.info('Plugin starting');
    return { ok: true, value: undefined };
  }

  async stop(): Promise<PluginResult<void>> {
    this.context.logger.info('Plugin stopping');
    return { ok: true, value: undefined };
  }

  async destroy(): Promise<PluginResult<void>> {
    this.context.logger.info('Plugin destroying');
    return { ok: true, value: undefined };
  }

  async health(): Promise<PluginHealthStatus> {
    return { status: 'healthy' };
  }
}

export default new {{pluginClass}}();`,
};

// ─── Template Catalog (one per plugin type) ──────────────────────────────────

export const BUILT_IN_TEMPLATES: TemplateDescriptor[] = [
  {
    id: 'connector-database',
    name: 'Database Connector',
    type: 'connector',
    description: 'Read-only database connector with schema discovery',
    category: 'connector',
    exampleUseCase: 'Connect PostgreSQL, MySQL, SQL Server, or Oracle databases',
    files: [],
    variables: [
      {
        name: 'driverType',
        type: 'enum',
        description: 'Database driver type',
        choices: ['postgres', 'mysql', 'mssql', 'oracle', 'sqlite'],
        required: true,
      },
    ],
  },
  {
    id: 'erp-profile-rest',
    name: 'ERP REST Profile',
    type: 'erp-profile',
    description: 'ERP profile for REST API-based systems',
    category: 'erp-profile',
    exampleUseCase: 'SAP, Oracle NetSuite, Microsoft Dynamics via REST API',
    files: [],
    variables: [],
  },
  {
    id: 'ai-provider-openai',
    name: 'AI Provider (OpenAI-compatible)',
    type: 'ai-provider',
    description: 'AI provider compatible with the OpenAI Chat Completions API',
    category: 'ai-provider',
    exampleUseCase: 'OpenAI, Azure OpenAI, Groq, Together AI',
    files: [],
    variables: [],
  },
  {
    id: 'notification-webhook',
    name: 'Webhook Notification Channel',
    type: 'notification',
    description: 'Send notifications via HTTP webhooks',
    category: 'notification',
    exampleUseCase: 'Slack, Teams, Discord, PagerDuty, custom HTTP endpoints',
    files: [],
    variables: [],
  },
  {
    id: 'storage-s3-compatible',
    name: 'S3-Compatible Storage',
    type: 'storage',
    description: 'Object storage for S3-compatible backends',
    category: 'storage',
    exampleUseCase: 'AWS S3, MinIO, Cloudflare R2, Backblaze B2',
    files: [],
    variables: [],
  },
  {
    id: 'transformation-field',
    name: 'Field Transformation',
    type: 'transformation',
    description: 'Transform individual fields with custom logic',
    category: 'transformation',
    exampleUseCase: 'Date formatting, currency conversion, string normalization',
    files: [],
    variables: [],
  },
  {
    id: 'validator-schema',
    name: 'Schema Validator',
    type: 'validator',
    description: 'Validate data against a JSON Schema or custom rules',
    category: 'validator',
    exampleUseCase: 'Business rule validation, data quality checks',
    files: [],
    variables: [],
  },
  {
    id: 'sync-strategy-incremental',
    name: 'Incremental Sync Strategy',
    type: 'sync-strategy',
    description: 'Sync only changed records using cursor-based pagination',
    category: 'sync-strategy',
    exampleUseCase: 'Efficient incremental synchronization with updated_at cursor',
    files: [],
    variables: [],
  },
  {
    id: 'mapping-strategy-auto',
    name: 'Auto Mapping Strategy',
    type: 'mapping-strategy',
    description: 'Automatically map fields by name similarity',
    category: 'mapping-strategy',
    exampleUseCase: 'Intelligent field mapping with fuzzy matching',
    files: [],
    variables: [],
  },
  {
    id: 'security-provider-oauth2',
    name: 'OAuth2 Security Provider',
    type: 'security-provider',
    description: 'OAuth2/OIDC authentication and authorization provider',
    category: 'security-provider',
    exampleUseCase: 'Auth0, Okta, Azure AD, Keycloak',
    files: [],
    variables: [],
  },
  {
    id: 'license-provider-offline',
    name: 'Offline License Provider',
    type: 'license-provider',
    description: 'Cryptographically signed offline license validation',
    category: 'license-provider',
    exampleUseCase: 'Air-gapped environments, hardware-locked licensing',
    files: [],
    variables: [],
  },
  {
    id: 'export-provider-csv',
    name: 'CSV Export Provider',
    type: 'export-provider',
    description: 'Export data to CSV format with custom formatting',
    category: 'export-provider',
    exampleUseCase: 'CSV/TSV data export with configurable delimiters',
    files: [],
    variables: [],
  },
];
