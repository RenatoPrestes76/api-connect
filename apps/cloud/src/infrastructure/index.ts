/**
 * @seltriva/cloud — infrastructure
 * Infrastructure layer: Prisma repositories, Supabase adapter,
 * realtime publisher, storage, and external service contracts.
 *
 * Infrastructure modules implement the ports (interfaces) defined
 * in the domain layer. Nothing in domain/ imports from here.
 */

import type { PrismaClient } from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrganizationId,
  AgentId,
  WorkspaceId,
  UserId,
  PluginId,
  LicenseId,
  DomainResult,
  CloudDomainEvent,
} from '../domain/index';

// ─── DI Container ─────────────────────────────────────────────────────────

export type InfrastructureToken<T> = symbol & { readonly __type: T };

export function createToken<T>(description: string): InfrastructureToken<T> {
  return Symbol(description) as InfrastructureToken<T>;
}

export const INFRASTRUCTURE_TOKENS = {
  PRISMA_CLIENT: createToken<PrismaClient>('PrismaClient'),
  SUPABASE_CLIENT: createToken<SupabaseClient>('SupabaseClient'),
  REALTIME_PUBLISHER: createToken<IRealtimePublisher>('RealtimePublisher'),
  CACHE_PROVIDER: createToken<ICacheProvider>('CacheProvider'),
  STORAGE_PROVIDER: createToken<IStorageProvider>('StorageProvider'),
  EMAIL_PROVIDER: createToken<IEmailProvider>('EmailProvider'),
  WEBHOOK_PROVIDER: createToken<IWebhookProvider>('WebhookProvider'),
  QUEUE_PROVIDER: createToken<IQueueProvider>('QueueProvider'),
  ENCRYPTION_PROVIDER: createToken<IEncryptionProvider>('EncryptionProvider'),
} as const;

// ─── Prisma Client Factory ────────────────────────────────────────────────

export interface PrismaClientFactory {
  create(databaseUrl: string): PrismaClient;
  createReadReplica(replicaUrl: string): PrismaClient;
}

// ─── Realtime Publisher ───────────────────────────────────────────────────

export interface IRealtimePublisher {
  /**
   * Publish a domain event to Supabase realtime
   */
  publish(channel: string, event: CloudDomainEvent): Promise<void>;

  /**
   * Broadcast to all subscribers of an organization channel
   */
  broadcastToOrganization(orgId: OrganizationId, event: CloudDomainEvent): Promise<void>;

  /**
   * Broadcast to a specific agent channel
   */
  broadcastToAgent(agentId: AgentId, payload: unknown): Promise<void>;
}

// ─── Cache Provider ───────────────────────────────────────────────────────

export interface ICacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  increment(key: string, by?: number): Promise<number>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  flush(): Promise<void>;
}

export const CACHE_KEYS = {
  ORGANIZATION: (id: OrganizationId) => `org:${id}`,
  ORGANIZATION_SLUG: (slug: string) => `org:slug:${slug}`,
  AGENT: (id: AgentId) => `agent:${id}`,
  AGENT_STATUS: (id: AgentId) => `agent:status:${id}`,
  LICENSE: (id: LicenseId) => `license:${id}`,
  ORG_LICENSE: (orgId: OrganizationId) => `org:${orgId}:license`,
  FEATURE_FLAGS: (orgId: OrganizationId, envId?: string) => `ff:${orgId}:${envId ?? 'global'}`,
  RATE_LIMIT: (key: string) => `rl:${key}`,
  SESSION: (token: string) => `session:${token}`,
} as const;

// ─── Storage Provider ─────────────────────────────────────────────────────

export interface IStorageProvider {
  upload(
    bucket: string,
    path: string,
    data: Buffer,
    options?: UploadOptions
  ): Promise<DomainResult<StoredFile>>;
  download(bucket: string, path: string): Promise<DomainResult<Buffer>>;
  delete(bucket: string, path: string): Promise<DomainResult<void>>;
  getPublicUrl(bucket: string, path: string): string;
  getSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string>;
  list(bucket: string, prefix: string): Promise<StoredFile[]>;
}

export interface UploadOptions {
  readonly contentType?: string;
  readonly maxSizeBytes?: number;
  readonly isPublic?: boolean;
  readonly metadata?: Record<string, string>;
}

export interface StoredFile {
  readonly bucket: string;
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly contentType: string;
  readonly url?: string;
  readonly uploadedAt: Date;
}

export const STORAGE_BUCKETS = {
  PLUGIN_ASSETS: 'plugin-assets',
  ORG_LOGOS: 'org-logos',
  AUDIT_EXPORTS: 'audit-exports',
  REPORTS: 'reports',
} as const;

// ─── Email Provider ───────────────────────────────────────────────────────

export interface IEmailProvider {
  send(message: EmailMessage): Promise<DomainResult<void>>;
  sendBatch(messages: EmailMessage[]): Promise<DomainResult<void>>;
}

export interface EmailMessage {
  readonly to: string | string[];
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
  readonly from?: string;
  readonly replyTo?: string;
  readonly templateId?: string;
  readonly templateData?: Record<string, unknown>;
}

// ─── Webhook Provider ─────────────────────────────────────────────────────

export interface IWebhookProvider {
  deliver(
    endpoint: WebhookEndpoint,
    payload: WebhookPayload
  ): Promise<DomainResult<WebhookDeliveryResult>>;
  verify(signature: string, body: string, secret: string): boolean;
}

export interface WebhookEndpoint {
  readonly url: string;
  readonly secret: string;
  readonly events: string[];
  readonly retries?: number;
  readonly timeoutMs?: number;
}

export interface WebhookPayload {
  readonly id: string;
  readonly eventType: string;
  readonly data: unknown;
  readonly timestamp: Date;
}

export interface WebhookDeliveryResult {
  readonly success: boolean;
  readonly statusCode?: number;
  readonly latencyMs: number;
  readonly error?: string;
}

// ─── Queue Provider ───────────────────────────────────────────────────────

export interface IQueueProvider {
  enqueue<T>(queue: string, job: QueueJob<T>): Promise<string>;
  dequeue<T>(queue: string, count?: number): Promise<QueueJob<T>[]>;
  acknowledge(queue: string, jobId: string): Promise<void>;
  nack(queue: string, jobId: string, delayMs?: number): Promise<void>;
  getStats(queue: string): Promise<QueueStats>;
}

export interface QueueJob<T = unknown> {
  readonly id: string;
  readonly payload: T;
  readonly priority: number;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly scheduledAt?: Date;
  readonly createdAt: Date;
}

export interface QueueStats {
  readonly pending: number;
  readonly processing: number;
  readonly completed: number;
  readonly failed: number;
}

// ─── Encryption Provider ──────────────────────────────────────────────────

export interface IEncryptionProvider {
  encrypt(plaintext: string, keyId?: string): Promise<EncryptedValue>;
  decrypt(encrypted: EncryptedValue): Promise<string>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateSecureRandom(bytes?: number): string;
  hmac(data: string, secret: string): string;
}

export interface EncryptedValue {
  readonly ciphertext: string;
  readonly algorithm: string;
  readonly iv: string;
  readonly authTag: string;
  readonly keyId?: string;
}

// ─── Supabase Auth Adapter ────────────────────────────────────────────────

export interface ISupabaseAuthAdapter {
  getUser(accessToken: string): Promise<SupabaseAuthUser | null>;
  signOut(accessToken: string): Promise<void>;
  verifyJWT(token: string): Promise<JWTClaims | null>;
  refreshSession(refreshToken: string): Promise<RefreshResult | null>;
}

export interface SupabaseAuthUser {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface JWTClaims {
  readonly sub: string;
  readonly email?: string;
  readonly role?: string;
  readonly exp: number;
  readonly iat: number;
}

export interface RefreshResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────

export interface IRateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  remaining(key: string, limit: number, windowSeconds: number): Promise<number>;
  reset(key: string): Promise<void>;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly limit: number;
}

export const RATE_LIMIT_POLICIES = {
  API_DEFAULT: { limit: 1000, windowSeconds: 60 },
  API_AUTH: { limit: 20, windowSeconds: 60 },
  API_AGENTS: { limit: 500, windowSeconds: 60 },
  WEBHOOK: { limit: 50, windowSeconds: 60 },
  INVITE: { limit: 10, windowSeconds: 3600 },
} as const;

// ─── Database Transaction ─────────────────────────────────────────────────

export interface ITransactionManager {
  run<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T>;
  runWithRetry<T>(fn: (tx: PrismaClient) => Promise<T>, maxRetries?: number): Promise<T>;
}
