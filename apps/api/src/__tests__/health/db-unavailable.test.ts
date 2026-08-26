import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * health-live-ready.test.ts exercises the DB-available path (the only one
 * this environment has had since Sprint 46.19 wired up a real Postgres).
 * Production must survive the database being genuinely down — this test
 * proves that path is still correct by mocking connectDB() to reject,
 * rather than actually tearing down the docker Postgres for one test file.
 */
vi.mock('../../services/prisma.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/prisma.js')>();
  return {
    ...actual,
    connectDB: vi
      .fn()
      .mockRejectedValue(
        new Error('connection refused: password authentication failed for user "seltriva"')
      ),
  };
});

let server: Server;
let baseUrl: string;

interface JsonResponse {
  status: number;
  body: Record<string, unknown>;
  text: string;
}

async function get(path: string): Promise<JsonResponse> {
  const res = await fetch(`${baseUrl}${path}`);
  const text = await res.text();
  const body = JSON.parse(text) as Record<string, unknown>;
  return { status: res.status, body, text };
}

beforeAll(async () => {
  const { createApiServer } = await import('../../server.js');
  server = createApiServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

describe('GET /health when the database is unreachable', () => {
  it('reports 503/degraded, never 200/healthy', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(503);
    expect(body['status']).toBe('degraded');
    const checks = body['checks'] as Record<string, string>;
    expect(checks.database).toBe('error');
  });

  it('never leaks the underlying connection error (message, credentials, stack) in the response', async () => {
    const { text } = await get('/health');
    expect(text).not.toContain('password authentication failed');
    expect(text).not.toContain('seltriva');
    expect(text).not.toContain('at ');
    expect(text).not.toContain('.ts:');
    expect(text).not.toContain('.js:');
  });
});

describe('GET /ready when the database is unreachable', () => {
  it('reports 503/not_ready, never 200/ready', async () => {
    const { status, body } = await get('/ready');
    expect(status).toBe(503);
    expect(body['status']).toBe('not_ready');
    const checks = body['checks'] as Record<string, string>;
    expect(checks.database).toBe('error');
    expect(checks.cache).toBe('not_configured');
    expect(checks.queues).toBe('not_configured');
  });

  it('never leaks the underlying connection error in the response', async () => {
    const { text } = await get('/ready');
    expect(text).not.toContain('password authentication failed');
    expect(text).not.toContain('seltriva');
  });
});

describe('GET /live when the database is unreachable', () => {
  it('still reports 200/alive — liveness has no DB dependency', async () => {
    const { status, body } = await get('/live');
    expect(status).toBe(200);
    expect(body['status']).toBe('alive');
  });
});
