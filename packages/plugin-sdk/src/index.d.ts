/**
 * @seltriva/plugin-sdk
 * Plugin SDK for building enterprise plugins, connectors, and integrations
 * for the Seltriva Connect Platform.
 *
 * @version 0.1.0
 */
declare const brand: unique symbol;
type Branded<T, B> = T & {
  readonly [brand]: B;
};
export type PluginId = Branded<string, 'PluginId'>;
export type SemVer = Branded<string, 'SemVer'>;
export type SpdxLicense = Branded<string, 'SpdxLicense'>;
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
export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly version: SemVer;
  readonly type: PluginType;
  readonly description: string;
  readonly longDescription?: string;
  readonly author: PluginAuthor;
  readonly license: SpdxLicense;
  readonly homepage?: string;
  readonly repository?: string;
  readonly bugs?: string;
  readonly keywords?: string[];
  readonly icon?: string;
  readonly screenshots?: string[];
  readonly runtime: PluginRuntimeRequirements;
  readonly capabilities: PluginCapability[];
  readonly permissions: PluginPermission[];
  readonly configSchema?: PluginConfigSchema;
  readonly entryPoint: string;
  readonly platformVersion: string;
  readonly sdkVersion: string;
  readonly checksums?: {
    readonly sha256: string;
  };
  readonly signature?: string;
  readonly publishedAt?: string;
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
  readonly nodeVersion: string;
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
export type PluginResult<T = void> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: PluginError;
    };
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
  readonly configFields: Array<{
    key: string;
    label: string;
    secret: boolean;
  }>;
  authenticate(credentials: Record<string, string>): Promise<PluginResult<ERPAuthToken>>;
  refreshToken?(token: ERPAuthToken): Promise<PluginResult<ERPAuthToken>>;
}
export interface ERPAuthToken {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: Date;
  readonly scope?: string;
}
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
  readonly messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly systemPrompt?: string;
}
export interface AICompletionResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: {
    inputTokens: number;
    outputTokens: number;
  };
  readonly finishReason: 'stop' | 'length' | 'error';
}
export type AIStreamHandler = (chunk: string, done: boolean) => void;
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
export interface PluginFactory<T extends Plugin = Plugin> {
  readonly manifest: PluginManifest;
  create(): T;
}
export declare function definePlugin<T extends Plugin>(factory: PluginFactory<T>): PluginFactory<T>;
export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly errors: Array<{
    field: string;
    message: string;
  }>;
  readonly warnings: string[];
}
export declare function validateManifestSchema(manifest: unknown): ManifestValidationResult;
export declare const PLUGIN_SDK_VERSION = '0.1.0';
export declare const PLUGIN_SDK_CODENAME = 'Forge';
export declare const MANIFEST_FILE_NAME = 'atlas-plugin.json';
export declare const PACKAGE_EXTENSION = '.atlasp';
export declare const PLUGIN_TYPES: PluginType[];
export {};
//# sourceMappingURL=index.d.ts.map
