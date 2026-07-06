/**
 * @seltriva/cloud — security
 * Authentication, authorization, JWT, rate limiting, and security policies.
 */

import type { UserId, OrganizationId, MemberRole } from '../domain/index';
import type { JWTClaims, RateLimitResult } from '../infrastructure/index';

// ─── Authentication Context ───────────────────────────────────────────────

export interface AuthContext {
  readonly userId: UserId;
  readonly email: string;
  readonly organizationId?: OrganizationId;
  readonly role?: MemberRole;
  readonly scopes: string[];
  readonly isApiKey: boolean;
  readonly apiKeyId?: string;
  readonly sessionId?: string;
  readonly expiresAt: Date;
}

// ─── Authentication Service ───────────────────────────────────────────────

export interface IAuthenticationService {
  /**
   * Authenticate a request using Bearer JWT or API Key
   */
  authenticate(token: string): Promise<AuthContext | null>;

  /**
   * Verify and decode a JWT (Supabase-issued)
   */
  verifyJWT(token: string): Promise<JWTClaims | null>;

  /**
   * Validate an API key and return its scope/context
   */
  validateApiKey(rawKey: string): Promise<ApiKeyAuthContext | null>;

  /**
   * Refresh an expired session
   */
  refreshSession(refreshToken: string): Promise<SessionResult | null>;

  /**
   * Sign out a user
   */
  signOut(accessToken: string): Promise<void>;
}

export interface ApiKeyAuthContext {
  readonly apiKeyId: string;
  readonly organizationId: OrganizationId;
  readonly userId?: UserId;
  readonly scopes: string[];
  readonly expiresAt?: Date;
}

export interface SessionResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;
  readonly user: {
    readonly id: UserId;
    readonly email: string;
  };
}

// ─── Authorization Service ────────────────────────────────────────────────

export interface IAuthorizationService {
  /**
   * Check if a user has the minimum required role in an organization
   */
  checkRole(context: AuthContext, orgId: OrganizationId, minRole: MemberRole): boolean;

  /**
   * Check if the auth context has a specific scope
   */
  checkScope(context: AuthContext, scope: string): boolean;

  /**
   * Get the user's role in a specific organization
   */
  getMemberRole(userId: UserId, orgId: OrganizationId): Promise<MemberRole | null>;

  /**
   * Check if a user is the owner of an organization
   */
  isOwner(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

// Role hierarchy (higher index = more privileged)
export const ROLE_HIERARCHY: MemberRole[] = ['VIEWER', 'DEVELOPER', 'ADMIN', 'OWNER'];

export function hasMinimumRole(userRole: MemberRole, minRole: MemberRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minRole);
}

// ─── API Key Service ──────────────────────────────────────────────────────

export interface IApiKeyService {
  /**
   * Generate a new API key. Returns the raw key once — never stored in plaintext.
   */
  generate(options: GenerateApiKeyOptions): Promise<GeneratedApiKey>;

  /**
   * Validate a raw API key and return its metadata
   */
  validate(rawKey: string): Promise<ApiKeyValidationResult | null>;

  /**
   * Revoke an API key
   */
  revoke(apiKeyId: string): Promise<void>;

  /**
   * Hash a raw key for storage
   */
  hashKey(rawKey: string): string;

  /**
   * Extract the prefix from a raw key (for database lookup)
   */
  extractPrefix(rawKey: string): string;
}

export interface GenerateApiKeyOptions {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly scopes: string[];
  readonly userId?: UserId;
  readonly expiresAt?: Date;
}

export interface GeneratedApiKey {
  readonly rawKey: string;
  readonly prefix: string;
  readonly hash: string;
  readonly scopes: string[];
  readonly expiresAt?: Date;
}

export interface ApiKeyValidationResult {
  readonly apiKeyId: string;
  readonly organizationId: OrganizationId;
  readonly userId?: UserId;
  readonly scopes: string[];
  readonly expiresAt?: Date;
  readonly isExpired: boolean;
}

// ─── Rate Limiting ────────────────────────────────────────────────────────

export interface IRateLimitService {
  checkLimit(context: RateLimitContext): Promise<RateLimitResult>;
  getRateLimitKey(context: RateLimitContext): string;
}

export interface RateLimitContext {
  readonly ipAddress: string;
  readonly organizationId?: OrganizationId;
  readonly userId?: UserId;
  readonly endpoint: string;
  readonly method: string;
}

export interface RateLimitPolicy {
  readonly limit: number;
  readonly windowSeconds: number;
  readonly burstLimit?: number;
}

// ─── Security Headers ─────────────────────────────────────────────────────

export const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} as const;

// ─── JWT Configuration ────────────────────────────────────────────────────

export const JWT_CONFIG = {
  ALGORITHM: 'HS256' as const,
  EXPIRY_SECONDS: 3600,
  REFRESH_EXPIRY_SECONDS: 30 * 24 * 3600,
  ISSUER: 'seltriva-cloud',
  AUDIENCE: 'seltriva-platform',
} as const;

// ─── Security Policies ────────────────────────────────────────────────────

export interface SecurityPolicy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly rules: SecurityRule[];
}

export interface SecurityRule {
  readonly kind: SecurityRuleKind;
  readonly value: unknown;
  readonly action: 'allow' | 'deny' | 'log';
}

export type SecurityRuleKind =
  | 'ip-allowlist'
  | 'ip-blocklist'
  | 'rate-limit'
  | 'require-mfa'
  | 'sso-required'
  | 'api-key-only';
