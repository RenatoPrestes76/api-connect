import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';

/**
 * ATLAS 46.20 — Production Deployment & Runtime Readiness Gate, Fase 7.
 *
 * A single, explicit smoke-test pass over the production server's baseline
 * HTTP contract: health/readiness, an authenticated endpoint, an
 * unauthenticated endpoint, an invalid-tenant lookup, an invalid payload, an
 * invalid HTTP method, and a nonexistent resource. Individual route test
 * files already cover these cases in depth for their own module — this file
 * exists so the production gate's checklist has one place proving every
 * item on it, rather than relying on that coverage being scattered.
 */

let server: Server;
let baseUrl: string;

interface Resp {
  status: number;
  body: Record<string, unknown>;
}

async function req(
  method: string,
  path: string,
  opts: { body?: unknown; headers?: Record<string, string> } = {}
): Promise<Resp> {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await fetch(`${baseUrl}${path}`, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

const SEED_EMAIL = 'admin@atlasconnect.com.br';
const SEED_PASSWORD = 'root102030';
let auth: Record<string, string>;

beforeAll(async () => {
  server = createApiServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;

  const login = await req('POST', '/admin/auth/login', {
    body: { email: SEED_EMAIL, password: SEED_PASSWORD },
    headers: { 'x-forwarded-for': '10.20.0.1' },
  });
  auth = { Authorization: `Bearer ${login.body['accessToken'] as string}` };
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

describe('Health / readiness', () => {
  it('GET /health is 200/healthy against the real configured database', async () => {
    const { status, body } = await req('GET', '/health');
    expect(status).toBe(200);
    expect(body['status']).toBe('healthy');
  });

  it('GET /ready is 200/ready against the real configured database', async () => {
    const { status, body } = await req('GET', '/ready');
    expect(status).toBe(200);
    expect(body['status']).toBe('ready');
  });
});

describe('Authenticated vs. unauthenticated endpoint', () => {
  it('an authenticated request to a protected Control Plane route succeeds', async () => {
    const { status } = await req('GET', '/admin/control-plane/tenants', { headers: auth });
    expect(status).toBe(200);
  });

  it('the same route with no credentials is rejected, not silently allowed', async () => {
    const { status, body } = await req('GET', '/admin/control-plane/tenants');
    expect(status).toBe(401);
    expect(body['error']).toBeDefined();
  });

  it('the same route with a garbage bearer token is rejected', async () => {
    const { status } = await req('GET', '/admin/control-plane/tenants', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(status).toBe(401);
  });
});

describe('Invalid tenant / nonexistent resource', () => {
  it('a lookup by a well-formed but nonexistent tenant id returns a deterministic 404, not a 500', async () => {
    const { status, body } = await req(
      'GET',
      '/admin/control-plane/tenants/does-not-exist-at-all',
      { headers: auth }
    );
    expect(status).toBe(404);
    expect(body['error']).toMatchObject({ code: 'TENANT_NOT_FOUND' });
  });

  it('a lookup by a well-formed but nonexistent organization id returns a deterministic 404, not a 500', async () => {
    const { status, body } = await req(
      'GET',
      '/admin/control-plane/organizations/does-not-exist-at-all',
      { headers: auth }
    );
    expect(status).toBe(404);
    expect(body['error']).toMatchObject({ code: 'ORGANIZATION_NOT_FOUND' });
  });
});

describe('Invalid payload', () => {
  it('creating a tenant without required fields is rejected with 400, not a crash', async () => {
    const { status, body } = await req('POST', '/admin/control-plane/tenants', {
      body: { primaryContactEmail: 'no-name-or-slug@example.com' },
      headers: auth,
    });
    expect(status).toBe(400);
    expect(body['error']).toMatchObject({ code: 'MISSING_FIELDS' });
  });

  it('a malformed JSON body is rejected cleanly, not with an unhandled exception', async () => {
    const res = await fetch(`${baseUrl}/admin/control-plane/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: '{not valid json',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('Invalid HTTP method / unmatched route', () => {
  it('an unregistered method+path combination is a deterministic 404, not a 500', async () => {
    const { status, body } = await req('DELETE', '/health');
    expect(status).toBe(404);
    expect(body['error']).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('a completely nonexistent path is a deterministic 404', async () => {
    const { status } = await req('GET', '/this-endpoint-was-never-registered');
    expect(status).toBe(404);
  });
});

describe('No secret/internal detail leaks in error responses', () => {
  it('a 404 error body never contains a stack trace or file path', async () => {
    const { body } = await req('GET', '/this-endpoint-was-never-registered');
    const text = JSON.stringify(body);
    expect(text).not.toContain('.ts:');
    expect(text).not.toContain('.js:');
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgresql://');
  });
});
