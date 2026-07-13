# Marketplace Guide

## Overview

The Atlas Marketplace is the official registry for Seltriva Connect plugins.
It provides discovery, versioning, security scanning, and installation management.

## Becoming a Publisher

1. Sign up at [forge.seltriva.io](https://forge.seltriva.io)
2. Create a publisher profile (unique slug, organization name, website)
3. Generate a signing key pair:
   ```bash
   atlas login
   # The CLI prompts to generate a key pair during first publish
   ```
4. (Optional) Apply for Verified Publisher status — enables the ✓ badge

## Publishing a Plugin

### Step 1: Prepare

```bash
# Run the doctor to catch issues before publishing
atlas doctor
```

Every required check must pass:

- `dc-manifest-valid` — manifest fully compliant with spec
- `dc-build-output` — production build exists
- `dc-atlas-auth` — authenticated as a publisher
- `dc-signing-key` — signing key found (if signing)

### Step 2: Package

```bash
# Create a signed .atlasp package
atlas package --sign --key-file ~/.atlas/signing.key
```

The package includes:

- `atlas-plugin.json` — manifest with checksums and signature
- `dist/` — compiled, minified plugin code
- `CHECKSUMS.sha256` — SHA-256 hashes of all files

### Step 3: Publish

```bash
# Publish to stable channel
atlas publish --channel stable

# Publish to beta for early adopters
atlas publish --channel beta
```

### Step 4: Review

After publishing:

- **Stable channel** — undergoes automated security scanning + manual review
- **Beta/Edge channels** — automated scan only, available immediately
- Review typically takes 1-2 business days for stable

## Release Channels

| Channel  | Review         | Stability    | Who installs               |
| -------- | -------------- | ------------ | -------------------------- |
| `stable` | Manual review  | Production   | General install by default |
| `beta`   | Automated only | Pre-release  | Users who opt-in to beta   |
| `edge`   | None           | Experimental | Internal testing / CI only |

## Versioning Policy

- Versions are immutable once published
- Use semantic versioning strictly: `MAJOR.MINOR.PATCH`
- `MAJOR` bump required when: removing methods, changing method signatures, removing capabilities
- Published versions cannot be deleted — only deprecated
- Deprecated versions remain installable but show a warning

```bash
# Deprecate an old version (not delete)
# This is done via the publisher dashboard or API
```

## Package Signing

All stable channel packages **must** be signed with Ed25519.
The platform verifies the signature against the publisher's registered public key.

Key generation (first time):

```bash
atlas login
# Atlas generates and stores a key pair:
# Private: ~/.atlas/signing.key  (never upload this)
# Public: registered with your publisher profile
```

To rotate keys:

1. Generate a new key pair
2. Register new public key in publisher dashboard
3. Grace period: old key accepted for 30 days
4. After grace period: all new packages must use new key

## Security Scanning

Every published package undergoes automated scanning for:

- Forbidden dependencies (`eval`, `child_process` with write access, etc.)
- Over-declared permissions vs. capabilities
- Manifest integrity (SHA-256 of each file)
- Signature validity (Ed25519)
- Known vulnerable dependency versions (via OSV)
- Bundle size limits (5 MB max)

## Marketplace API

For programmatic marketplace access:

```typescript
import type { IMarketplaceRegistry, IMarketplacePublisher } from '@seltriva/marketplace-api';

// Search
const results = await registry.search({
  type: 'connector',
  query: 'postgres',
  sortBy: 'downloads',
  page: 1,
  pageSize: 20,
});

// Get plugin
const plugin = await registry.getPluginBySlug('com-acme-my-connector');

// Get specific version
const version = await registry.getVersion(plugin.id, '1.2.0');
```

## Metrics and Analytics

After publishing, the publisher dashboard shows:

- Install counts (total + delta per period)
- Active installs (organizations using the plugin today)
- Ratings and reviews
- Version adoption breakdown
- Platform compatibility stats

## Reviews and Ratings

- Users can submit reviews after installing a plugin
- Verified reviews: submitted by users with the plugin actively installed
- Publisher can respond to reviews (no editing or deletion of user reviews)
- Reviews are moderated for policy violations (spam, inappropriate content)

## Plugin Badges

| Badge        | Criteria                                  |
| ------------ | ----------------------------------------- |
| ✓ Verified   | Publisher identity verified by Seltriva   |
| ⭐ Featured  | Hand-picked by Seltriva editorial team    |
| 🔒 Signed    | Package has valid Ed25519 signature       |
| 🏆 Top Rated | Average rating ≥ 4.5 with ≥ 10 reviews    |
| 🔥 Trending  | Significant install growth in last 7 days |
