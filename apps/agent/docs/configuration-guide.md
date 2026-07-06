# Sentinel — Configuration Guide

## Configuration File

The agent is configured via a YAML file. Generate a starter file:

```bash
seltriva-agent configure
# or for non-interactive environments:
seltriva-agent configure --non-interactive
```

Default lookup order:
1. `--config <path>` CLI flag
2. `SELTRIVA_AGENT_CONFIG` env var
3. `./agent.yaml`
4. `~/.seltriva/agent.yaml`
5. `/etc/seltriva/agent.yaml`

---

## Complete Configuration Reference

```yaml
# ─── Agent ────────────────────────────────────────────
agent:
  # Unique identifier for this agent instance (assigned on install)
  id: "agent-01j9a..."
  # Human-readable name shown in the Seltriva dashboard
  name: "production-server-01"
  # Seltriva Connect Platform URL
  platform_url: "https://connect.seltriva.com"
  # Environment: development | staging | production
  environment: "production"
  # Agent data directory (cache, offline queue, PID file)
  data_dir: "/var/lib/seltriva"
  # Temporary working directory
  work_dir: "/tmp/seltriva"

# ─── Security ─────────────────────────────────────────
security:
  tls:
    # Minimum TLS version. Must be "1.3" in production.
    min_version: "1.3"
    # Optional: mTLS client certificate paths
    # cert_path: "/etc/seltriva/agent.crt"
    # key_path:  "/etc/seltriva/agent.key"
    # ca_path:   "/etc/seltriva/ca.crt"
    verify_hostname: true
    reject_unauthorized: true

  credentials:
    # Path to AES-256 encryption key file
    # Leave empty to use OS keychain (recommended)
    encryption_key_path: ""
    # How often to rotate the encryption key (0 = disabled)
    rotation_interval_hours: 168
    # Use OS keychain if available (macOS/Windows/Linux libsecret)
    use_keychain: true

  tokens:
    rotation_enabled: true
    rotation_interval_hours: 24

# ─── Database Connectors ──────────────────────────────
connectors:
  database:
    - id: "main-erp"
      name: "Main ERP Database"
      type: "postgres"      # postgres | mysql | mssql | oracle | sqlite | mariadb
      host: "db.internal"
      port: 5432
      database: "erp_production"
      # Reference to credential stored in CredentialStore (not the password itself)
      credential_id: "main-erp-db-password"
      ssl: true
      pool_size: 5
      connect_timeout_ms: 10000
      enabled: true

    # Add more connectors as needed
    # - id: "warehouse"
    #   type: "mysql"
    #   ...

# ─── Sync ─────────────────────────────────────────────
sync:
  # manual | scheduled | incremental | event-driven
  mode: "incremental"
  # Base sync interval for incremental mode (ms)
  interval_ms: 300000   # 5 minutes
  # Maximum records per sync batch
  batch_size: 1000
  # Maximum retry attempts on failure
  max_retries: 5
  # Delay between retries (ms, exponential backoff applied)
  retry_delay_ms: 1000
  # Directory for storing sync checkpoints
  checkpoint_dir: "/var/lib/seltriva/checkpoints"

  offline_queue:
    enabled: true
    # Maximum queued payloads
    max_size: 10000
    # SQLite file path for persistent queue
    persist_path: "/var/lib/seltriva/queue"
    # How often to attempt flushing (ms)
    flush_interval_ms: 30000
    # Discard entries older than this
    max_age_hours: 48

# ─── Scheduler ────────────────────────────────────────
scheduler:
  enabled: true
  # IANA timezone for cron expressions
  timezone: "UTC"

  jobs:
    - id: "job-schema-sync"
      name: "Full Schema Sync"
      trigger: "cron"
      expression: "0 */1 * * *"  # hourly
      enabled: true
      timeout_ms: 300000

    - id: "job-incremental-sync"
      name: "Incremental Sync"
      trigger: "interval"
      interval_ms: 300000
      enabled: true
      timeout_ms: 120000

# ─── Health ───────────────────────────────────────────
health:
  # How often to collect health metrics (ms)
  check_interval_ms: 30000
  # How often to send heartbeat to cloud (ms)
  heartbeat_interval_ms: 60000

  thresholds:
    # Warn above these thresholds
    cpu_percent: 85
    memory_percent: 90
    disk_percent: 95
    # Warn if cloud latency exceeds this
    latency_ms: 5000

# ─── Telemetry ────────────────────────────────────────
telemetry:
  # fatal | error | warn | info | debug | trace
  log_level: "info"
  metrics_enabled: true
  trace_enabled: false

  # Optional: external telemetry exporters
  exporters: []
  # Example OTLP exporter:
  # exporters:
  #   - type: "otlp"
  #     endpoint: "http://otel-collector:4318"
  #     credential_id: "otel-api-key"

# ─── Automatic Updates ────────────────────────────────
updates:
  # stable | beta | edge
  channel: "stable"
  # Automatically apply updates without prompting
  auto_update: false
  # How often to check for updates (hours)
  check_interval_hours: 24
  # Always verify Ed25519 signature on update packages
  verify_signature: true
  # Seltriva update server (do not change unless self-hosted)
  update_server_url: "https://updates.seltriva.com"
  # Back up current installation before applying update
  backup_before_update: true

# ─── Cache ────────────────────────────────────────────
cache:
  enabled: true
  # Maximum cache size in MB
  max_size_mb: 256
  # Default TTL for KV cache entries (seconds)
  ttl_seconds: 3600
  # SQLite database path
  persist_path: "/var/lib/seltriva/cache"

# ─── Plugins ──────────────────────────────────────────
plugins:
  enabled: true
  # Directories to scan for plugins
  directories:
    - "/var/lib/seltriva/plugins"
    - "./plugins"
  # Automatically load all discovered plugins
  auto_load: true
  # Optional: whitelist specific plugin IDs
  # allowed_ids:
  #   - "plugin-my-connector"

# ─── Logs ─────────────────────────────────────────────
logs:
  directory: "/var/lib/seltriva/logs"
  # Rotate when file reaches this size
  max_file_size_mb: 50
  # Keep at most N log files per kind
  max_files: 30
  # Compress rotated files with gzip
  compress_old_files: true
  # Delete files older than N days
  retention_days: 30
```

---

## Environment Variable Overrides

Any configuration value can be overridden with an environment variable using the pattern `SELTRIVA_AGENT_<SECTION>_<KEY>` (uppercase, underscores):

```bash
SELTRIVA_AGENT_AGENT_ENVIRONMENT=staging
SELTRIVA_AGENT_TELEMETRY_LOG_LEVEL=debug
SELTRIVA_AGENT_SYNC_INTERVAL_MS=60000
```

---

## Connector Types

| Type | Value | Notes |
|---|---|---|
| PostgreSQL | `postgres` | Requires pg schema access |
| MySQL | `mysql` | Requires information_schema access |
| SQL Server | `mssql` | Requires sys catalog access |
| Oracle | `oracle` | Requires ALL_TABLES access |
| SQLite | `sqlite` | Local file — no credentials needed |
| MariaDB | `mariadb` | Same as MySQL |

---

## Storing Credentials

Database passwords are NEVER stored in the YAML file. Use the credential command:

```bash
# Store a database password
seltriva-agent credential set --id main-erp-db-password

# The YAML connector references the credential by ID:
# credential_id: "main-erp-db-password"
```

---

## Validating Configuration

```bash
# Validate config without starting
seltriva-agent configure --validate

# The doctor command also validates config
seltriva-agent doctor --category configuration
```
