/**
 * @seltriva/connectors/connectors/cloud
 * Cloud Storage Connector interfaces — S3, Azure Blob, GCS, Supabase Storage
 */

import type { Connector, ConnectorConfig, ConnectorResult } from '../../core/index';

// ─── Base Cloud Storage Connector ─────────────────────────────────────────

/**
 * Shared base for all object/blob storage connectors.
 * Models the storage as: container → objects (key → value).
 */
export interface CloudStorageConnector extends Connector {
  readonly type: 'cloud';

  // ── Containers (Bucket / Container / Bucket) ──────────────────────────

  listContainers(): Promise<ConnectorResult<CloudContainer[]>>;
  createContainer(name: string, options?: ContainerOptions): Promise<ConnectorResult<CloudContainer>>;
  deleteContainer(name: string, options?: DeleteContainerOptions): Promise<ConnectorResult<void>>;
  getContainer(name: string): Promise<ConnectorResult<CloudContainer>>;
  containerExists(name: string): Promise<ConnectorResult<boolean>>;

  // ── Objects ───────────────────────────────────────────────────────────

  listObjects(container: string, options?: ListObjectsOptions): Promise<ConnectorResult<CloudObjectListing>>;
  getObject(container: string, key: string): Promise<ConnectorResult<CloudObject>>;
  headObject(container: string, key: string): Promise<ConnectorResult<CloudObjectMetadata>>;
  objectExists(container: string, key: string): Promise<ConnectorResult<boolean>>;

  putObject(
    container: string,
    key: string,
    body: CloudObjectBody,
    options?: PutObjectOptions
  ): Promise<ConnectorResult<CloudObjectMetadata>>;

  deleteObject(container: string, key: string): Promise<ConnectorResult<void>>;
  deleteObjects(container: string, keys: string[]): Promise<ConnectorResult<DeleteObjectsResult>>;
  copyObject(
    source: CloudObjectPath,
    destination: CloudObjectPath,
    options?: CopyObjectOptions
  ): Promise<ConnectorResult<CloudObjectMetadata>>;
  moveObject(
    source: CloudObjectPath,
    destination: CloudObjectPath
  ): Promise<ConnectorResult<CloudObjectMetadata>>;

  // ── Streaming ─────────────────────────────────────────────────────────

  downloadStream(container: string, key: string): Promise<ConnectorResult<AsyncIterable<Uint8Array>>>;
  uploadStream(
    container: string,
    key: string,
    stream: AsyncIterable<Uint8Array>,
    options?: PutObjectOptions
  ): Promise<ConnectorResult<CloudObjectMetadata>>;

  // ── Presigned URLs ────────────────────────────────────────────────────

  generatePresignedUrl(
    container: string,
    key: string,
    operation: 'get' | 'put' | 'delete',
    options?: PresignedUrlOptions
  ): Promise<ConnectorResult<PresignedUrl>>;
}

// ─── Container + Object Models ────────────────────────────────────────────

export interface CloudContainer {
  readonly name: string;
  readonly region?: string;
  readonly createdAt?: Date;
  readonly metadata?: Record<string, string>;
}

export interface CloudObjectMetadata {
  readonly key: string;
  readonly size: number;
  readonly contentType?: string;
  readonly lastModified: Date;
  readonly etag?: string;
  readonly versionId?: string;
  readonly metadata?: Record<string, string>;
  readonly storageClass?: string;
}

export interface CloudObject extends CloudObjectMetadata {
  readonly body: Buffer;
}

export type CloudObjectBody = Buffer | Uint8Array | string | AsyncIterable<Uint8Array>;

export interface CloudObjectPath {
  readonly container: string;
  readonly key: string;
}

// ─── Listing ──────────────────────────────────────────────────────────────

export interface CloudObjectListing {
  readonly objects: CloudObjectMetadata[];
  readonly prefixes?: string[];
  readonly isTruncated: boolean;
  readonly continuationToken?: string;
  readonly totalCount?: number;
}

export interface ListObjectsOptions {
  readonly prefix?: string;
  readonly delimiter?: string;
  readonly maxKeys?: number;
  readonly continuationToken?: string;
  readonly recursive?: boolean;
}

// ─── Options ──────────────────────────────────────────────────────────────

export interface ContainerOptions {
  readonly region?: string;
  readonly accessControl?: 'private' | 'public-read' | 'public-read-write';
  readonly versioning?: boolean;
  readonly encryption?: ContainerEncryption;
  readonly metadata?: Record<string, string>;
  readonly tags?: Record<string, string>;
}

export interface ContainerEncryption {
  readonly type: 'none' | 'sse-s3' | 'sse-kms' | 'customer-provided';
  readonly kmsKeyId?: string;
  readonly customerKey?: string;
}

export interface DeleteContainerOptions {
  readonly force?: boolean;
}

export interface PutObjectOptions {
  readonly contentType?: string;
  readonly contentEncoding?: string;
  readonly contentDisposition?: string;
  readonly cacheControl?: string;
  readonly metadata?: Record<string, string>;
  readonly tags?: Record<string, string>;
  readonly storageClass?: string;
  readonly serverSideEncryption?: string;
  readonly acl?: string;
}

export interface CopyObjectOptions extends PutObjectOptions {
  readonly versionId?: string;
  readonly replaceMetadata?: boolean;
}

export interface PresignedUrlOptions {
  readonly expiresInSeconds: number;
  readonly contentType?: string;
}

export interface PresignedUrl {
  readonly url: string;
  readonly expiresAt: Date;
  readonly method: 'GET' | 'PUT' | 'DELETE';
  readonly fields?: Record<string, string>;
}

export interface DeleteObjectsResult {
  readonly deleted: string[];
  readonly errors: Array<{ key: string; message: string }>;
}

// ─── Amazon S3 Connector ──────────────────────────────────────────────────

export interface S3Connector extends CloudStorageConnector {
  readonly subtype: 's3';

  /** Initiate a multipart upload */
  startMultipartUpload(
    container: string,
    key: string,
    options?: PutObjectOptions
  ): Promise<ConnectorResult<S3MultipartUpload>>;

  /** Upload a single part */
  uploadPart(
    upload: S3MultipartUpload,
    partNumber: number,
    body: CloudObjectBody
  ): Promise<ConnectorResult<S3Part>>;

  /** Complete the multipart upload */
  completeMultipartUpload(
    upload: S3MultipartUpload,
    parts: S3Part[]
  ): Promise<ConnectorResult<CloudObjectMetadata>>;

  /** Abort a multipart upload */
  abortMultipartUpload(upload: S3MultipartUpload): Promise<ConnectorResult<void>>;

  /** Restore an object from Glacier */
  restoreObject(
    container: string,
    key: string,
    days: number,
    tier?: S3RestoreTier
  ): Promise<ConnectorResult<void>>;

  /** Get a specific object version */
  getObjectVersion(
    container: string,
    key: string,
    versionId: string
  ): Promise<ConnectorResult<CloudObject>>;

  /** List all versions of an object */
  listVersions(
    container: string,
    key: string
  ): Promise<ConnectorResult<S3ObjectVersion[]>>;

  /** Set bucket lifecycle rules */
  setLifecycleRules(container: string, rules: S3LifecycleRule[]): Promise<ConnectorResult<void>>;
}

export interface S3ConnectorConfig extends ConnectorConfig {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly sessionToken?: string;
  readonly endpoint?: string;
  readonly forcePathStyle?: boolean;
  readonly defaultBucket?: string;
  readonly accelerated?: boolean;
}

export interface S3MultipartUpload {
  readonly uploadId: string;
  readonly bucket: string;
  readonly key: string;
}

export interface S3Part {
  readonly partNumber: number;
  readonly etag: string;
}

export type S3RestoreTier = 'Bulk' | 'Standard' | 'Expedited';

export interface S3ObjectVersion {
  readonly versionId: string;
  readonly key: string;
  readonly size: number;
  readonly lastModified: Date;
  readonly isLatest: boolean;
  readonly etag: string;
}

export interface S3LifecycleRule {
  readonly id: string;
  readonly prefix?: string;
  readonly enabled: boolean;
  readonly transitions?: S3LifecycleTransition[];
  readonly expiration?: S3LifecycleExpiration;
  readonly noncurrentVersionExpiration?: { noncurrentDays: number };
}

export interface S3LifecycleTransition {
  readonly days: number;
  readonly storageClass: 'STANDARD_IA' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'DEEP_ARCHIVE';
}

export interface S3LifecycleExpiration {
  readonly days?: number;
  readonly date?: Date;
  readonly expiredObjectDeleteMarker?: boolean;
}

// ─── Azure Blob Storage Connector ─────────────────────────────────────────

export interface AzureBlobConnector extends CloudStorageConnector {
  readonly subtype: 'azure-blob';

  /** Append blocks to an append blob */
  appendBlock(
    container: string,
    key: string,
    block: Buffer
  ): Promise<ConnectorResult<void>>;

  /** Get a shared access signature URL */
  generateSasUrl(
    container: string,
    key: string,
    options: AzureSasOptions
  ): Promise<ConnectorResult<PresignedUrl>>;

  /** Set blob tier (Hot/Cool/Archive) */
  setTier(
    container: string,
    key: string,
    tier: AzureBlobTier
  ): Promise<ConnectorResult<void>>;

  /** Create a blob snapshot */
  createSnapshot(
    container: string,
    key: string
  ): Promise<ConnectorResult<AzureBlobSnapshot>>;

  /** Set container-level CORS rules */
  setCorsRules(container: string, rules: AzureCorsRule[]): Promise<ConnectorResult<void>>;
}

export interface AzureBlobConnectorConfig extends ConnectorConfig {
  readonly connectionString?: string;
  readonly accountName?: string;
  readonly accountKey?: string;
  readonly sasToken?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly tenantId?: string;
  readonly endpointSuffix?: string;
  readonly defaultContainer?: string;
}

export type AzureBlobTier = 'Hot' | 'Cool' | 'Archive';

export interface AzureSasOptions {
  readonly permissions: string;
  readonly expiresOn: Date;
  readonly startsOn?: Date;
  readonly ipRange?: string;
}

export interface AzureBlobSnapshot {
  readonly snapshotId: string;
  readonly key: string;
  readonly createdAt: Date;
}

export interface AzureCorsRule {
  readonly allowedOrigins: string[];
  readonly allowedMethods: string[];
  readonly allowedHeaders: string[];
  readonly exposedHeaders: string[];
  readonly maxAgeInSeconds: number;
}

// ─── Google Cloud Storage Connector ──────────────────────────────────────

export interface GCSConnector extends CloudStorageConnector {
  readonly subtype: 'gcs';

  /** Compose multiple objects into one */
  compose(
    container: string,
    sources: string[],
    destination: string
  ): Promise<ConnectorResult<CloudObjectMetadata>>;

  /** Rewrite (copy + change storage class or key) */
  rewrite(
    source: CloudObjectPath,
    destination: CloudObjectPath,
    options?: GCSRewriteOptions
  ): Promise<ConnectorResult<CloudObjectMetadata>>;

  /** Sign a URL using a service account key */
  signUrl(
    container: string,
    key: string,
    options: GCSSignUrlOptions
  ): Promise<ConnectorResult<PresignedUrl>>;

  /** Enable uniform bucket-level access */
  setUniformBucketAccess(container: string, enabled: boolean): Promise<ConnectorResult<void>>;

  /** Set object lifecycle management rules */
  setLifecycleRules(container: string, rules: GCSLifecycleRule[]): Promise<ConnectorResult<void>>;
}

export interface GCSConnectorConfig extends ConnectorConfig {
  readonly projectId: string;
  readonly keyFilename?: string;
  readonly credentials?: {
    readonly client_email: string;
    readonly private_key: string;
  };
  readonly defaultBucket?: string;
  readonly apiEndpoint?: string;
}

export interface GCSRewriteOptions extends CopyObjectOptions {
  readonly storageClass?: string;
  readonly kmsKeyName?: string;
}

export interface GCSSignUrlOptions {
  readonly action: 'read' | 'write' | 'delete' | 'resumable';
  readonly expires: Date;
  readonly contentType?: string;
  readonly version?: 'v2' | 'v4';
}

export interface GCSLifecycleRule {
  readonly action: { type: 'Delete' | 'SetStorageClass'; storageClass?: string };
  readonly condition: {
    readonly age?: number;
    readonly createdBefore?: string;
    readonly matchesStorageClass?: string[];
    readonly numNewerVersions?: number;
  };
}

// ─── Supabase Storage Connector ───────────────────────────────────────────

export interface SupabaseStorageConnector extends CloudStorageConnector {
  readonly subtype: 'supabase-storage';

  /** Create a signed upload URL for client-side direct upload */
  createSignedUploadUrl(
    container: string,
    key: string
  ): Promise<ConnectorResult<SupabaseSignedUploadUrl>>;

  /** Move object using server-side operation */
  moveObject(
    source: CloudObjectPath,
    destination: CloudObjectPath
  ): Promise<ConnectorResult<CloudObjectMetadata>>;

  /** Get Supabase Storage bucket config (public/private) */
  getBucketConfig(container: string): Promise<ConnectorResult<SupabaseBucketConfig>>;

  /** Update bucket config */
  updateBucketConfig(
    container: string,
    config: Partial<SupabaseBucketConfig>
  ): Promise<ConnectorResult<void>>;
}

export interface SupabaseStorageConnectorConfig extends ConnectorConfig {
  readonly projectUrl: string;
  readonly serviceRoleKey: string;
  readonly defaultBucket?: string;
  readonly storageUrl?: string;
}

export interface SupabaseSignedUploadUrl {
  readonly signedUrl: string;
  readonly token: string;
  readonly path: string;
  readonly expiresAt: Date;
}

export interface SupabaseBucketConfig {
  readonly id: string;
  readonly name: string;
  readonly public: boolean;
  readonly allowedMimeTypes?: string[];
  readonly fileSizeLimit?: number;
}
