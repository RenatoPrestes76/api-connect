# @seltriva/connectors

Universal Data Connector Framework (UDCF) — a plugin-based, interface-driven framework for connecting to any data source.

## Overview

The UDCF provides a unified surface for interacting with databases, APIs, files, cloud storage, and message queues — without coupling business logic to any specific technology. Every connector follows the same Hexagonal Architecture port: `connect → discover → metadata → health → disconnect`.

```
External World                  Framework Core
──────────────────────────────────────────────────────
                                ┌─────────────────────┐
PostgreSQL ──────────────────── │  PostgreSQLConnector │
SQL Server ──────────────────── │  SQLServerConnector  │
MongoDB    ──────────────────── │  MongoDBConnector    │
           ─────────────────── ─┤                     ├──► ConnectorFactory
REST API   ──────────────────── │  RESTConnector       │      │
GraphQL    ──────────────────── │  GraphQLConnector    │      ▼
gRPC       ──────────────────── │  GRPCConnector       │  ConnectorRegistry
           ──────────────────── │                      │      │
Amazon S3  ──────────────────── │  S3Connector         │      ▼
Azure Blob ──────────────────── │  AzureBlobConnector  │  PluginRegistry
GCS        ──────────────────── │  GCSConnector        │
           ──────────────────── │                      │
Kafka      ──────────────────── │  KafkaConnector      │
RabbitMQ   ──────────────────── │  RabbitMQConnector   │
           ──────────────────── │                      │
CSV / Excel─────────────────────│  CSVConnector        │
XML / JSON ──────────────────── │  XMLConnector        │
           ──────────────────── └─────────────────────┘
```

## Packages

This package is part of the Seltriva Connect monorepo:

```
packages/connectors/
  src/
    core/            Universal Connector interface + ConnectorResult<T>
    capabilities/    CapabilitySet — runtime feature detection
    metadata/        MetadataEngine — schema/structure introspection
    discovery/       DiscoveryEngine — hierarchical resource traversal
    health/          HealthEngine — latency, pool, auth, permissions
    registry/        ConnectorRegistry — Map-based dynamic registration
    factory/         ConnectorFactory + ConnectorBuilder (fluent)
    sdk/             ConnectorPlugin SDK for third-party authors
    connectors/
      database/      8 DB connectors (PG, MSSQL, Oracle, Firebird, MySQL, MariaDB, SQLite, MongoDB)
      api/           5 API connectors (REST, SOAP, GraphQL, gRPC, Webhook)
      file/          6 File connectors (CSV, Excel, XML, JSON, TXT, ODS)
      cloud/         4 Cloud storage connectors (S3, Azure Blob, GCS, Supabase)
      queue/         3 Queue connectors (RabbitMQ, Kafka, Redis Streams)
```

## Architecture Decisions

### 1. Hexagonal Architecture (Ports & Adapters)

The `Connector` interface in `core/` is a **port** — a pure TypeScript interface with no dependencies. Each connector type in `connectors/` extends that port. Concrete implementations (adapters) live outside this package in `packages/adapters/` or third-party plugins.

This means the framework core has **zero runtime dependencies on specific databases or cloud SDKs**.

### 2. ConnectorResult<T> — Never-Throw Pattern

Every connector method returns `ConnectorResult<TData>` instead of throwing:

```typescript
export interface ConnectorResult<TData = void> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: ConnectorError;
  readonly duration?: number;
  readonly timestamp: Date;
}
```

**Why:** Thrown errors in async pipelines are invisible to the type system. `ConnectorResult` makes failure visible and composable. The caller always knows whether `data` is available.

### 3. CapabilitySet — Runtime Feature Detection

```typescript
const caps = connector.capabilities();
if (caps.has('streaming')) {
  for await (const chunk of connector.stream(...)) { ... }
} else {
  const result = await connector.readAll(...);
}
```

**Why:** Different connector configurations have different capabilities (e.g., MySQL without `LOAD DATA INFILE` permission). `CapabilitySet` lets callers adapt at runtime without `instanceof` checks.

### 4. No Switch/If in Registry

```typescript
// ✗ Anti-pattern
switch (connectorType) {
  case 'postgresql': return new PostgreSQLConnector(config);
  case 'mongodb':    return new MongoDBConnector(config);
  ...
}

// ✓ UDCF pattern
const factory = factoryRegistry.getFactory(connectorType);  // O(1) Map lookup
const result  = await factory.create(typeId, config);
```

**Why:** Every `switch` becomes a maintenance liability. The Map-based registry scales to N connector types with no code changes to the framework.

### 5. Plugin Architecture

Third parties extend the framework by implementing `ConnectorPlugin`:

```typescript
export interface ConnectorPlugin {
  id: string;
  createConnector(config): Promise<Connector>;
  validateConfig(config): Promise<ConnectorResult<PluginConfigValidationResult>>;
  describeCapabilities(config): CapabilitySet;
  configSchema: ConnectorConfigSchema;  // drives UI form generation
}
```

**Why:** Connectors for proprietary systems (SAP, Salesforce, Oracle EBS) can be authored and distributed privately as npm packages. The plugin registry discovers them by `id`; the factory delegates to them. The framework core never imports them.

### 6. Discovery Engine — Hierarchical Traversal

```
Database
  └─ Schema
       └─ Table / View
            └─ Column / Index / Constraint
```

Each connector type has a specialized `DiscoveryEngine` (relational, document, API, file, cloud, queue). The `DiscoveryReport` models the resource tree uniformly. This powers the schema browser in the Studio UI without the UI knowing which database it's talking to.

### 7. Health Engine — Structured Diagnostics

`HealthReport` captures more than a boolean status:

```typescript
interface HealthReport {
  latency:    LatencyMetrics;   // p50, p95, p99
  connection: ConnectionStatus; // pool size, active connections
  auth:       AuthenticationStatus;
  permissions: PermissionStatus[];
  warnings:   HealthWarning[];  // HIGH_LATENCY, AUTH_EXPIRING_SOON, etc.
}
```

**Why:** "Is the connector up?" is not actionable. "The connection pool is 95% saturated and the auth token expires in 2 hours" is.

## Usage

```typescript
import { ConnectorFactory, ConnectorRegistry } from '@seltriva/connectors';
import type { PostgreSQLConnector } from '@seltriva/connectors/connectors/database';

// Get a factory from your DI container
const factory: ConnectorFactory = container.resolve('ConnectorFactory');

// Create and connect
const result = await factory.createAndConnect('postgresql', {
  host: 'db.example.com',
  port: 5432,
  database: 'my_db',
  credentials: { username: 'app', password: process.env.DB_PASS },
});

if (!result.success) {
  console.error(result.error?.message);
  return;
}

const pg = result.data as PostgreSQLConnector;

// Check capabilities
const caps = pg.capabilities();
console.log(caps.hasAll(['read', 'write', 'transactions'])); // true

// Health check
const health = await pg.health();
console.log(health.data?.latency.p95);

// Discover schema
const discovery = await pg.discover();
discovery.data?.tree.children.forEach(schema =>
  console.log(schema.name, schema.children?.length, 'tables')
);

// Query
const users = await pg.query<User>('SELECT * FROM users WHERE active = $1', [true]);

// Always disconnect
await pg.disconnect();
```

## Module Sub-paths

Import only what you need for tree-shaking:

```typescript
import type { Connector }           from '@seltriva/connectors/core';
import type { CapabilitySet }       from '@seltriva/connectors/capabilities';
import type { MetadataEngine }      from '@seltriva/connectors/metadata';
import type { DiscoveryEngine }     from '@seltriva/connectors/discovery';
import type { HealthEngine }        from '@seltriva/connectors/health';
import type { ConnectorRegistry }   from '@seltriva/connectors/registry';
import type { ConnectorFactory }    from '@seltriva/connectors/factory';
import type { ConnectorPlugin }     from '@seltriva/connectors/sdk';
import type { PostgreSQLConnector } from '@seltriva/connectors/connectors/database';
import type { RESTConnector }       from '@seltriva/connectors/connectors/api';
import type { CSVConnector }        from '@seltriva/connectors/connectors/file';
import type { S3Connector }         from '@seltriva/connectors/connectors/cloud';
import type { KafkaConnector }      from '@seltriva/connectors/connectors/queue';
```

## Constraints

- **No UI.** This package has zero UI dependencies. Connector config forms are driven by `ConnectorConfigSchema` and rendered by `@seltriva/studio`.
- **No APIs.** No Express, Fastify, or HTTP server code. The framework is a library.
- **No Business Logic.** Connectors move data; they do not transform it. ETL/ELT logic lives in `packages/pipelines`.
- **No Database Schema.** No Prisma, Drizzle, or SQL migrations. This is the connector layer, not the data layer.
- **Everything Interface-Driven.** No concrete classes in this package. Implementations live in `packages/adapters` or third-party plugins.

## Connector Count

| Category | Count | Connectors |
|----------|-------|-----------|
| Database | 8 | PostgreSQL, SQL Server, Oracle, Firebird, MySQL, MariaDB, SQLite, MongoDB |
| API | 5 | REST, SOAP, GraphQL, gRPC, Webhook |
| File | 6 | CSV, Excel, XML, JSON, TXT, ODS |
| Cloud | 4 | Amazon S3, Azure Blob Storage, Google Cloud Storage, Supabase Storage |
| Queue | 3 | RabbitMQ, Apache Kafka, Redis Streams |
| **Total** | **26** | |
