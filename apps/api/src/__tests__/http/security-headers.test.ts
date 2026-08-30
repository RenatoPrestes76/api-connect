import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { Router } from '../../http/router.js';
import { securityHeaders } from '../../middleware/security-headers.js';
import { json } from '../../http/router.js';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const router = new Router();
  router.use(securityHeaders);
  router.get('/probe', async (_ctx, res) => {
    json(res, { ok: true });
  });
  server = createServer((req, res) => void router.dispatch(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

// ATLAS 46.26 — final hardening, Part 11: re-verified the existing baseline
// headers and confirmed the one addition (Cache-Control: no-store) this
// sprint made, so a future change to this middleware has a real regression
// test rather than relying on the CORS suite's incidental coverage alone.
describe('securityHeaders — baseline headers on every response', () => {
  it('sets frame, content-type, XSS, referrer, CSP, HSTS, and cache headers', async () => {
    const res = await fetch(`${baseUrl}/probe`);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'self'; frame-ancestors 'none'"
    );
    expect(res.headers.get('strict-transport-security')).toBe(
      'max-age=63072000; includeSubDomains'
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
