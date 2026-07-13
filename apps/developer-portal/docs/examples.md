# Examples

Complete, runnable plugin examples for each of the 12 plugin types.

---

## Example 1: PostgreSQL Connector

```typescript
// atlas-plugin.json excerpt
// "type": "connector", "capabilities": ["database-read", "network-outbound"]

import type {
  IConnectorPlugin,
  PluginContext,
  PluginManifest,
  PluginResult,
  ConnectorConfig,
  ConnectorHandle,
  ConnectorTestResult,
  ConnectorCapabilities,
  PluginHealthStatus,
} from '@seltriva/plugin-sdk';
import manifest from '../atlas-plugin.json' assert { type: 'json' };

export class PostgreSQLConnector implements IConnectorPlugin {
  readonly type = 'connector' as const;
  readonly manifest: PluginManifest = manifest as PluginManifest;
  private ctx!: PluginContext;

  async init(context: PluginContext): Promise<PluginResult<void>> {
    this.ctx = context;
    return { ok: true, value: undefined };
  }

  async start(): Promise<PluginResult<void>> {
    return { ok: true, value: undefined };
  }

  async stop(): Promise<PluginResult<void>> {
    return { ok: true, value: undefined };
  }

  async destroy(): Promise<PluginResult<void>> {
    return { ok: true, value: undefined };
  }

  async health(): Promise<PluginHealthStatus> {
    return { status: 'healthy' };
  }

  async connect(config: ConnectorConfig): Promise<PluginResult<ConnectorHandle>> {
    const result = await this.ctx.http.post<{ id: string }>(`http://proxy:5433/connect`, {
      host: config.host,
      port: config.port,
      database: config.database,
    });
    if (!result.ok) return result;
    return {
      ok: true,
      value: { id: result.value.id, connectorType: 'postgresql', connectedAt: new Date() },
    };
  }

  async disconnect(handle: ConnectorHandle): Promise<PluginResult<void>> {
    await this.ctx.http.post(`http://proxy:5433/disconnect`, { id: handle.id });
    return { ok: true, value: undefined };
  }

  async test(config: ConnectorConfig): Promise<PluginResult<ConnectorTestResult>> {
    const start = Date.now();
    const result = await this.ctx.http.get<{ version: string }>(
      `http://proxy:5433/ping?host=${config.host}&port=${config.port}`
    );
    if (!result.ok) {
      return { ok: false, error: { code: 'CONNECTION_FAILED', message: 'Cannot reach host' } };
    }
    return {
      ok: true,
      value: {
        success: true,
        latencyMs: Date.now() - start,
        serverVersion: result.value.version,
      },
    };
  }

  getCapabilities(): ConnectorCapabilities {
    return {
      query: true,
      schemaDiscovery: true,
      realtime: false,
      bulk: true,
      transactions: false,
    };
  }
}

export default new PostgreSQLConnector();
```

---

## Example 2: Slack Notification Channel

```typescript
import type {
  INotificationPlugin,
  NotificationChannelDescriptor,
  NotificationPayload,
  PluginResult,
} from '@seltriva/plugin-sdk';

export class SlackNotificationPlugin implements INotificationPlugin {
  readonly type = 'notification' as const;
  // ... manifest, lifecycle ...

  getChannels(): NotificationChannelDescriptor[] {
    return [
      {
        id: 'slack',
        name: 'Slack',
        supportsRichContent: true,
        supportsBatchSend: false,
      },
    ];
  }

  async send(notification: NotificationPayload): Promise<PluginResult<void>> {
    const webhookUrl = await this.ctx.credentials.get('slack-webhook-url');
    if (!webhookUrl) {
      return {
        ok: false,
        error: { code: 'CONFIGURATION_INVALID', message: 'Slack webhook URL not configured' },
      };
    }

    const result = await this.ctx.http.post(webhookUrl, {
      text: `*${notification.title}*\n${notification.body}`,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: { code: 'OPERATION_FAILED', message: 'Failed to send Slack message' },
      };
    }

    this.ctx.metrics.increment('notifications.sent');
    return { ok: true, value: undefined };
  }

  async sendBatch(notifications: NotificationPayload[]): Promise<PluginResult<void>> {
    for (const n of notifications) {
      const result = await this.send(n);
      if (!result.ok) return result;
    }
    return { ok: true, value: undefined };
  }
}
```

---

## Example 3: OpenAI-Compatible AI Provider

```typescript
import type {
  IAIProviderPlugin,
  AIModelDescriptor,
  AICompletionRequest,
  AICompletionResponse,
  PluginResult,
} from '@seltriva/plugin-sdk';

export class OpenAIProvider implements IAIProviderPlugin {
  readonly type = 'ai-provider' as const;
  // ... manifest, lifecycle ...

  private baseUrl!: string;

  async init(context) {
    this.ctx = context;
    this.baseUrl = context.config.get<string>('baseUrl') ?? 'https://api.openai.com/v1';
    return { ok: true, value: undefined };
  }

  getModels(): AIModelDescriptor[] {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportsImages: true,
        supportsStreaming: true,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o mini',
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportsImages: true,
        supportsStreaming: true,
      },
    ];
  }

  async complete(request: AICompletionRequest): Promise<PluginResult<AICompletionResponse>> {
    const apiKey = await this.ctx.credentials.get('openai-api-key');

    const result = await this.ctx.http.post<OpenAIApiResponse>(
      `${this.baseUrl}/chat/completions`,
      {
        model: request.model,
        messages: request.messages,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!result.ok) return result as any;

    const r = result.value;
    return {
      ok: true,
      value: {
        content: r.choices[0].message.content,
        model: r.model,
        usage: { inputTokens: r.usage.prompt_tokens, outputTokens: r.usage.completion_tokens },
        finishReason: r.choices[0].finish_reason === 'length' ? 'length' : 'stop',
      },
    };
  }
}

interface OpenAIApiResponse {
  model: string;
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}
```

---

## Example 4: CSV Export Provider

```typescript
import type {
  IExportProviderPlugin,
  ExportFormat,
  ExportRequest,
  ExportResult,
  PluginResult,
} from '@seltriva/plugin-sdk';

export class CSVExportProvider implements IExportProviderPlugin {
  readonly type = 'export-provider' as const;
  // ... manifest, lifecycle ...

  getFormats(): ExportFormat[] {
    return [
      { id: 'csv', name: 'CSV', mimeType: 'text/csv', extension: '.csv', supportsStreaming: true },
      {
        id: 'tsv',
        name: 'TSV',
        mimeType: 'text/tab-separated-values',
        extension: '.tsv',
        supportsStreaming: true,
      },
    ];
  }

  async export(request: ExportRequest): Promise<PluginResult<ExportResult>> {
    const delimiter = request.formatId === 'tsv' ? '\t' : ',';
    const records = request.data as Record<string, unknown>[];

    if (!records.length) {
      return {
        ok: true,
        value: {
          formatId: request.formatId,
          content: Buffer.from(''),
          mimeType: 'text/csv',
          sizeBytes: 0,
          durationMs: 0,
        },
      };
    }

    const start = Date.now();
    const headers = Object.keys(records[0]);
    const rows = [
      headers.join(delimiter),
      ...records.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(delimiter)),
    ];

    const content = Buffer.from(rows.join('\n'), 'utf-8');
    this.ctx.metrics.increment('exports.completed');

    return {
      ok: true,
      value: {
        formatId: request.formatId,
        content,
        mimeType: request.formatId === 'tsv' ? 'text/tab-separated-values' : 'text/csv',
        sizeBytes: content.byteLength,
        durationMs: Date.now() - start,
      },
    };
  }
}
```

---

## Example 5: Testing a Connector

```typescript
import { describe, it, beforeEach, expect } from 'vitest';
import { createTestHarness, assertOk, assertFail, assertMetricRecorded } from '@seltriva/testing';
import { MyConnector } from '../src/index';

describe('MyConnector', () => {
  let harness: ReturnType<typeof createTestHarness<MyConnector>>;

  beforeEach(() => {
    harness = createTestHarness(new MyConnector(), {
      config: { host: 'localhost', port: 5432, database: 'testdb' },
      credentials: { 'db-password': 'secret' },
      mockHttp: (method, url) => {
        if (url.includes('/ping')) return { ok: true, value: { version: 'PostgreSQL 16' } };
        if (url.includes('/connect')) return { ok: true, value: { id: 'conn-123' } };
        return { ok: false, error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } };
      },
    });
  });

  it('initializes successfully', async () => {
    const result = await harness.init();
    assertOk(result);
  });

  it('reports healthy after start', async () => {
    await harness.init();
    await harness.start();
    const status = await harness.plugin.health();
    expect(status.status).toBe('healthy');
  });

  it('tests connection successfully', async () => {
    await harness.init();
    const config = { host: 'localhost', port: 5432, database: 'testdb' };
    const result = await harness.plugin.test(config);
    const testResult = assertOk(result);
    expect(testResult.success).toBe(true);
    expect(testResult.serverVersion).toBe('PostgreSQL 16');
  });

  it('fails gracefully on network error', async () => {
    const failHarness = createTestHarness(new MyConnector(), {
      config: { host: 'unreachable', port: 5432 },
      mockHttp: () => ({
        ok: false,
        error: { code: 'NETWORK_ERROR', message: 'Connection refused' },
      }),
    });
    await failHarness.init();
    const result = await failHarness.plugin.test({ host: 'unreachable', port: 5432 });
    const err = assertFail(result);
    expect(err.code).toBe('CONNECTION_FAILED');
  });
});
```
