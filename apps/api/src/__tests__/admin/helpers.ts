/**
 * Test server factory for Atlas Admin integration tests.
 * No auth middleware — tests focus on route logic.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Router } from '../../http/router.js';
import { registerAdminRoutes } from '../../routes/v1/admin/index.js';
import {
  AtlasAgent,
  AgentStatusKind,
  InMemoryAtlasAgentRepository,
} from '@seltriva/agent-identity';
import {
  InMemoryHeartbeatRecordRepository,
  InMemorySyncRecordRepository,
} from '@seltriva/agent-observability';
import { InMemoryActivationTokenRepository } from '@seltriva/activation';

export interface TestAdminServer {
  server: Server;
  baseUrl: string;
  agentRepo: InMemoryAtlasAgentRepository;
  heartbeatRepo: InMemoryHeartbeatRecordRepository;
  syncRepo: InMemorySyncRecordRepository;
  activationTokenRepo: InMemoryActivationTokenRepository;
}

export async function startAdminServer(): Promise<TestAdminServer> {
  const agentRepo = new InMemoryAtlasAgentRepository();
  const heartbeatRepo = new InMemoryHeartbeatRecordRepository();
  const syncRepo = new InMemorySyncRecordRepository();
  const activationTokenRepo = new InMemoryActivationTokenRepository();

  const router = new Router();
  registerAdminRoutes(router, { agentRepo, heartbeatRepo, syncRepo, activationTokenRepo });

  const server = createServer((req, res) => router.dispatch(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return { server, baseUrl, agentRepo, heartbeatRepo, syncRepo, activationTokenRepo };
}

export async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}

/** Seed an ONLINE agent in the given repo. */
export async function seedAgent(
  repo: InMemoryAtlasAgentRepository,
  overrides: Partial<{
    companyId: string;
    hostname: string;
    connectorType: string;
    version: string;
    name: string;
    lastHeartbeat: Date | null;
  }> = {}
): Promise<AtlasAgent> {
  const agent = AtlasAgent.fromSnapshot({
    id: randomUUID(),
    companyId: overrides.companyId ?? 'co-test',
    name: overrides.name ?? 'Test Agent',
    hostname: overrides.hostname ?? 'host.local',
    machineId: randomUUID(),
    connectorType: overrides.connectorType ?? 'MSSQL',
    version: overrides.version ?? '1.0.0',
    status: AgentStatusKind.ONLINE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastHeartbeat: overrides.lastHeartbeat !== undefined ? overrides.lastHeartbeat : new Date(),
    lastSynchronization: null,
  });
  await repo.save(agent);
  return agent;
}
