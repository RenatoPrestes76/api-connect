# CLI Guide — @seltriva/cli

The `atlas` CLI is the primary developer toolchain for building, testing, and publishing
Seltriva Connect plugins.

## Installation

```bash
npm install -g @seltriva/cli
# or
pnpm add -g @seltriva/cli
```

Verify installation:

```bash
atlas --version
# Atlas CLI v0.1.0
```

## Commands

### atlas login

Authenticate with Atlas Cloud.

```bash
atlas login
# Interactive: opens browser for OAuth2 flow

atlas login --token sc_live_abc123...
# Direct token auth (for CI/CD)
```

Options:
| Flag | Description |
|--------------|----------------------------------------|
| `--token` | API token (skips browser flow) |
| `--cloud-url`| Custom cloud URL (self-hosted) |
| `--profile` | Named profile (default: "default") |

---

### atlas logout

```bash
atlas logout
atlas logout --all      # Remove all profiles
atlas logout --profile staging
```

---

### atlas create

Scaffold a new plugin project.

```bash
atlas create my-connector
# Interactive: prompts for type, template, author, etc.

atlas create my-connector --type connector --template connector-database
# Non-interactive with defaults

atlas create com.acme.erp --type erp-profile --yes --skip-install
```

Options:
| Flag | Default | Description |
|------------------|------------------|------------------------------------|
| `--type` | (prompted) | Plugin type (one of 12) |
| `--template` | type default | Template ID from catalog |
| `--dir` | `./<name>` | Output directory |
| `--yes` / `-y` | false | Accept all defaults |
| `--skip-install` | false | Skip pnpm install after scaffold |

**Example output:**

```
✓ Created: my-connector/atlas-plugin.json
✓ Created: my-connector/package.json
✓ Created: my-connector/tsconfig.json
✓ Created: my-connector/src/index.ts
✓ Created: my-connector/tests/index.test.ts
✓ Created: my-connector/README.md
✓ Installed dependencies

Next steps:
  1. cd my-connector
  2. Edit src/index.ts — implement your connector logic
  3. atlas build
  4. atlas test
  5. atlas publish
```

---

### atlas build

Compile the plugin to the output directory.

```bash
atlas build
atlas build --production    # Minified, no sourcemaps
atlas build --watch         # Watch mode
atlas build --out dist/
```

Options:
| Flag | Description |
|----------------|------------------------------------------|
| `--production` | Minify output for distribution |
| `--watch` | Rebuild on file changes |
| `--out` | Override output directory (default: dist)|
| `--sourcemaps` | Include source maps (default: dev only) |

---

### atlas test

Run the plugin test suite.

```bash
atlas test
atlas test --coverage
atlas test --watch
atlas test --filter "MyConnector"
atlas test --reporter junit     # CI: output JUnit XML
```

Options:
| Flag | Description |
|----------------|------------------------------------------|
| `--coverage` | Generate coverage report |
| `--watch` | Watch mode (re-run on file change) |
| `--filter` | Filter by test name pattern |
| `--reporter` | Output format: default, json, junit |

---

### atlas package

Create a distributable `.atlasp` package.

```bash
atlas package
atlas package --sign --key-file ~/.atlas/signing.key
atlas package --output ./releases/
atlas package --dry-run      # Preview package contents without creating
```

Options:
| Flag | Description |
|--------------|--------------------------------------------------|
| `--sign` | Sign the package with Ed25519 key |
| `--key-file` | Path to Ed25519 private key PEM file |
| `--output` | Output directory (default: ./dist) |
| `--dry-run` | List files to be packaged without creating |

**Package contents:**

```
my-connector-1.0.0.atlasp
├── atlas-plugin.json   (manifest)
├── dist/               (compiled JS)
├── package.json
└── CHECKSUMS.sha256    (integrity file)
```

---

### atlas publish

Publish a packaged plugin to the marketplace.

```bash
atlas publish
atlas publish --channel beta
atlas publish --package ./releases/my-connector-1.0.0.atlasp
atlas publish --dry-run      # Validate only, don't upload
```

Options:
| Flag | Description |
|---------------|------------------------------------------|
| `--channel` | Release channel: stable, beta, edge |
| `--package` | Path to .atlasp file (default: auto-detect)|
| `--dry-run` | Validate without publishing |
| `--force` | Override version conflict warning |

---

### atlas doctor

Diagnose environment and project issues.

```bash
atlas doctor
atlas doctor --fix      # Auto-fix fixable issues
```

Checks performed:
| Check ID | Category | Description |
|-----------------------|---------------|----------------------------------------|
| `dc-node-version` | environment | Node.js ≥20.0.0 |
| `dc-pnpm-installed` | environment | pnpm is installed |
| `dc-atlas-auth` | auth | Logged in to Atlas Cloud |
| `dc-manifest-exists` | project | atlas-plugin.json exists |
| `dc-manifest-valid` | project | Manifest passes schema validation |
| `dc-entry-point-exists`| project | entryPoint file exists (after build) |
| `dc-deps-installed` | dependencies | node_modules installed |
| `dc-sdk-version` | dependencies | @seltriva/plugin-sdk version compatible|
| `dc-build-output` | build | dist/ directory exists and non-empty |
| `dc-network-cloud` | network | Atlas Cloud is reachable |
| `dc-signing-key` | project | Signing key found (if publish --sign) |
| `dc-ts-config` | project | tsconfig.json is valid |

---

## Configuration File (atlas.yaml)

Place `atlas.yaml` in the project root to configure CLI behavior:

```yaml
version: '1'
name: my-connector
type: connector
src: src
out: dist

build:
  target: ES2022
  minify: false
  sourcemaps: true

publish:
  channel: stable
  sign: true
  keyFile: ~/.atlas/signing.key

test:
  testDir: tests
  coverage: true
  timeout: 10000
```

---

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Setup Atlas CLI
  run: pnpm add -g @seltriva/cli

- name: Login
  run: atlas login --token ${{ secrets.ATLAS_TOKEN }}

- name: Build and test
  run: |
    atlas build --production
    atlas test --reporter junit

- name: Package and publish
  if: github.ref == 'refs/heads/main'
  run: |
    atlas package --sign --key-file ${{ secrets.SIGNING_KEY_PATH }}
    atlas publish --channel stable
```

---

## Exit Codes

| Code | Meaning                       |
| ---- | ----------------------------- |
| 0    | Success                       |
| 1    | General error / build failure |
| 2    | Validation error              |
| 3    | Authentication error          |
| 4    | Network error                 |
