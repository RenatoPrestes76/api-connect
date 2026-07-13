# @seltriva/connectors/connectors/cloud

Cloud Storage Connector interfaces — object/blob storage for S3, Azure Blob, GCS, and Supabase.

## Supported Providers

| Connector                  | Subtype            | Provider                  | Auth                        |
| -------------------------- | ------------------ | ------------------------- | --------------------------- |
| `S3Connector`              | `s3`               | Amazon S3 + S3-compatible | Access Key, Session Token   |
| `AzureBlobConnector`       | `azure-blob`       | Azure Blob Storage        | Connection String, AAD, SAS |
| `GCSConnector`             | `gcs`              | Google Cloud Storage      | Service Account Key, ADC    |
| `SupabaseStorageConnector` | `supabase-storage` | Supabase Storage          | Service Role Key            |

## Interface Hierarchy

```
Connector (universal base)
  └─ CloudStorageConnector
       ├─ S3Connector               (multipart, versioning, lifecycle, Glacier)
       ├─ AzureBlobConnector        (append blobs, tiers, snapshots, CORS)
       ├─ GCSConnector              (compose, rewrite, signed URLs, lifecycle)
       └─ SupabaseStorageConnector  (signed upload URL, bucket config)
```

## Common Pattern (all cloud connectors)

```typescript
const storage: CloudStorageConnector = ...;

// List
const listing = await storage.listObjects('my-bucket', { prefix: 'invoices/', recursive: true });

// Upload
await storage.putObject('my-bucket', 'invoices/2024.pdf', buffer, {
  contentType: 'application/pdf',
  metadata: { year: '2024' },
});

// Download stream
for await (const chunk of await storage.downloadStream('my-bucket', 'invoices/2024.pdf')) {
  writeToFile(chunk);
}

// Presigned URL (share without credentials)
const url = await storage.generatePresignedUrl('my-bucket', 'invoices/2024.pdf', 'get', {
  expiresInSeconds: 3600,
});
```

## S3 Specifics

```typescript
const s3: S3Connector = ...;

// Multipart upload (large files)
const upload = await s3.startMultipartUpload('my-bucket', 'big-file.bin');
const part1 = await s3.uploadPart(upload.data!, 1, chunk1);
const part2 = await s3.uploadPart(upload.data!, 2, chunk2);
await s3.completeMultipartUpload(upload.data!, [part1.data!, part2.data!]);

// Object versioning
const versions = await s3.listVersions('my-bucket', 'config.json');
const old = await s3.getObjectVersion('my-bucket', 'config.json', versions.data![1].versionId);
```

## Azure Blob Specifics

```typescript
const azure: AzureBlobConnector = ...;

// Append blob (logs, audit trails)
await azure.putObject('logs', 'app.log', Buffer.from(''), { contentType: 'text/plain' });
await azure.appendBlock('logs', 'app.log', Buffer.from('2024-01-01 INFO started\n'));

// Tiering
await azure.setTier('archives', 'old-report.xlsx', 'Archive');

// SAS URL
const sas = await azure.generateSasUrl('uploads', 'temp.csv', {
  permissions: 'rcw',
  expiresOn: new Date(Date.now() + 3600_000),
});
```

## GCS Specifics

```typescript
const gcs: GCSConnector = ...;

// Compose objects server-side (no download/re-upload)
await gcs.compose('my-bucket', ['part1.csv', 'part2.csv'], 'full.csv');

// Signed URL (V4)
const signedUrl = await gcs.signUrl('my-bucket', 'report.xlsx', {
  action: 'read',
  expires: new Date(Date.now() + 86400_000),
  version: 'v4',
});
```

## Supabase Storage Specifics

```typescript
const supabase: SupabaseStorageConnector = ...;

// Client-side direct upload (avoids proxying through server)
const uploadUrl = await supabase.createSignedUploadUrl('avatars', 'user-123.jpg');
// Hand uploadUrl.data to the browser client for direct PUT

// Bucket config
const config = await supabase.getBucketConfig('avatars');
if (!config.data?.public) {
  await supabase.updateBucketConfig('avatars', { public: true });
}
```

## Constraints

- No implementations in this module.
- `CloudObjectBody` accepts Buffer, Uint8Array, string, or AsyncIterable — implementors handle normalization.
- `generatePresignedUrl` with `operation: 'put'` may return additional `fields` for S3-style POST form uploads.
- `deleteObjects` returns partial success — check `errors` array even when `ConnectorResult.success` is true.
- `SupabaseStorageConnector.moveObject` is a server-side atomic rename, distinct from the copy+delete pattern in the base interface.
