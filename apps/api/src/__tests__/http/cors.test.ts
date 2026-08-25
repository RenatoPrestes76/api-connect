import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiServer } from '../../server.js';

let server: Server;
let baseUrl: string;
let originalCorsEnv: string | undefined;

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

beforeEach(() => {
  originalCorsEnv = process.env['CORS_ALLOWED_ORIGINS'];
});

afterEach(() => {
  if (originalCorsEnv === undefined) {
    delete process.env['CORS_ALLOWED_ORIGINS'];
  } else {
    process.env['CORS_ALLOWED_ORIGINS'] = originalCorsEnv;
  }
});

describe('CORS — CORS_ALLOWED_ORIGINS unset (dev default, Sprint 46.5 behavior)', () => {
  it('reflects "*" on a real JSON response with no configured allowlist', async () => {
    delete process.env['CORS_ALLOWED_ORIGINS'];
    const res = await fetch(`${baseUrl}/live`, { headers: { Origin: 'http://localhost:3005' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('reflects "*" on an OPTIONS preflight with no configured allowlist', async () => {
    delete process.env['CORS_ALLOWED_ORIGINS'];
    const res = await fetch(`${baseUrl}/live`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3005' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('CORS — CORS_ALLOWED_ORIGINS configured with multiple production origins', () => {
  const app = 'https://app.atlasappruntime.com.br';
  const admin = 'https://admin.atlasappruntime.com.br';

  it('reflects the exact calling origin on a real JSON response, not just allowlist[0]', async () => {
    process.env['CORS_ALLOWED_ORIGINS'] = `${app},${admin}`;

    const asApp = await fetch(`${baseUrl}/live`, { headers: { Origin: app } });
    expect(asApp.headers.get('access-control-allow-origin')).toBe(app);

    // The regression this guards: before the origin was threaded through
    // json()'s response headers, every real (non-preflight) response fell
    // back to allowlist[0] regardless of which allowed origin actually
    // called — so a second configured origin's browser would pass
    // preflight, then have its real response rejected client-side.
    const asAdmin = await fetch(`${baseUrl}/live`, { headers: { Origin: admin } });
    expect(asAdmin.headers.get('access-control-allow-origin')).toBe(admin);
  });

  it('reflects the exact calling origin on an OPTIONS preflight for either configured origin', async () => {
    process.env['CORS_ALLOWED_ORIGINS'] = `${app},${admin}`;

    const asApp = await fetch(`${baseUrl}/live`, { method: 'OPTIONS', headers: { Origin: app } });
    expect(asApp.headers.get('access-control-allow-origin')).toBe(app);

    const asAdmin = await fetch(`${baseUrl}/live`, {
      method: 'OPTIONS',
      headers: { Origin: admin },
    });
    expect(asAdmin.headers.get('access-control-allow-origin')).toBe(admin);
  });

  it('does not reflect an origin outside the allowlist — falls back to allowlist[0] instead', async () => {
    process.env['CORS_ALLOWED_ORIGINS'] = `${app},${admin}`;
    const res = await fetch(`${baseUrl}/live`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    const allowed = res.headers.get('access-control-allow-origin');
    expect(allowed).not.toBe('https://evil.example.com');
    expect(allowed).toBe(app);
  });

  it('never emits a bare "*" once an allowlist is configured, even with no Origin header sent', async () => {
    process.env['CORS_ALLOWED_ORIGINS'] = `${app},${admin}`;
    const res = await fetch(`${baseUrl}/live`);
    expect(res.headers.get('access-control-allow-origin')).toBe(app);
  });

  it('still allows a local dev origin alongside production origins when explicitly listed', async () => {
    const devOrigin = 'http://localhost:3005';
    process.env['CORS_ALLOWED_ORIGINS'] = `${devOrigin},${app},${admin}`;
    const res = await fetch(`${baseUrl}/live`, { headers: { Origin: devOrigin } });
    expect(res.headers.get('access-control-allow-origin')).toBe(devOrigin);
  });
});
