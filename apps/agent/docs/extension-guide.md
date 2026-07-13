# Sentinel — Extension Guide

## Overview

Sentinel's plugin API allows extending the agent without modifying its core code. Plugins can:

- Add support for new database types
- Implement custom sync strategies
- Add custom health checks
- Add telemetry exporters (forward metrics/logs to your platform)
- Add CLI commands
- Hook into sync lifecycle events

---

## Plugin Structure

```
my-plugin/
├── package.json          (plugin metadata)
├── manifest.json         (Sentinel plugin declaration)
└── src/
    └── index.ts          (AgentPlugin implementation)
```

### manifest.json

```json
{
  "id": "plugin-my-connector",
  "name": "My Custom Connector",
  "version": "1.0.0",
  "description": "Adds support for MyDB database",
  "author": "Your Name",
  "license": "MIT",
  "agentVersionRange": ">=0.1.0",
  "capabilities": ["connector"],
  "providesConnectorTypes": ["mydb"]
}
```

### Capabilities

| Capability           | What it allows                                     |
| -------------------- | -------------------------------------------------- |
| `connector`          | Register custom database connector types           |
| `sync-strategy`      | Register custom sync strategies                    |
| `health-check`       | Register custom health checks                      |
| `telemetry-exporter` | Register custom telemetry exporters                |
| `cli-command`        | Add commands to the CLI                            |
| `event-hook`         | Subscribe to sync lifecycle events                 |
| `spawn-process`      | Spawn child processes (requires explicit approval) |

---

## Implementing a Plugin

```typescript
import type { AgentPlugin, PluginManifest, PluginContext, AgentResult } from '@seltriva/agent';

export default class MyPlugin implements AgentPlugin {
  readonly manifest: PluginManifest = {
    id: 'plugin-my-connector' as any,
    name: 'My Custom Connector',
    version: '1.0.0',
    description: 'Adds support for MyDB',
    author: 'Your Name',
    license: 'MIT',
    agentVersionRange: '>=0.1.0',
    capabilities: ['connector', 'event-hook'],
    subscribesToEvents: ['sync.completed'],
  };

  private context!: PluginContext;

  async init(context: PluginContext): Promise<AgentResult<void>> {
    this.context = context;

    // Subscribe to sync events
    context.subscribe('sync.completed', async (event) => {
      context.logger.info('Sync completed', { event });
    });

    return { success: true, timestamp: new Date() };
  }

  async start(): Promise<AgentResult<void>> {
    // Begin background work
    return { success: true, timestamp: new Date() };
  }

  async stop(): Promise<AgentResult<void>> {
    // Clean up
    return { success: true, timestamp: new Date() };
  }

  async destroy(): Promise<AgentResult<void>> {
    return { success: true, timestamp: new Date() };
  }
}
```

---

## Adding a Custom Database Connector

Implement `DatabaseConnector` and register it via the plugin:

```typescript
import type {
  DatabaseConnector,
  QueryResult,
  SchemaDescriptor,
  TableDescriptor,
  ColumnDescriptor,
  AgentResult,
} from '@seltriva/agent';

class MyDBConnector implements DatabaseConnector {
  readonly id;
  readonly type = 'mydb' as any;
  readonly isConnected: boolean = false;

  constructor(connectorId: string) {
    this.id = connectorId as any;
  }

  async query<TRow>(sql: string, params?: unknown[]): Promise<AgentResult<QueryResult<TRow>>> {
    // Connect to MyDB and execute read-only query
    // Never modify data
    return {
      success: true,
      data: { rows: [], rowCount: 0, fields: [], durationMs: 0 },
      timestamp: new Date(),
    };
  }

  async discoverSchemas(): Promise<AgentResult<SchemaDescriptor[]>> {
    // Introspect available schemas
    return { success: true, data: [], timestamp: new Date() };
  }

  async discoverTables(schema: string): Promise<AgentResult<TableDescriptor[]>> {
    return { success: true, data: [], timestamp: new Date() };
  }

  async discoverColumns(schema: string, table: string): Promise<AgentResult<ColumnDescriptor[]>> {
    return { success: true, data: [], timestamp: new Date() };
  }

  // ... implement remaining interface methods
}
```

---

## Adding a Custom Health Check

```typescript
import type { HealthCheck, HealthCheckResult } from '@seltriva/agent';

class MyServiceHealthCheck implements HealthCheck {
  readonly id = 'hc-my-service';
  readonly name = 'My Service Connectivity';
  readonly kind = 'custom' as const;
  readonly critical = false;

  async execute(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // check your service
      return {
        id: this.id,
        name: this.name,
        status: 'healthy',
        durationMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err) {
      return {
        id: this.id,
        name: this.name,
        status: 'unhealthy',
        message: String(err),
        durationMs: Date.now() - start,
        checkedAt: new Date(),
      };
    }
  }
}
```

---

## Adding a Custom Telemetry Exporter

```typescript
import type {
  TelemetryExporter,
  LogRecord,
  MetricSnapshot,
  ExportedSpan,
  AgentResult,
} from '@seltriva/agent';

class MyTelemetryExporter implements TelemetryExporter {
  readonly id = 'exporter-my-service';
  readonly name = 'My Observability Platform';

  async exportLogs(records: LogRecord[]): Promise<AgentResult<void>> {
    // Ship logs to your platform
    return { success: true, timestamp: new Date() };
  }

  async exportMetrics(snapshot: MetricSnapshot): Promise<AgentResult<void>> {
    // Ship metrics to your platform
    return { success: true, timestamp: new Date() };
  }

  async exportSpans(spans: ExportedSpan[]): Promise<AgentResult<void>> {
    return { success: true, timestamp: new Date() };
  }

  async flush(): Promise<AgentResult<void>> {
    return { success: true, timestamp: new Date() };
  }

  async shutdown(): Promise<AgentResult<void>> {
    return { success: true, timestamp: new Date() };
  }
}
```

---

## Deploying a Plugin

1. Build the plugin: `npm run build`
2. Place the plugin directory in a configured plugins directory:

```yaml
# agent.yaml
plugins:
  directories:
    - '/var/lib/seltriva/plugins'
```

3. Restart the agent:

```bash
seltriva-agent restart
```

The agent discovers and loads plugins automatically on startup.

---

## Plugin Development Tips

- The `PluginContext` is the only API surface. Never import agent internals directly.
- Use `context.logger` — the logger already has the plugin ID as a binding.
- Use `context.getStorageDir()` for plugin-specific persistent storage.
- Plugins are loaded in isolation — failures in one plugin don't crash the agent.
- Test your plugin against the minimum `agentVersionRange` before publishing.

---

## Plugin Events Reference

| Event                    | Fired when                      |
| ------------------------ | ------------------------------- |
| `agent.ready`            | Agent finishes bootstrap        |
| `agent.shutdown`         | Graceful shutdown initiated     |
| `sync.started`           | A sync job begins               |
| `sync.completed`         | A sync job completes            |
| `sync.failed`            | A sync job fails                |
| `connector.connected`    | A database connector opens      |
| `connector.disconnected` | A database connector closes     |
| `queue.flushing`         | Offline queue flush started     |
| `queue.flushed`          | Offline queue flush complete    |
| `update.available`       | A newer version is available    |
| `health.degraded`        | Agent health drops to degraded  |
| `health.restored`        | Agent health returns to healthy |
