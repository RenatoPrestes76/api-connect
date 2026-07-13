/**
 * Test server factory for Atlas Control Plane integration tests.
 * Wires in-memory repositories so no real database is needed.
 */
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { Router } from '../../http/router.js';
import { authMiddleware } from '../../middleware/auth.js';
import { createAgentAuthMiddleware } from '../../middleware/agent-auth.js';
import { registerAtlasRoutes } from '../../routes/v1/atlas/index.js';
import { InMemoryAtlasAgentRepository } from '@seltriva/agent-identity';
import {
  InMemoryProvisioningTokenRepository,
  InMemoryAgentAccessTokenRepository,
  ProvisioningToken,
} from '@seltriva/agent-provisioning';
import {
  InMemoryHeartbeatRecordRepository,
  InMemorySyncRecordRepository,
} from '@seltriva/agent-observability';
import { InMemoryActivationTokenRepository } from '@seltriva/activation';

const FUTURE = new Date(Date.now() + 86_400_000);

export interface TestAtlasServer {
  server: Server;
  baseUrl: string;
  agentRepo: InMemoryAtlasAgentRepository;
  tokenRepo: InMemoryProvisioningTokenRepository;
  accessTokenRepo: InMemoryAgentAccessTokenRepository;
  heartbeatRepo: InMemoryHeartbeatRecordRepository;
  syncRepo: InMemorySyncRecordRepository;
  activationTokenRepo: InMemoryActivationTokenRepository;
}

export async function startTestServer(): Promise<TestAtlasServer> {
  const agentRepo = new InMemoryAtlasAgentRepository();
  const tokenRepo = new InMemoryProvisioningTokenRepository();
  const accessTokenRepo = new InMemoryAgentAccessTokenRepository();
  const heartbeatRepo = new InMemoryHeartbeatRecordRepository();
  const syncRepo = new InMemorySyncRecordRepository();
  const activationTokenRepo = new InMemoryActivationTokenRepository();

  const router = new Router();
  router.use(authMiddleware);
  router.use(createAgentAuthMiddleware(accessTokenRepo));
  registerAtlasRoutes(router, {
    agentRepo,
    tokenRepo,
    accessTokenRepo,
    heartbeatRepo,
    syncRepo,
    activationTokenRepo,
  });

  const server = createServer((req, res) => router.dispatch(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    server,
    baseUrl,
    agentRepo,
    tokenRepo,
    accessTokenRepo,
    heartbeatRepo,
    syncRepo,
    activationTokenRepo,
  };
}

export async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

export async function seedToken(
  repo: InMemoryProvisioningTokenRepository,
  companyId: string = 'co-test'
): Promise<string> {
  const { token, rawToken } = ProvisioningToken.create(
    { companyId, description: 'integration test', expiresAt: FUTURE },
    () => `tok-${Math.random()}`
  );
  await repo.create(token);
  return rawToken;
}

export async function provisionAgent(
  baseUrl: string,
  rawToken: string,
  overrides: Partial<{
    machineId: string;
    hostname: string;
    connectorType: string;
    version: string;
    name: string;
    companyId: string;
  }> = {}
): Promise<{ agentId: string; accessToken: string }> {
  const res = await fetch(`${baseUrl}/api/v1/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawToken,
      machineId: 'MACHINE-INTTEST-001',
      hostname: 'inttest.local',
      connectorType: 'MSSQL',
      version: '1.0.0',
      name: 'Integration Test Agent',
      companyId: 'co-test',
      ...overrides,
    }),
  });
  if (!res.ok) throw new Error(`Provision failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: { agentId: string; accessToken: string } };
  return body.data;
}
