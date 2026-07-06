/**
 * @seltriva/cloud — users
 * User profile management, preferences, and session handling.
 */

import type { User, UserId, Email, DomainResult, PaginatedResult } from '../domain/index';

export interface IUserService {
  findById(userId: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findBySupabaseId(supabaseId: string): Promise<User | null>;
  upsertFromAuth(supabaseUser: SupabaseUserData): Promise<DomainResult<User>>;
  updateProfile(userId: UserId, input: UpdateProfileInput): Promise<DomainResult<User>>;
  deleteAccount(userId: UserId): Promise<DomainResult<void>>;
  list(filter: UserListFilter): Promise<PaginatedResult<User>>;
  getOrganizations(userId: UserId): Promise<UserOrganizationView[]>;
}

export interface SupabaseUserData {
  readonly supabaseId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateProfileInput {
  readonly displayName?: string;
  readonly avatarUrl?: string;
}

export interface UserListFilter {
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface UserOrganizationView {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly role: string;
  readonly joinedAt?: Date;
}

export interface UserPreferences {
  readonly userId: UserId;
  readonly theme: 'light' | 'dark' | 'system';
  readonly language: string;
  readonly timezone: string;
  readonly notifications: UserNotificationPreferences;
}

export interface UserNotificationPreferences {
  readonly email: boolean;
  readonly inApp: boolean;
  readonly agentAlerts: boolean;
  readonly licenseAlerts: boolean;
  readonly securityAlerts: boolean;
}
