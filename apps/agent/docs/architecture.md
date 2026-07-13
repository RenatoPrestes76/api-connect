# Sentinel — Architecture Documentation

## Overview

Sentinel is an edge agent that bridges the customer's on-premises environment with the Seltriva Connect Platform. It is a background service that runs on the customer's server or inside their infrastructure.

```
  CUSTOMER ENVIRONMENT                     SELTRIVA CLOUD
  ─────────────────────────────────────    ──────────────────────
                                     TLS 1.3
  ┌─────────────────────────────┐   ◄──────►  ┌────────────────────┐
  │        Sentinel Agent       │             │  Seltriva Connect  │
  │                             │             │  Platform          │
  │  ┌─────────────┐            │             │  (Supabase)        │
  │  │ Connectors  │ READ-ONLY  │             └────────────────────┘
  │  └──────┬──────┘            │
  │         │                   │
  │  ┌──────▼──────┐            │
  │  │   Database  │            │
  │  │  (Postgres/ │            │
  │  │  MySQL/etc) │            │
  │  └─────────────┘            │
  └─────────────────────────────┘
```

## Design Principles

1. **Read-only**: The agent never writes to customer databases.
2. **Metadata-only**: Only structural metadata (schemas, tables, columns) leaves the customer environment. Business data never leaves.
3. **Offline-first**: A local queue ensures payloads survive network outages.
4. **Modular**: Every subsystem is a replaceable module.
5. **Signed updates**: Update packages are verified before installation.
6. **Defense in depth**: TLS 1.3 + AES-256 credentials + read-only DB users + audit trail.

---

## Hexagonal Architecture

Each module exposes a port (interface) and hides its implementation. The core domain (sync engine, configuration) has no knowledge of infrastructure.

```
┌──────────────────────────────────────────────────────┐
│                   AGENT CORE                         │
│                                                      │
│   ┌─────────────┐    ┌──────────────────────────┐   │
│   │   Sync      │    │      Configuration       │   │
│   │   Engine    │    │      (Domain)            │   │
│   └──────┬──────┘    └──────────────────────────┘   │
│          │                                           │
│   ┌──────▼──────────────────────────────────────┐   │
│   │            Port Interfaces                   │   │
│   │  DatabaseConnector  |  CloudConnector        │   │
│   │  CredentialStore    |  OfflineQueue          │   │
│   │  HealthMonitor      |  SchedulerPort         │   │
│   └──────┬──────────────────────────────────────┘   │
└──────────┼───────────────────────────────────────────┘
           │ Adapters (implementations)
    ┌──────┴──────────────────────────────────────┐
    │  PostgresAdapter  │  SupabaseAdapter         │
    │  SQLiteQueueAdapter  │  NodeCronAdapter       │
    └────────────────────────────────────────────┘
```

---

## Module Dependency Graph

```
bootstrap
    ├── configuration
    ├── security
    │     ├── configuration (reads encryption_key_path)
    │     └── telemetry (audit logging)
    ├── services
    │     ├── cache
    │     ├── telemetry
    │     └── logs
    ├── connectors
    │     ├── security (TLS options, credential resolution)
    │     └── telemetry
    ├── scheduler
    │     └── sync (triggers sync jobs)
    ├── plugins
    │     ├── connectors (plugin may add connector types)
    │     └── scheduler (plugin may add jobs)
    └── runtime (signal handlers, PID file)
```

---

## Data Flow: Schema Sync

```
Scheduler (cron) ──► SyncEngine.syncIncremental(connectorId)
                            │
                            ▼
                    DatabaseConnector.discoverSchemas()
                    DatabaseConnector.discoverTables()
                    DatabaseConnector.discoverColumns()
                            │
                            ▼
                    SyncDiffEngine.fingerprint(snapshot)
                    SyncDiffEngine.diff(previous, current)
                            │
                      no changes? ──► record checkpoint, done
                            │
                      changes found
                            │
                            ▼
                    build CloudPayload (metadata only)
                    encrypt with session key
                            │
                    cloud reachable?
                     yes ──► CloudConnector.sendPayload()
                      no ──► OfflineQueue.enqueue()
                            │
                            ▼
                    SyncCheckpoint.commit()
```

---

## Data Flow: Offline Recovery

```
OfflineQueueFlusher.start()
    │
    ├── watch CloudBridgeService.getState()
    │
    state → 'connected'
    │
    OfflineQueueFlusher.flush()
        │
        ├── OfflineQueue.dequeue(batchSize)
        ├── CloudConnector.sendPayload(entry)
        │     success ──► OfflineQueue.acknowledge(id)
        │     failure ──► OfflineQueue.nack(id, reason)
        └── repeat until queue empty
```

---

## Security Architecture

```
  ┌─────────────────────────────────────────────────────────┐
  │                   TRUST BOUNDARY                         │
  │                                                         │
  │  config.yaml            CredentialStore                 │
  │  (no secrets)           (AES-256-GCM)                   │
  │       │                      │                          │
  │       │                      ▼                          │
  │       │            ┌────────────────────┐               │
  │       │            │  EncryptionProvider│               │
  │       │            │  (keytar → OS)     │               │
  │       │            └────────┬───────────┘               │
  │       │                     │                           │
  │       ▼                     ▼                           │
  │  ConfigurationProvider  Credential (decrypted, in-mem)  │
  │       │                     │                           │
  │       └─────────┬───────────┘                           │
  │                 ▼                                       │
  │          DatabaseConnector (read-only user)             │
  │                                     │                   │
  │                               TLS 1.3                   │
  │                                     ▼                   │
  │                            CloudConnector               │
  └─────────────────────────────────────────────────────────┘
```

---

## Plugin Architecture

Plugins extend the agent without modifying core code.

```
Plugin Package
    ├── manifest.json   (declares capabilities, version range)
    ├── index.js        (AgentPlugin implementation)
    └── package.json

Plugin lifecycle:
  init(context: PluginContext)  ← context is the only API surface
    │
  start()                       ← begin background work
    │
  stop()                        ← cleanup
    │
  destroy()                     ← final release
```

Plugins receive a `PluginContext` — not raw service references. This means they can only do what the context exposes (read config, get connectors, subscribe/emit events, log).

---

## Scheduler Job Map

| Job ID                     | Trigger            | Description               |
| -------------------------- | ------------------ | ------------------------- |
| `job-heartbeat`            | interval 60s       | Cloud ping                |
| `job-health-check`         | interval 30s       | System health collection  |
| `job-schema-sync`          | cron 0 _/1 _ \* \* | Full schema sync          |
| `job-incremental-sync`     | interval 5min      | Incremental diff sync     |
| `job-queue-flush`          | interval 30s       | Flush offline queue       |
| `job-token-rotation`       | cron 0 2 \* \* \*  | Rotate cloud token        |
| `job-update-check`         | interval 24h       | Check for updates         |
| `job-log-rotation`         | cron 0 0 \* \* \*  | Rotate log files          |
| `job-credential-rotation`  | configurable       | Rotate credentials        |
| `job-diagnostics-snapshot` | interval 6h        | Save diagnostics snapshot |

---

## Component Lifecycle

```
created
    │
    ▼
init(context)  ← validate dependencies, open files, NOT yet active
    │
    ▼
start()        ← begin work, open sockets, start loops
    │
    ▼
running        ← fully operational
    │
    ▼
stop()         ← stop accepting work, drain queues
    │
    ▼
destroy()      ← release all resources
```

---

## Technology Stack

| Technology              | Usage                            |
| ----------------------- | -------------------------------- |
| Node.js 18+             | Runtime                          |
| TypeScript strict       | Language                         |
| pnpm + Turborepo        | Package management               |
| Zod                     | Config schema validation         |
| YAML                    | Configuration format             |
| SQLite (better-sqlite3) | Local cache + offline queue      |
| Supabase JS SDK         | Cloud communication              |
| Commander.js            | CLI framework                    |
| Winston                 | Structured logging               |
| node-cron               | Cron scheduling                  |
| node-forge              | TLS + crypto                     |
| keytar                  | OS keychain integration          |
| systeminformation       | System metrics                   |
| Prisma                  | Optional: Postgres introspection |
