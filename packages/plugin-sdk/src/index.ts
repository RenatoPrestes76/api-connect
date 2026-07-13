/**
 * @seltriva/plugin-sdk
 * Plugin SDK for building enterprise plugins, connectors, and integrations
 * for the Seltriva Connect Platform.
 *
 * @version 0.1.0
 */

// ─── Branded Types ─────────────────────────────────────────────────────────

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };

export type PluginId = Branded<string, 'PluginId'>;
export type SemVer = Branded<string, 'SemVer'>;
export type SpdxLicense = Branded<string, 'SpdxLicense'>;

// ─── Plugin Type Enumeration ────────────────────────────────────────────────

export type PluginType =
  | 'connector'
  | 'erp-profile'
  | 'ai-provider'
  | 'notification'
  | 'storage'
  | 'transformation'
  | 'validator'
  | 'sync-strategy'
  | 'mapping-strategy'
  | 'security-provider'
  | 'license-provider'
  | 'export-provider';

// ─── Plugin Manifest (mandatory specification) ──────────────────────────────

export interface PluginManifest {
  // --- Identity (required) ---
  readonly id: string; // Reverse-domain: com.vendor.plugin-name
  readonly name: string; // Machine-readable slug (kebab-case)
  readonly displayName: string; // Human-readable name
  readonly version: SemVer; // Semantic versioning (x.y.z)
  readonly type: PluginType; // One of 12 plugin types

  // --- Description (required) ---
  readonly description: string; // One-sentence description
  readonly longDescription?: string; // Markdown content for marketplace
  readonly author: PluginAuthor;
  readonly license: SpdxLicense; // SPDX identifier (e.g. "MIT", "Apache-2.0")

  // --- Discovery (optional) ---
  readonly homepage?: string;
  readonly repository?: string;
  readonly bugs?: string;
  readonly keywords?: string[];
  readonly icon?: string; // URL or data:image/png;base64,...
  readonly screenshots?: string[];

  // --- Runtime Requirements (required) ---
  readonly runtime: PluginRuntimeRequirements;

  // --- Permissions (required; empty array = no permissions) ---
  readonly capabilities: PluginCapability[];
  readonly permissions: PluginPermission[];

  // --- Configuration Schema (optional) ---
  readonly configSchema?: PluginConfigSchema;

  // --- Entry Point (required) ---
  readonly entryPoint: string; // Relative path: "dist/index.js"

  // --- Compatibility (required) ---
  readonly platformVersion: string; // semver range: ">=0.1.0"
  readonly sdkVersion: string; // semver range: ">=0.1.0"

  // --- Integrity (set by packaging tool) ---
  readonly checksums?: { readonly sha256: string };
  readonly signature?: string; // Ed25519 base64url signature of manifest hash
  readonly publishedAt?: string; // ISO 8601

  // --- Deprecation (set by registry) ---
  readonly deprecated?: boolean;
  readonly deprecationMessage?: string;
  readonly replacedBy?: string;
}

export interface PluginAuthor {
  readonly name: string;
  readonly email?: string;
  readonly url?: string;
  readonly organization?: string;
}

export interface PluginRuntimeRequirements {
  readonly nodeVersion: string; // semver range: ">=20.0.0"
  readonly platform?: NodePlatform[];
  readonly arch?: NodeArch[];
  readonly memoryMb?: number;
  readonly cpuCores?: number;
}

export type NodePlatform = 'linux' | 'darwin' | 'win32';
export type NodeArch = 'x64' | 'arm64' | 'arm';

export type PluginCapability =
  | 'database-read'
  | 'database-write'
  | 'network-outbound'
  | 'network-inbound'
  | 'filesystem-read'
  | 'filesystem-write'
  | 'credential-access'
  | 'secret-access'
  | 'process-spawn'
  | 'ai-inference'
  | 'notification-send'
  | 'storage-read'
  | 'storage-write';

export type PluginPermission =
  | 'read:schema'
  | 'write:schema'
  | 'read:credentials'
  | 'write:credentials'
  | 'read:config'
  | 'write:config'
  | 'send:notification'
  | 'read:metrics'
  | 'write:metrics'
  | 'access:ai'
  | 'access:storage'
  | 'spawn:process';

export interface PluginConfigSchema {
  readonly type: 'object';
  readonly properties: Record<string, PluginConfigProperty>;
  readonly required?: string[];
}

export interface PluginConfigProperty {
  readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  readonly title?: string;
  readonly description?: string;
  readonly default?: unknown;
  readonly enum?: unknown[];
  readonly secret?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: string;
}

// ─── Plugin Result ──────────────────────────────────────────────────────────

export type PluginResult<T = void> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PluginError };

export interface PluginError {
  readonly code: PluginErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type PluginErrorCode =
  | 'INITIALIZATION_FAILED'
  | 'CONNECTION_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'CONFIGURATION_INVALID'
  | 'OPERATION_FAILED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN';

// ─── Plugin Context (API surface available to plugins) ───────────────────────

export interface PluginContext {
  readonly pluginId: PluginId;
  readonly version: SemVer;
  readonly environment: 'development' | 'staging' | 'production';
  readonly logger: PluginLogger;
  readonly config: IPluginConfig;
  readonly storage: IPluginStorage;
  readonly credentials: IPluginCredentialStore;
  readonly events: IPluginEventEmitter;
  readonly metrics: IPluginMetrics;
  readonly http: IPluginHttpClient;
}

export interface PluginLogger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, string>): PluginLogger;
}

export interface IPluginConfig {
  get<T = unknown>(key: string): T | undefined;
  getRequired<T = unknown>(key: string): T;
  getAll(): Record<string, unknown>;
  validate(): PluginResult<void>;
}

export interface IPluginStorage {
  get(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export interface IPluginCredentialStore {
  get(credentialId: string): Promise<string | null>;
  set(credentialId: string, value: string): Promise<void>;
  delete(credentialId: string): Promise<void>;
}

export interface IPluginEventEmitter {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (payload: unknown) => void): () => void;
  once(event: string, handler: (payload: unknown) => void): () => void;
}

export interface IPluginMetrics {
  increment(name: string, value?: number): void;
  gauge(name: string, value: number): void;
  timing(name: string, durationMs: number): void;
}

export interface IPluginHttpClient {
  get<T>(url: string, options?: HttpRequestOptions): Promise<PluginResult<T>>;
  post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<PluginResult<T>>;
  put<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<PluginResult<T>>;
  delete<T>(url: string, options?: HttpRequestOptions): Promise<PluginResult<T>>;
}

export interface HttpRequestOptions {
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

// ─── Base Plugin Interface ──────────────────────────────────────────────────

export interface Plugin {
  readonly manifest: PluginManifest;
  init(context: PluginContext): Promise<PluginResult<void>>;
  start(): Promise<PluginResult<void>>;
  stop(): Promise<PluginResult<void>>;
  destroy(): Promise<PluginResult<void>>;
  health(): Promise<PluginHealthStatus>;
}

export interface PluginHealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly message?: string;
  readonly checks?: Record<string, 'ok' | 'fail'>;
}

// ─── 12 Plugin Type Interfaces ──────────────────────────────────────────────

// 1. Connector Plugin (database/API connections)
export interface IConnectorPlugin extends Plugin {
  readonly type: 'connector';
  connect(config: ConnectorConfig): Promise<PluginResult<ConnectorHandle>>;
  disconnect(handle: ConnectorHandle): Promise<PluginResult<void>>;
  test(config: ConnectorConfig): Promise<PluginResult<ConnectorTestResult>>;
  getCapabilities(): ConnectorCapabilities;
}

export interface ConnectorConfig {
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly username?: string;
  readonly password?: string;
  readonly ssl?: boolean;
  readonly options?: Record<string, unknown>;
}

export interface ConnectorHandle {
  readonly id: string;
  readonly connectorType: string;
  readonly connectedAt: Date;
}

export interface ConnectorTestResult {
  readonly success: boolean;
  readonly latencyMs: number;
  readonly serverVersion?: string;
  readonly message?: string;
}

export interface ConnectorCapabilities {
  readonly query: boolean;
  readonly schemaDiscovery: boolean;
  readonly realtime: boolean;
  readonly bulk: boolean;
  readonly transactions: boolean;
}

// 2. ERP Profile Plugin
export interface IERPProfilePlugin extends Plugin {
  readonly type: 'erp-profile';
  getSystem(): ERPSystemDescriptor;
  getModules(): ERPModule[];
  getEntityMappings(): ERPEntityMapping[];
  getAuthFlow(): ERPAuthFlow;
}

export interface ERPSystemDescriptor {
  readonly systemId: string;
  readonly systemName: string;
  readonly vendor: string;
  readonly version?: string;
  readonly category: ERPCategory;
  readonly website?: string;
}

export type ERPCategory =
  | 'erp'
  | 'crm'
  | 'hris'
  | 'wms'
  | 'ecommerce'
  | 'accounting'
  | 'manufacturing'
  | 'custom';

export interface ERPModule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export interface ERPEntityMapping {
  readonly entityName: string;
  readonly sourcePath: string;
  readonly targetSchema: string;
  readonly transformations?: string[];
}

export interface ERPAuthFlow {
  readonly type: 'basic' | 'oauth2' | 'api-key' | 'saml' | 'custom';
  readonly configFields: Array<{ key: string; label: string; secret: boolean }>;
  authenticate(credentials: Record<string, string>): Promise<PluginResult<ERPAuthToken>>;
  refreshToken?(token: ERPAuthToken): Promise<PluginResult<ERPAuthToken>>;
}

export interface ERPAuthToken {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: Date;
  readonly scope?: string;
}

// 3. AI Provider Plugin
export interface IAIProviderPlugin extends Plugin {
  readonly type: 'ai-provider';
  getModels(): AIModelDescriptor[];
  complete(request: AICompletionRequest): Promise<PluginResult<AICompletionResponse>>;
  embed?(text: string[]): Promise<PluginResult<number[][]>>;
  streamComplete?(
    request: AICompletionRequest,
    stream: AIStreamHandler
  ): Promise<PluginResult<void>>;
}

export interface AIModelDescriptor {
  readonly id: string;
  readonly name: string;
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  readonly supportsImages: boolean;
  readonly supportsStreaming: boolean;
}

export interface AICompletionRequest {
  readonly model: string;
  readonly messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly systemPrompt?: string;
}

export interface AICompletionResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: { inputTokens: number; outputTokens: number };
  readonly finishReason: 'stop' | 'length' | 'error';
}

export type AIStreamHandler = (chunk: string, done: boolean) => void;

// 4. Notification Plugin
export interface INotificationPlugin extends Plugin {
  readonly type: 'notification';
  getChannels(): NotificationChannelDescriptor[];
  send(notification: NotificationPayload): Promise<PluginResult<void>>;
  sendBatch(notifications: NotificationPayload[]): Promise<PluginResult<void>>;
}

export interface NotificationChannelDescriptor {
  readonly id: string;
  readonly name: string;
  readonly supportsRichContent: boolean;
  readonly supportsBatchSend: boolean;
}

export interface NotificationPayload {
  readonly channel: string;
  readonly recipient: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, unknown>;
  readonly priority?: 'low' | 'normal' | 'high' | 'critical';
}

// 5. Storage Plugin
export interface IStoragePlugin extends Plugin {
  readonly type: 'storage';
  upload(
    key: string,
    content: Buffer,
    metadata?: Record<string, string>
  ): Promise<PluginResult<StorageUploadResult>>;
  download(key: string): Promise<PluginResult<Buffer>>;
  delete(key: string): Promise<PluginResult<void>>;
  list(prefix?: string): Promise<PluginResult<StorageObject[]>>;
  getSignedUrl(key: string, expirySeconds?: number): Promise<PluginResult<string>>;
}

export interface StorageUploadResult {
  readonly key: string;
  readonly url: string;
  readonly sizeBytes: number;
  readonly etag?: string;
}

export interface StorageObject {
  readonly key: string;
  readonly sizeBytes: number;
  readonly lastModified: Date;
  readonly etag?: string;
}

// 6. Transformation Plugin
export interface ITransformationPlugin extends Plugin {
  readonly type: 'transformation';
  getTransformations(): TransformationDescriptor[];
  transform(input: TransformationInput): Promise<PluginResult<TransformationOutput>>;
  validateInput(input: unknown, schema: unknown): PluginResult<void>;
}

export interface TransformationDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly outputSchema: unknown;
}

export interface TransformationInput {
  readonly transformationId: string;
  readonly data: unknown;
  readonly options?: Record<string, unknown>;
}

export interface TransformationOutput {
  readonly data: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly durationMs: number;
}

// 7. Validator Plugin
export interface IValidatorPlugin extends Plugin {
  readonly type: 'validator';
  getRules(): ValidationRule[];
  validate(input: ValidatorInput): Promise<PluginResult<ValidatorOutput>>;
}

export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: 'info' | 'warning' | 'error';
}

export interface ValidatorInput {
  readonly ruleIds?: string[];
  readonly data: unknown;
  readonly schema?: unknown;
  readonly context?: Record<string, unknown>;
}

export interface ValidatorOutput {
  readonly valid: boolean;
  readonly issues: ValidationIssue[];
}

export interface ValidationIssue {
  readonly ruleId: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly path?: string;
  readonly value?: unknown;
}

// 8. Sync Strategy Plugin
export interface ISyncStrategyPlugin extends Plugin {
  readonly type: 'sync-strategy';
  getStrategyDescriptor(): SyncStrategyDescriptor;
  plan(context: SyncPlanContext): Promise<PluginResult<SyncPlan>>;
  execute(plan: SyncPlan): Promise<PluginResult<SyncResult>>;
  checkpoint(): Promise<PluginResult<SyncCheckpoint>>;
  restore(checkpoint: SyncCheckpoint): Promise<PluginResult<void>>;
}

export interface SyncStrategyDescriptor {
  readonly id: string;
  readonly name: string;
  readonly mode: 'full' | 'incremental' | 'cdc' | 'hybrid';
  readonly supportsResume: boolean;
  readonly supportsCancel: boolean;
}

export interface SyncPlanContext {
  readonly sourceFingerprint?: string;
  readonly targetFingerprint?: string;
  readonly lastCheckpoint?: SyncCheckpoint;
}

export interface SyncPlan {
  readonly id: string;
  readonly operations: SyncOperation[];
  readonly estimatedCount: number;
}

export interface SyncOperation {
  readonly kind: 'insert' | 'update' | 'delete' | 'noop';
  readonly entityId: string;
  readonly payload?: unknown;
}

export interface SyncResult {
  readonly planId: string;
  readonly inserted: number;
  readonly updated: number;
  readonly deleted: number;
  readonly errors: number;
  readonly durationMs: number;
}

export interface SyncCheckpoint {
  readonly id: string;
  readonly createdAt: Date;
  readonly state: unknown;
}

// 9. Mapping Strategy Plugin
export interface IMappingStrategyPlugin extends Plugin {
  readonly type: 'mapping-strategy';
  getMappingDescriptor(): MappingDescriptor;
  createMapping(config: MappingConfig): Promise<PluginResult<MappingHandle>>;
  apply(handle: MappingHandle, record: unknown): Promise<PluginResult<unknown>>;
  applyBatch(handle: MappingHandle, records: unknown[]): Promise<PluginResult<unknown[]>>;
  destroyMapping(handle: MappingHandle): Promise<void>;
}

export interface MappingDescriptor {
  readonly id: string;
  readonly name: string;
  readonly supportsAutoMap: boolean;
  readonly supportsCustomFunctions: boolean;
}

export interface MappingConfig {
  readonly sourceSchema: unknown;
  readonly targetSchema: unknown;
  readonly rules: MappingRule[];
}

export interface MappingRule {
  readonly sourceField: string;
  readonly targetField: string;
  readonly transform?: string;
  readonly defaultValue?: unknown;
}

export interface MappingHandle {
  readonly id: string;
  readonly createdAt: Date;
}

// 10. Security Provider Plugin
export interface ISecurityProviderPlugin extends Plugin {
  readonly type: 'security-provider';
  getCapabilities(): SecurityCapabilities;
  authenticate(request: SecurityAuthRequest): Promise<PluginResult<SecurityAuthResult>>;
  authorize(context: SecurityAuthzContext): Promise<PluginResult<boolean>>;
  rotateCredentials?(credentialId: string): Promise<PluginResult<void>>;
  validateToken?(token: string): Promise<PluginResult<TokenClaims>>;
}

export interface SecurityCapabilities {
  readonly sso: boolean;
  readonly mfa: boolean;
  readonly tokenValidation: boolean;
  readonly credentialRotation: boolean;
  readonly auditLog: boolean;
}

export interface SecurityAuthRequest {
  readonly type: 'password' | 'token' | 'certificate' | 'saml' | 'oauth2';
  readonly credentials: Record<string, string>;
}

export interface SecurityAuthResult {
  readonly token: string;
  readonly expiresAt: Date;
  readonly subject: string;
  readonly claims?: Record<string, unknown>;
}

export interface SecurityAuthzContext {
  readonly subject: string;
  readonly resource: string;
  readonly action: string;
  readonly context?: Record<string, unknown>;
}

export interface TokenClaims {
  readonly subject: string;
  readonly issuer: string;
  readonly expiresAt: Date;
  readonly claims: Record<string, unknown>;
}

// 11. License Provider Plugin
export interface ILicenseProviderPlugin extends Plugin {
  readonly type: 'license-provider';
  activate(licenseKey: string): Promise<PluginResult<LicenseInfo>>;
  validate(licenseKey: string): Promise<PluginResult<LicenseInfo>>;
  revoke(licenseKey: string): Promise<PluginResult<void>>;
  generateKey(options: LicenseKeyOptions): Promise<PluginResult<string>>;
}

export interface LicenseInfo {
  readonly key: string;
  readonly tier: string;
  readonly features: string[];
  readonly limits: Record<string, number>;
  readonly expiresAt?: Date;
  readonly valid: boolean;
}

export interface LicenseKeyOptions {
  readonly tier: string;
  readonly features?: string[];
  readonly limits?: Record<string, number>;
  readonly expiresAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

// 12. Export Provider Plugin
export interface IExportProviderPlugin extends Plugin {
  readonly type: 'export-provider';
  getFormats(): ExportFormat[];
  export(request: ExportRequest): Promise<PluginResult<ExportResult>>;
  stream?(request: ExportRequest): AsyncIterable<Buffer>;
}

export interface ExportFormat {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly extension: string;
  readonly supportsStreaming: boolean;
}

export interface ExportRequest {
  readonly formatId: string;
  readonly data: unknown;
  readonly options?: Record<string, unknown>;
}

export interface ExportResult {
  readonly formatId: string;
  readonly content: Buffer;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly durationMs: number;
}

// ─── Plugin Union Type ──────────────────────────────────────────────────────

export type AnyPlugin =
  | IConnectorPlugin
  | IERPProfilePlugin
  | IAIProviderPlugin
  | INotificationPlugin
  | IStoragePlugin
  | ITransformationPlugin
  | IValidatorPlugin
  | ISyncStrategyPlugin
  | IMappingStrategyPlugin
  | ISecurityProviderPlugin
  | ILicenseProviderPlugin
  | IExportProviderPlugin;

// ─── Plugin Factory ─────────────────────────────────────────────────────────

export interface PluginFactory<T extends Plugin = Plugin> {
  readonly manifest: PluginManifest;
  create(): T;
}

export function definePlugin<T extends Plugin>(factory: PluginFactory<T>): PluginFactory<T> {
  return factory;
}

// ─── Manifest Validation ────────────────────────────────────────────────────

export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly errors: Array<{ field: string; message: string }>;
  readonly warnings: string[];
}

export function validateManifestSchema(manifest: unknown): ManifestValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'root', message: 'Manifest must be an object' }],
      warnings,
    };
  }

  const m = manifest as Record<string, unknown>;
  const required = [
    'id',
    'name',
    'displayName',
    'version',
    'type',
    'description',
    'author',
    'license',
    'runtime',
    'entryPoint',
    'platformVersion',
    'sdkVersion',
  ];

  for (const field of required) {
    if (!m[field]) {
      errors.push({ field, message: `Required field "${field}" is missing` });
    }
  }

  if (m['id'] && typeof m['id'] === 'string') {
    if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(m['id'] as string)) {
      errors.push({
        field: 'id',
        message: 'Plugin ID must be a reverse-domain identifier (e.g. com.vendor.plugin-name)',
      });
    }
  }

  if (m['version'] && typeof m['version'] === 'string') {
    if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(m['version'] as string)) {
      errors.push({ field: 'version', message: 'Version must follow semantic versioning (x.y.z)' });
    }
  }

  const validTypes: PluginType[] = [
    'connector',
    'erp-profile',
    'ai-provider',
    'notification',
    'storage',
    'transformation',
    'validator',
    'sync-strategy',
    'mapping-strategy',
    'security-provider',
    'license-provider',
    'export-provider',
  ];
  if (m['type'] && !validTypes.includes(m['type'] as PluginType)) {
    errors.push({ field: 'type', message: `Plugin type must be one of: ${validTypes.join(', ')}` });
  }

  if (!m['capabilities']) {
    warnings.push('capabilities array is missing — defaulting to empty (no capabilities)');
  }
  if (!m['permissions']) {
    warnings.push('permissions array is missing — defaulting to empty (no permissions)');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const PLUGIN_SDK_VERSION = '0.1.0';
export const PLUGIN_SDK_CODENAME = 'Forge';

export const MANIFEST_FILE_NAME = 'atlas-plugin.json';
export const PACKAGE_EXTENSION = '.atlasp';

export const PLUGIN_TYPES: PluginType[] = [
  'connector',
  'erp-profile',
  'ai-provider',
  'notification',
  'storage',
  'transformation',
  'validator',
  'sync-strategy',
  'mapping-strategy',
  'security-provider',
  'license-provider',
  'export-provider',
];
