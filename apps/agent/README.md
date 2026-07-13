# Sentinel — Seltriva Connect Agent

**Version:** 0.1.0 | **Codename:** Sentinel

The enterprise edge agent for Seltriva Connect. Sentinel runs in the customer's environment, connects to their local databases (read-only), discovers schema metadata, and synchronizes it to the Seltriva cloud platform.

---

## What it does

- Connects to customer databases (Postgres, MySQL, SQL Server, Oracle, SQLite, MariaDB)
- Discovers schema metadata: tables, columns, indexes, relationships
- Computes incremental diffs — transmits only what changed
- Encrypts all credentials with AES-256-GCM
- Enforces TLS 1.3 for all cloud communication
- Queues payloads locally when cloud is unreachable
- Flushes the offline queue automatically on reconnect
- Reports health metrics (CPU, memory, disk, latency) to the platform
- Supports automatic updates with signature verification and rollback
- Extensible via a plugin API

## What it does NOT do

- Write to customer databases (read-only by design)
- Store business data (metadata only)
- Process business logic or ERP-specific rules
- Expose any inbound network ports

---

## Bootstrap Sequence

```
          seltriva-agent start
                  │
  ┌───────────────▼───────────────────────────────────┐
  │  Phase 1: CONFIGURATION                            │
  │    Load agent.yaml → validate schema → resolve ENV │
  └───────────────┬───────────────────────────────────┘
                  │
  ┌───────────────▼───────────────────────────────────┐
  │  Phase 2: SECURITY                                 │
  │    Init AES-256 encryption, open credential store  │
  │    Init TLS manager, validate cloud certificate    │
  │    Init token manager                              │
  └───────────────┬───────────────────────────────────┘
                  │
  ┌───────────────▼───────────────────────────────────┐
  │  Phase 3: SERVICES                                 │
  │    Open SQLite cache, init telemetry, log manager  │
  │    Build service registry, health monitor          │
  └───────────────┬───────────────────────────────────┘
                  │
  ┌───────────────▼───────────────────────────────────┐
  │  Phase 4: CONNECTORS                               │
  │    Open database connection pools                  │
  │    Test connectivity (warn on failure, don't abort)│
  └───────────────┬───────────────────────────────────┘
                  │
  ┌───────────────▼───────────────────────────────────┐
  │  Phase 5: SCHEDULER                                │
  │    Register built-in jobs (heartbeat, sync, etc.)  │
  │    Start scheduler clock                           │
  └───────────────┬───────────────────────────────────┘
                  │
  ┌───────────────▼───────────────────────────────────┐
  │  Phase 6: PLUGINS                                  │
  │    Discover + load plugins from configured dirs    │
  └───────────────┬───────────────────────────────────┘
                  │
  ┌───────────────▼───────────────────────────────────┐
  │  Phase 7: READY                                    │
  │    Run preflight diagnostics                       │
  │    Register agent with platform (first start)      │
  │    Start heartbeat + queue flusher                 │
  │    Emit agent.ready                                │
  └───────────────────────────────────────────────────┘
                  │
            Agent is running
```

---

## CLI Quick Reference

```bash
# Install and register with the platform
seltriva-agent install

# Interactive configuration wizard
seltriva-agent configure

# Start as background daemon
seltriva-agent start

# Stop the daemon
seltriva-agent stop

# Restart the daemon
seltriva-agent restart

# Show status
seltriva-agent status

# Run diagnostic checks
seltriva-agent doctor

# Follow logs
seltriva-agent logs --follow

# Check for updates
seltriva-agent update --check

# Manually trigger a sync
seltriva-agent sync

# Manage connectors
seltriva-agent connector list
seltriva-agent connector test --id main-erp
```

---

## Module Reference

| Module           | Purpose                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `bootstrap/`     | 7-phase startup sequence, `AgentBuilder`, `AgentInstance`           |
| `runtime/`       | Process management, signal handling, PID file, graceful shutdown    |
| `configuration/` | YAML config loading, Zod validation, hot-reload                     |
| `security/`      | AES-256-GCM credentials, TLS 1.3, token rotation, update signatures |
| `connectors/`    | Database connectors (read-only), cloud bridge (Supabase)            |
| `sync/`          | Schema discovery, incremental diff, payload assembly, offline queue |
| `scheduler/`     | Manual/cron/interval/event-driven job scheduling                    |
| `health/`        | CPU/memory/disk/latency monitoring, heartbeat                       |
| `telemetry/`     | Structured logging, metrics, distributed tracing                    |
| `updates/`       | Signed auto-updates, rollback                                       |
| `plugins/`       | Plugin loading, lifecycle, capability-based API                     |
| `cache/`         | SQLite-backed schema cache and KV store                             |
| `diagnostics/`   | Diagnostic checks, preflight, support bundles                       |
| `cli/`           | Commander.js CLI commands                                           |
| `logs/`          | Log rotation, retention, streaming                                  |
| `services/`      | Heartbeat, registration, cloud bridge, queue flusher                |

---

## Configuration

The agent is configured via a YAML file. Default lookup paths (in order):

1. Path from `--config` CLI flag
2. `SELTRIVA_AGENT_CONFIG` environment variable
3. `./agent.yaml`
4. `~/.seltriva/agent.yaml`
5. `/etc/seltriva/agent.yaml`

Generate a default config:

```bash
seltriva-agent configure --non-interactive
```

See [docs/configuration-guide.md](docs/configuration-guide.md) for the full config reference.

---

## Security

All database passwords and API tokens are stored **encrypted at rest** using AES-256-GCM. The encryption key is stored in the OS keychain (preferred) or a key file.

Cloud connections enforce **TLS 1.3**. Database connections use **read-only users** — the agent never modifies customer data.

See [docs/security-guide.md](docs/security-guide.md) for the full security guide.

---

## Deployment

See [docs/deployment-guide.md](docs/deployment-guide.md) for:

- System requirements
- Installation (standalone, systemd, Docker)
- Network requirements (outbound only)
- Read-only database user setup

---

## Extension

The plugin API allows adding custom connector types, sync strategies, health checks, and CLI commands without modifying the agent.

See [docs/extension-guide.md](docs/extension-guide.md) for the plugin development guide.

---

## Package Info

| Field        | Value                            |
| ------------ | -------------------------------- |
| Name         | `@seltriva/agent`                |
| Codename     | Sentinel                         |
| Version      | `0.1.0`                          |
| Runtime      | Node.js 18+                      |
| TypeScript   | `strict: true`                   |
| Config       | YAML + Zod validation            |
| Storage      | SQLite (better-sqlite3)          |
| Cloud        | Supabase                         |
| Deployment   | Standalone daemon or Docker      |
| Architecture | Hexagonal, Modular, Plugin-ready |
