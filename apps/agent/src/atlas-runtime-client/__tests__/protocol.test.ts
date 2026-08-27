import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import { canonicalHeartbeatPayload, canonicalAuthTokenPayload, signPayload } from '../protocol.js';

describe('canonicalHeartbeatPayload', () => {
  it("produces the exact JSON key order apps/api's server recomputes and byte-compares", () => {
    const payload = canonicalHeartbeatPayload({
      runtimeId: 'rt_123',
      version: '1.2.0',
      memory: 256,
      cpu: 4.2,
      status: 'ACTIVE',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(payload).toBe(
      '{"runtimeId":"rt_123","version":"1.2.0","memory":256,"cpu":4.2,"status":"ACTIVE","timestamp":"2026-01-01T00:00:00.000Z"}'
    );
  });

  it("defaults an omitted status to null, matching the server's `status ?? null`", () => {
    const payload = canonicalHeartbeatPayload({
      runtimeId: 'rt_123',
      version: '1.2.0',
      memory: 256,
      cpu: 4.2,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(payload).toContain('"status":null');
  });
});

describe('canonicalAuthTokenPayload', () => {
  it("produces the exact JSON key order apps/api's server recomputes", () => {
    const payload = canonicalAuthTokenPayload({
      runtimeId: 'rt_123',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(payload).toBe('{"runtimeId":"rt_123","timestamp":"2026-01-01T00:00:00.000Z"}');
  });
});

describe('signPayload', () => {
  it('produces a signature independently verifiable with the matching public key', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const payload = canonicalAuthTokenPayload({ runtimeId: 'rt_1', timestamp: 'x' });
    const signature = signPayload(privateKeyPem, payload);

    const ok = verify(null, Buffer.from(payload), publicKeyPem, Buffer.from(signature, 'base64'));
    expect(ok).toBe(true);
  });

  it('a signature over one payload does not verify against a different payload (no cross-payload replay)', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const signature = signPayload(
      privateKeyPem,
      canonicalAuthTokenPayload({ runtimeId: 'rt_1', timestamp: 'x' })
    );
    const tamperedPayload = canonicalAuthTokenPayload({ runtimeId: 'rt_1', timestamp: 'y' });

    const ok = verify(
      null,
      Buffer.from(tamperedPayload),
      publicKeyPem,
      Buffer.from(signature, 'base64')
    );
    expect(ok).toBe(false);
  });
});
