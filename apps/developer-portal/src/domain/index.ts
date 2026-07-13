/**
 * @seltriva/developer-portal — domain
 * Developer portal domain types: developer accounts, API tokens, analytics.
 */

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };

export type DeveloperId = Branded<string, 'DeveloperId'>;
export type ApiTokenId = Branded<string, 'ApiTokenId'>;
export type WebhookId = Branded<string, 'WebhookId'>;
export type SubmissionId = Branded<string, 'SubmissionId'>;

// ─── Developer Account ───────────────────────────────────────────────────────

export interface DeveloperAccount {
  readonly id: DeveloperId;
  readonly supabaseId: string;
  readonly email: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly bio?: string;
  readonly website?: string;
  readonly github?: string;
  readonly twitter?: string;
  readonly publisherSlug?: string;
  readonly verifiedPublisher: boolean;
  readonly publishedPlugins: number;
  readonly totalInstalls: number;
  readonly joinedAt: Date;
  readonly updatedAt: Date;
}

// ─── Developer API Token ─────────────────────────────────────────────────────

export interface DeveloperApiToken {
  readonly id: ApiTokenId;
  readonly developerId: DeveloperId;
  readonly name: string;
  readonly prefix: string;
  readonly scopes: string[];
  readonly lastUsedAt?: Date;
  readonly expiresAt?: Date;
  readonly createdAt: Date;
}

// ─── Plugin Submission ───────────────────────────────────────────────────────

export interface PluginSubmission {
  readonly id: SubmissionId;
  readonly developerId: DeveloperId;
  readonly pluginSlug: string;
  readonly version: string;
  readonly status: SubmissionStatus;
  readonly channel: 'stable' | 'beta' | 'edge';
  readonly packageUrl: string;
  readonly sha256: string;
  readonly signature?: string;
  readonly changelog?: string;
  readonly reviewNotes?: string;
  readonly reviewedAt?: Date;
  readonly reviewerId?: string;
  readonly submittedAt: Date;
  readonly updatedAt: Date;
}

export type SubmissionStatus = 'pending' | 'in-review' | 'approved' | 'rejected' | 'withdrawn';

// ─── Developer Analytics ─────────────────────────────────────────────────────

export interface DeveloperAnalytics {
  readonly developerId: DeveloperId;
  readonly period: AnalyticsPeriod;
  readonly totalInstalls: number;
  readonly newInstalls: number;
  readonly activeInstalls: number;
  readonly rating: number;
  readonly reviewCount: number;
  readonly byPlugin: PluginAnalyticsSummary[];
}

export interface PluginAnalyticsSummary {
  readonly pluginSlug: string;
  readonly pluginName: string;
  readonly installs: number;
  readonly uninstalls: number;
  readonly activeInstalls: number;
  readonly rating?: number;
}

export type AnalyticsPeriod = '7d' | '30d' | '90d' | '1y';

// ─── Portal Result ────────────────────────────────────────────────────────────

export type PortalResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PortalError };

export interface PortalError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}
