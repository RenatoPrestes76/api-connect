# Atlas Forge — Architecture Documentation

## Platform Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Atlas Forge                                  │
│                 (Developer Platform)                             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Developer    │  │ Marketplace  │  │ Documentation &      │  │
│  │ Portal       │  │ Registry     │  │ API Reference        │  │
│  │(Next.js 15)  │  │              │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                 │                                      │
│  ┌──────▼─────────────────▼──────────────────────────────────┐  │
│  │                   Atlas Cloud (ES-0009)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  Developer Toolchain                             │
│                                                                  │
│  @seltriva/cli          @seltriva/plugin-sdk                    │
│  atlas create           Plugin interfaces + manifest spec        │
│  atlas build            12 plugin type contracts                 │
│  atlas package          PluginContext API                        │
│  atlas publish                                                   │
│  atlas doctor           @seltriva/testing                        │
│  atlas test             Test harness + mock context             │
│                         Assertion helpers                        │
│  @seltriva/generator    @seltriva/validator                      │
│  Code scaffolding       Manifest validation                     │
│  12 template types      Interface validation                    │
│  Mustache templates     Security analysis                       │
│                         Performance analysis                    │
│  @seltriva/templates    @seltriva/marketplace-api               │
│  17 project templates   Marketplace contracts                   │
│                         Publisher/consumer API                  │
└─────────────────────────────────────────────────────────────────┘
```

## Package Dependency Graph

```
@seltriva/cli
  ├── @seltriva/plugin-sdk   (core types + manifest spec)
  ├── @seltriva/sdk          (cloud client)
  ├── @seltriva/validator    (validate before publish)
  └── @seltriva/generator    (scaffold new projects)
       └── @seltriva/templates

@seltriva/testing
  └── @seltriva/plugin-sdk

@seltriva/validator
  └── @seltriva/plugin-sdk

@seltriva/marketplace-api
  └── @seltriva/plugin-sdk

apps/developer-portal
  ├── @seltriva/sdk
  ├── @seltriva/plugin-sdk
  ├── @seltriva/marketplace-api
  ├── @seltriva/validator
  └── @seltriva/templates
```

## Plugin Lifecycle Architecture

```
Developer writes plugin
        │
        ▼
atlas create → generator → templates → scaffold
        │
        ▼
Developer implements interfaces from @seltriva/plugin-sdk
        │
        ▼
atlas build → TypeScript → ESModule bundle
        │
        ▼
atlas test  → @seltriva/testing → vitest
        │
        ▼
atlas doctor → @seltriva/validator (6 categories)
  ├─ manifest      (MANIFEST_001..010)
  ├─ interfaces    (exports match declared type)
  ├─ compatibility (semver ranges satisfiable)
  ├─ dependencies  (no forbidden deps)
  ├─ security      (permissions ≤ capabilities)
  └─ performance   (bundle size, init time)
        │
        ▼
atlas package → .atlasp (tar.gz)
  ├─ atlas-plugin.json   (manifest + checksums)
  ├─ dist/               (compiled code)
  └─ CHECKSUMS.sha256    (integrity)
        │
        ▼ (Ed25519 signature)
atlas publish → Marketplace Registry
        │
        ▼
Security scanning (automated)
        │
        ▼ (stable channel only)
Manual review
        │
        ▼
Published ✓
```

## Plugin Package Format (.atlasp)

A `.atlasp` file is a gzipped tar archive:

```
plugin-name-1.0.0.atlasp
├── atlas-plugin.json          # Manifest with checksums + signature
├── dist/
│   ├── index.js               # Compiled entry point (ESModule)
│   └── index.js.map           # Source map (optional)
└── CHECKSUMS.sha256           # SHA-256 of each included file
```

Manifest is updated during packaging to include:
- `checksums.sha256`: SHA-256 of the compiled entry point
- `signature`: Ed25519 signature of the manifest JSON hash

## Validator Architecture

The `@seltriva/validator` package runs 6 validation categories in sequence:

```
ValidationTarget (manifest + packageDir + builtEntryPoint)
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ Category 1: Manifest (weight: 30%)                            │
│  MANIFEST_001 — reverse-domain ID format                      │
│  MANIFEST_002 — semantic version                              │
│  MANIFEST_003 — SPDX license identifier                       │
│  MANIFEST_004 — valid plugin type                             │
│  MANIFEST_005/006 — platform/SDK semver ranges                │
│  MANIFEST_007/008 — entryPoint + runtime.nodeVersion          │
│  MANIFEST_009/010 — description length + icon (warnings)      │
│                                                               │
│ Category 2: Interfaces (weight: 25%)                          │
│  Exports match declared plugin type's required interface      │
│                                                               │
│ Category 3: Compatibility (weight: 15%)                       │
│  platformVersion / sdkVersion satisfiable against env         │
│                                                               │
│ Category 4: Dependencies (weight: 10%)                        │
│  No forbidden node modules; peer deps satisfied               │
│                                                               │
│ Category 5: Security (weight: 15%)                            │
│  SEC_001..005 — permissions ≤ capabilities                    │
│  High-risk permissions require justification                  │
│                                                               │
│ Category 6: Performance (weight: 5%)                          │
│  Bundle ≤ 5MB; init time ≤ 5s; memory ≤ 256MB               │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
ValidationReport { valid, score (0-100), categories, summary }
```

## Marketplace Architecture

```
Publisher (developer)           Registry                Consumer (enterprise)
      │                            │                           │
      │ PublishRequest             │                           │
      │ (manifest + .atlasp)       │                           │
      │───────────────────────────►│                           │
      │                            │ SecurityScan()            │
      │                            │ SignatureVerify()         │
      │                            │ DependencyAudit()         │
      │                            │                           │
      │                            │ (stable: manual review)  │
      │ PublishResult              │                           │
      │◄───────────────────────────│                           │
      │                            │                           │
      │                            │◄──────────────────────────│
      │                            │      search() / install() │
      │                            │                           │
      │                            │ VerifySignature()         │
      │                            │ Download .atlasp          │
      │                            │ InstallRecord             │
      │                            │───────────────────────────►│
```

## Security Architecture

```
Package signing (Ed25519):
  Developer private key   →   signs manifest hash
  Developer public key    →   registered with publisher profile
  Platform                →   verifies before serving package

Transport security:
  atlas CLI  ──TLS 1.3──►  Marketplace API  ──TLS 1.3──►  Storage

Plugin sandbox:
  Plugin code runs inside platform's module loader
  context.http (allowlisted outbound)
  context.storage (isolated namespace)
  context.credentials (encrypted KV)
  NO direct fs, NO direct net, NO child_process
```
