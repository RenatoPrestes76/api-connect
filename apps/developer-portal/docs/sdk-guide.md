# SDK Guide — @seltriva/sdk

The `@seltriva/sdk` package is the official Atlas Cloud client library.
Use it to manage organizations, agents, plugins, and configuration from your applications.

## Installation

```bash
npm install @seltriva/sdk
# or
pnpm add @seltriva/sdk
```

## Authentication

### API Key (recommended for server-side)

```typescript
import type { IAtlasClient, AtlasClientConfig } from '@seltriva/sdk';

const config: AtlasClientConfig = {
  baseUrl: 'https://api.seltriva.io',
  apiKey: process.env.ATLAS_API_KEY,
  organizationId: process.env.ATLAS_ORG_ID as any,
};
```

### JWT Session (for user-authenticated browser apps)

```typescript
const config: AtlasClientConfig = {
  baseUrl: 'https://api.seltriva.io',
  accessToken: session.accessToken,
};
```

## Organizations

```typescript
// List all organizations
const result = await client.organizations.list({ page: 1, pageSize: 20 });
if (!result.ok) throw new Error(result.error.message);
const { data, total } = result.data;

// Create organization
const org = await client.organizations.create({
  name: 'ACME Corp',
  slug: 'acme-corp',
});

// Invite a member
await client.organizations.inviteMember(orgId, {
  email: 'engineer@acme.com',
  role: 'DEVELOPER',
});
```

## Agents

```typescript
// List agents
const agents = await client.agents.list(orgId);

// Send a command
await client.agents.sendCommand(agentId, {
  type: 'trigger-sync',
  payload: { connectorId: 'production-db' },
});

// Get heartbeat history
const history = await client.agents.getHeartbeatHistory(agentId, 10);
```

## Plugins

```typescript
// Browse marketplace
const plugins = await client.plugins.list({
  category: 'database-connectors',
  search: 'postgres',
});

// Install a plugin
await client.plugins.install(orgId, pluginId, '1.0.0');

// Publish a plugin (from CLI, not directly)
// Use: atlas publish
```

## Configuration

```typescript
// Get all config for a workspace
const config = await client.configuration.getAll(workspaceId);

// Set a value
await client.configuration.set(workspaceId, 'sync.batchSize', 500);

// Read a secret (server-side only)
const secret = await client.configuration.get(workspaceId, 'api.key');
```

## Metrics

```typescript
// Query time-series metrics
const metrics = await client.metrics.query(orgId, {
  name: 'agent.cpu.percent',
  since: new Date(Date.now() - 24 * 60 * 60 * 1000),
  aggregation: 'avg',
});

// Agent summary
const summary = await client.metrics.getAgentSummary(agentId, '24h');
console.log(`CPU avg: ${summary.data.avgCpuPercent}%`);
```

## Webhooks

```typescript
// Register a webhook
const webhook = await client.webhooks.register(orgId, {
  url: 'https://my-service.com/webhooks/atlas',
  secret: process.env.WEBHOOK_SECRET!,
  events: ['agent.status.changed', 'plugin.installed'],
});

// Verify incoming webhook signature
const isValid = client.webhooks.verifySignature(
  rawBody,
  req.headers['x-atlas-signature'] as string,
  process.env.WEBHOOK_SECRET!
);
```

## Realtime Subscriptions

```typescript
// Subscribe to organization events (Supabase Realtime)
const unsubscribe = atlas.subscribeToOrganization(orgId, (event) => {
  console.log(`[${event.topic}]`, event.payload);
});

// Subscribe to a specific agent
const unsubscribeAgent = atlas.subscribeToAgent(agentId, (event) => {
  if (event.topic === 'agent.heartbeat') {
    updateAgentStatus(event.payload);
  }
});

// Cleanup
unsubscribe();
unsubscribeAgent();
```

## Error Handling

All SDK methods return `SdkResult<T>` — never throw.

```typescript
const result = await client.organizations.create({ name: 'Test', slug: 'test' });

if (!result.ok) {
  switch (result.error.code) {
    case 'VALIDATION_ERROR':
      console.error('Validation failed:', result.error.message);
      break;
    case 'UNAUTHORIZED':
      console.error('Check your API key');
      break;
    case 'RATE_LIMITED':
      console.error('Rate limited — retry after delay');
      break;
    default:
      console.error('Unexpected error:', result.error);
  }
  return;
}

console.log('Created:', result.data.id);
```

## SdkResult Type

```typescript
type SdkResult<T> = { ok: true; data: T } | { ok: false; error: SdkError };

type SdkErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';
```

## API Scopes

When creating API keys via the Atlas Cloud dashboard, grant the minimum required scopes:

| Scope                 | Description                      |
| --------------------- | -------------------------------- |
| `agents:read`         | Read agent status and history    |
| `agents:write`        | Send commands to agents          |
| `organizations:read`  | Read org metadata and members    |
| `organizations:write` | Manage organizations and invites |
| `plugins:read`        | Browse and read plugin details   |
| `plugins:write`       | Install/uninstall plugins        |
| `configuration:read`  | Read workspace configuration     |
| `configuration:write` | Write workspace configuration    |
| `metrics:read`        | Read telemetry and metrics       |
| `webhooks:write`      | Manage webhook registrations     |
