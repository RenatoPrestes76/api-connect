# @seltriva/sdk

Official Atlas Cloud SDK for external developers.

## Installation

```bash
npm install @seltriva/sdk
```

## Usage

```typescript
import type { IAtlasClient, AtlasClientConfig } from '@seltriva/sdk';

const client: IAtlasClient = createAtlasClient({
  baseUrl: 'https://api.seltriva.io',
  apiKey: process.env.ATLAS_API_KEY,
});

// Organizations
const orgs = await client.organizations.list();

// Agents
const agents = await client.agents.list(orgId);
await client.agents.sendCommand(agentId, { type: 'trigger-sync', payload: {} });

// Metrics
const metrics = await client.metrics.query(orgId, {
  name: 'agent.cpu.percent',
  since: new Date(Date.now() - 3600_000),
  aggregation: 'avg',
});
```

## Error Handling

All methods return `SdkResult<T>` — never throw:

```typescript
const result = await client.organizations.create({ name: 'Acme', slug: 'acme' });
if (!result.ok) {
  console.error(result.error.code, result.error.message);
  return;
}
console.log(result.data.id);
```
