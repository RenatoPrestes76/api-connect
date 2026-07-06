/**
 * @seltriva/core/drivers
 * Driver interfaces for external system integration — Hexagonal Architecture ports
 */

/**
 * Base driver contract
 */
export interface Driver {
  readonly name: string;
  readonly version: string;
  readonly type: string;
  initialize(): Promise<void>;
  isReady(): boolean;
  shutdown(): Promise<void>;
  getMetadata(): DriverMetadata;
  getCapabilities(): string[];
  hasCapability(capability: string): boolean;
}

/**
 * Driver metadata
 */
export interface DriverMetadata {
  readonly name: string;
  readonly version: string;
  readonly type: string;
  readonly author?: string;
  readonly description?: string;
  readonly capabilities: string[];
  readonly dependencies?: string[];
  readonly configSchema?: Record<string, unknown>;
}

// ─── Database ──────────────────────────────────────────────────────────────

export interface DatabaseDriver extends Driver {
  readonly type: 'database';
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  getSchema(): Promise<DatabaseSchema>;
}

export interface DatabaseSchema {
  readonly tables: Table[];
  readonly views?: View[];
  readonly indices?: Index[];
}

export interface Table {
  readonly name: string;
  readonly columns: Column[];
  readonly primaryKey?: string[];
  readonly foreignKeys?: ForeignKey[];
}

export interface Column {
  readonly name: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly default?: unknown;
}

export interface View {
  readonly name: string;
  readonly definition: string;
}

export interface Index {
  readonly name: string;
  readonly table: string;
  readonly columns: string[];
  readonly unique: boolean;
}

export interface ForeignKey {
  readonly name: string;
  readonly column: string;
  readonly referencedTable: string;
  readonly referencedColumn: string;
}

// ─── ERP ───────────────────────────────────────────────────────────────────

export interface ERPDriver extends Driver {
  readonly type: 'erp';
  connect(credentials: Record<string, unknown>): Promise<void>;
  isConnected(): boolean;
  getEntities(): Promise<string[]>;
  fetch(entity: string, filters?: Record<string, unknown>): Promise<unknown[]>;
  push(entity: string, data: unknown): Promise<unknown>;
}

// ─── Cache ─────────────────────────────────────────────────────────────────

export interface CacheDriver extends Driver {
  readonly type: 'cache';
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// ─── Storage ───────────────────────────────────────────────────────────────

export interface StorageDriver extends Driver {
  readonly type: 'storage';
  upload(key: string, data: Buffer, metadata?: Record<string, unknown>): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
  getStorageMetadata(key: string): Promise<Record<string, unknown>>;
}

// ─── Notification ──────────────────────────────────────────────────────────

export interface NotificationDriver extends Driver {
  readonly type: 'notification';
  send(recipient: string, message: NotificationMessage): Promise<string>;
  sendBatch(notifications: BatchNotification[]): Promise<string[]>;
  getStatus(notificationId: string): Promise<NotificationStatus>;
}

export interface NotificationMessage {
  readonly subject?: string;
  readonly body: string;
  readonly template?: string;
  readonly data?: Record<string, unknown>;
  readonly channel: 'email' | 'sms' | 'push' | 'webhook';
}

export interface BatchNotification {
  readonly recipients: string[];
  readonly message: NotificationMessage;
}

export interface NotificationStatus {
  readonly id: string;
  readonly status: 'pending' | 'sent' | 'delivered' | 'failed';
  readonly timestamp: Date;
  readonly error?: string;
}

// ─── AI Provider ───────────────────────────────────────────────────────────

export interface AIProviderDriver extends Driver {
  readonly type: 'ai';
  complete(prompt: string, options?: AICompletionOptions): Promise<AICompletionResult>;
  embed(text: string): Promise<number[]>;
  getAvailableModels(): Promise<string[]>;
}

export interface AICompletionOptions {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly systemPrompt?: string;
  readonly stopSequences?: string[];
}

export interface AICompletionResult {
  readonly text: string;
  readonly model: string;
  readonly usage: AIUsage;
  readonly finishReason: 'stop' | 'length' | 'error';
}

export interface AIUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

// ─── Authentication Provider ────────────────────────────────────────────────

export interface AuthDriver extends Driver {
  readonly type: 'auth';
  authenticate(credentials: Record<string, unknown>): Promise<AuthToken>;
  verify(token: string): Promise<AuthClaims>;
  refresh(token: string): Promise<AuthToken>;
  revoke(token: string): Promise<void>;
}

export interface AuthToken {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresIn: number;
  readonly tokenType: string;
}

export interface AuthClaims {
  readonly sub: string;
  readonly email?: string;
  readonly roles?: string[];
  readonly permissions?: string[];
  readonly metadata?: Record<string, unknown>;
}
