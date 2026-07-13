/**
 * @seltriva/cloud — storage
 * File and blob storage abstractions for uploads, exports, and assets.
 */

import type { OrganizationId, UserId, DomainResult } from '../domain/index';

export interface IStorageService {
  upload(input: UploadInput): Promise<DomainResult<StoredFile>>;
  download(fileId: string): Promise<DomainResult<DownloadResult>>;
  delete(fileId: string, actorId: UserId): Promise<DomainResult<void>>;
  getSignedUrl(fileId: string, expirySeconds?: number): Promise<DomainResult<string>>;
  getPublicUrl(fileId: string): string;
  listByOrganization(orgId: OrganizationId, filter?: StorageFilter): Promise<StoredFile[]>;
  getUsage(orgId: OrganizationId): Promise<StorageUsage>;
}

export interface UploadInput {
  readonly organizationId?: OrganizationId;
  readonly bucket: StorageBucket;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly content: Buffer | Blob;
  readonly metadata?: Record<string, string>;
  readonly expiresAt?: Date;
}

export interface StoredFile {
  readonly id: string;
  readonly organizationId?: OrganizationId;
  readonly bucket: StorageBucket;
  readonly path: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly metadata?: Record<string, string>;
  readonly publicUrl?: string;
  readonly uploadedAt: Date;
  readonly expiresAt?: Date;
}

export interface DownloadResult {
  readonly content: Buffer;
  readonly contentType: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

export interface StorageFilter {
  readonly bucket?: StorageBucket;
  readonly since?: Date;
  readonly limit?: number;
}

export interface StorageUsage {
  readonly organizationId: OrganizationId;
  readonly totalBytes: number;
  readonly limitBytes: number;
  readonly usedPercent: number;
  readonly fileCount: number;
  readonly byBucket: Record<StorageBucket, { count: number; bytes: number }>;
}

export type StorageBucket =
  | 'plugins'
  | 'audit-exports'
  | 'avatars'
  | 'logos'
  | 'attachments'
  | 'updates';

export const STORAGE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100 MB
  FREE_STORAGE_BYTES: 1 * 1024 * 1024 * 1024, // 1 GB
  STARTER_STORAGE_BYTES: 10 * 1024 * 1024 * 1024, // 10 GB
  PRO_STORAGE_BYTES: 100 * 1024 * 1024 * 1024, // 100 GB
  ENTERPRISE_STORAGE_BYTES: -1, // unlimited
} as const;
