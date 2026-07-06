# Sentinel — Security Guide

## Security Architecture

Sentinel is designed with a defense-in-depth approach. No single failure exposes customer data.

```
Layer 1: TLS 1.3 — all cloud communication encrypted in transit
Layer 2: AES-256-GCM — credentials encrypted at rest
Layer 3: Read-only database users — agent cannot modify data
Layer 4: Metadata-only sync — business data never leaves the environment
Layer 5: Signed updates — update packages verified before installation
Layer 6: Token rotation — short-lived tokens with automatic rotation
Layer 7: Audit trail — all credential access logged
```

---

## Credential Storage

Database passwords and API tokens are stored encrypted using **AES-256-GCM**.

### Storage backends (in order of preference)

1. **OS Keychain** (recommended) — macOS Keychain, Windows Credential Manager, libsecret on Linux. The encryption key never touches disk.
2. **Key file** — `encryption.key` in the agent data directory. Set restrictive permissions (`chmod 600`).

### Setting credentials

```bash
# During configuration wizard
seltriva-agent configure

# Manually set a credential
seltriva-agent credential set --id main-erp-password

# List credential IDs (values never printed)
seltriva-agent credential list

# Rotate the encryption key
seltriva-agent credential rotate-key
```

### Credential rotation

The agent supports automatic credential rotation (for organizations with rotation policies):

```yaml
security:
  credentials:
    rotation_interval_hours: 168  # weekly
```

---

## TLS Configuration

In `production` and `staging` environments, **TLS 1.3 is required** for all cloud connections. TLS 1.2 is only allowed in `development`.

### Cipher suites (TLS 1.3)

- `TLS_AES_256_GCM_SHA384`
- `TLS_CHACHA20_POLY1305_SHA256`
- `TLS_AES_128_GCM_SHA256`

### Certificate validation

The agent validates the Seltriva cloud certificate chain on every connection:

- Verifies the server certificate against the system CA store
- Checks certificate expiry
- Validates Subject Alternative Names (SANs)
- Pins the Seltriva root CA in production

### mTLS (optional)

For environments requiring mutual TLS, configure client certificates:

```yaml
security:
  tls:
    min_version: "1.3"
    cert_path: "/etc/seltriva/agent.crt"
    key_path: "/etc/seltriva/agent.key"
    ca_path: "/etc/seltriva/ca.crt"
    verify_hostname: true
    reject_unauthorized: true
```

---

## Database Access Security

The agent uses **read-only database users**. The principle of least privilege applies:

1. Create a dedicated agent user per database (not a shared admin account)
2. Grant only `SELECT` and catalog read permissions
3. Do not grant `INSERT`, `UPDATE`, `DELETE`, or DDL privileges
4. Consider IP-restricting the database user to the agent host

### Verifying read-only access

The `doctor` command verifies that the database user cannot write:

```bash
seltriva-agent doctor --category connector
# ✓ main-erp: User is confirmed read-only
```

---

## Token Architecture

The agent authenticates to the Seltriva platform using a **bearer token** stored in the credential store.

**Token lifecycle:**
1. Token is issued during `seltriva-agent install`
2. Token is stored encrypted in the credential store
3. Automatic rotation runs daily (background job `job-token-rotation`)
4. During rotation: new token is obtained before old token is invalidated
5. On uninstall: token is revoked on the platform

**Token rotation config:**

```yaml
security:
  tokens:
    rotation_enabled: true
    rotation_interval_hours: 24
```

---

## Update Signature Verification

Update packages are signed using **Ed25519** with the Seltriva release key.

Before any update is applied:
1. Download the signed manifest from the update server
2. Verify the manifest signature against the embedded trusted public key
3. Download the package
4. Verify the package SHA-256 checksum against the manifest
5. Verify the package signature
6. Only then extract and apply

Disable auto-updates in air-gapped environments:

```yaml
updates:
  auto_update: false
  verify_signature: true  # still verify when applying manually
```

---

## Audit Trail

All security-relevant operations are logged to `agent-audit.log`:

- Credential accessed / created / deleted / rotated
- Token issued / rotated / revoked
- TLS handshake details
- Certificate validation results
- Signature verification results
- Unauthorized access attempts

Audit logs are append-only and separate from the main log file. Rotate with the `--keep-audit` flag to preserve audit history beyond normal retention.

---

## Data Classification

| Data Type | Stays in Environment? | Note |
|---|---|---|
| Business data (rows, values) | ✅ Yes | Never synced |
| Schema structure (table/column names, types) | ❌ Leaves | This is the metadata |
| Database credentials | ✅ Yes | Encrypted at rest, never sent |
| Agent token | ✅ Yes | Encrypted, used for cloud auth |
| Health metrics (CPU, memory) | ❌ Leaves | Aggregated, no PII |
| Logs | ✅ Yes | Stored locally, not sent by default |

---

## Network Security

The agent requires **outbound-only** access. Recommended firewall policy:

```
ALLOW  egress  tcp  dport=443  dst=connect.seltriva.com
ALLOW  egress  tcp  dport=443  dst=updates.seltriva.com
ALLOW  egress  tcp  dport=5432 dst=<database-host>   # Postgres
DENY   ingress tcp  all
```

---

## Hardening Checklist

- [ ] Run the agent as a dedicated low-privilege user (`seltriva`)
- [ ] Set `chmod 600` on `encryption.key` and TLS private key
- [ ] Use OS keychain instead of key file where available
- [ ] Use dedicated read-only database users
- [ ] Enable TLS for database connections (`ssl: true`)
- [ ] Set `reject_unauthorized: true` for TLS
- [ ] Enable automatic token rotation
- [ ] Set up log rotation and retention
- [ ] Run `seltriva-agent doctor` after any configuration change
- [ ] Monitor audit log for unauthorized access attempts
- [ ] Restrict agent data directory permissions (`chmod 700`)
