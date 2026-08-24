import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';

let server: Server;
let baseUrl: string;

interface JsonResponse {
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
}

async function get(path: string): Promise<JsonResponse> {
  const res = await fetch(`${baseUrl}${path}`);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, headers: res.headers, body };
}

beforeAll(async () => {
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

describe('GET /live', () => {
  it('reports alive with no dependency checks, regardless of DB state', async () => {
    const { status, body } = await get('/live');
    expect(status).toBe(200);
    expect(body['status']).toBe('alive');
    expect(typeof body['uptime']).toBe('number');
  });
});

describe('GET /ready', () => {
  it('reports ready (200) with database:ok now that a real Postgres is reachable (Sprint 46.19)', async () => {
    // Prior to Sprint 46.19, this environment never had a real Postgres
    // reachable, so this test asserted the honest not_ready/503 failure
    // path. Sprint 46.19 wired up a real docker-compose Postgres (Control
    // Plane Tenant/Organization persistence) — the same DATABASE_URL this
    // endpoint checks now genuinely connects, so the honest answer flipped.
    const { status, body } = await get('/ready');
    const checks = body['checks'] as Record<string, string>;
    expect(status).toBe(200);
    expect(body['status']).toBe('ready');
    expect(checks.database).toBe('ok');
    // Cache/queues still aren't wired up in this codebase — must be
    // reported as such, never faked as 'ok'.
    expect(checks.cache).toBe('not_configured');
    expect(checks.queues).toBe('not_configured');
  });
});

describe('GET /health', () => {
  it('reports healthy (200) with database:ok and includes a memory check', async () => {
    const { status, body } = await get('/health');
    const checks = body['checks'] as Record<string, string>;
    expect(status).toBe(200);
    expect(body['status']).toBe('healthy');
    expect(checks.database).toBe('ok');
    expect(['ok', 'warning']).toContain(checks.memory);
    expect(typeof body['version']).toBe('string');
  });
});

describe('X-Request-Id correlation (Sprint 46.17)', () => {
  it('every response carries an X-Request-Id header, generating one when the caller sends none', async () => {
    const { status, headers } = await get('/live');
    expect(status).toBe(200);
    expect(headers.get('x-request-id')).toBeTruthy();
  });

  it('echoes back a caller-supplied X-Request-Id instead of generating a new one', async () => {
    const res = await fetch(`${baseUrl}/live`, { headers: { 'x-request-id': 'test-corr-id-123' } });
    expect(res.headers.get('x-request-id')).toBe('test-corr-id-123');
  });

  it('still carries a request id on a 404 (unmatched route)', async () => {
    const res = await fetch(`${baseUrl}/this-route-does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
});
