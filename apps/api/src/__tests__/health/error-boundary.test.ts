import { describe, it, expect, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { withErrorBoundary } from '../../server.js';
import { MissingTenantError } from '../../http/tenant.js';

interface FakeResponse {
  headersSent: boolean;
  statusCode?: number;
  headers?: Record<string, unknown>;
  body?: string;
  writeHead(status: number, headers: Record<string, unknown>): void;
  end(body: string): void;
  getHeader(name: string): unknown;
}

function fakeReq(): IncomingMessage {
  return { method: 'GET', url: '/whatever' } as unknown as IncomingMessage;
}

function fakeRes(): FakeResponse {
  return {
    headersSent: false,
    writeHead(status, headers) {
      this.headersSent = true;
      this.statusCode = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
    getHeader() {
      return 'test-request-id';
    },
  };
}

describe('withErrorBoundary — last line of defense before a process crash or hung connection', () => {
  it('converts an arbitrary thrown Error into a generic 500 without crashing or leaking the real message', async () => {
    const res = fakeRes();
    await withErrorBoundary(fakeReq(), res as unknown as ServerResponse, () => {
      throw new Error('some internal implementation detail, e.g. a SQL fragment or file path');
    });

    expect(res.statusCode).toBe(500);
    const parsed = JSON.parse(res.body ?? '{}') as { error: { code: string; message: string } };
    expect(parsed.error.code).toBe('INTERNAL_ERROR');
    expect(parsed.error.message).toBe('Internal server error');
    expect(parsed.error.message).not.toContain('SQL fragment');
  });

  it('converts a rejected promise the same way (async handler, not just sync throw)', async () => {
    const res = fakeRes();
    await withErrorBoundary(fakeReq(), res as unknown as ServerResponse, () =>
      Promise.reject(new Error('async boom'))
    );
    expect(res.statusCode).toBe(500);
  });

  it('maps MissingTenantError to its own 400/TENANT_REQUIRED shape instead of a generic 500', async () => {
    const res = fakeRes();
    await withErrorBoundary(fakeReq(), res as unknown as ServerResponse, () => {
      throw new MissingTenantError();
    });
    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(res.body ?? '{}') as { error: { code: string } };
    expect(parsed.error.code).toBe('TENANT_REQUIRED');
  });

  it('maps a Prisma P2002 unique-constraint error to 409/CONFLICT', async () => {
    const res = fakeRes();
    const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    await withErrorBoundary(fakeReq(), res as unknown as ServerResponse, () => {
      throw err;
    });
    expect(res.statusCode).toBe(409);
  });

  it('never double-writes the response if headers were already sent before the throw', async () => {
    const res = fakeRes();
    const writeHeadSpy = vi.spyOn(res, 'writeHead');
    await withErrorBoundary(fakeReq(), res as unknown as ServerResponse, () => {
      res.headersSent = true; // simulates a handler that started streaming, then threw
      throw new Error('too late, we already started responding');
    });
    expect(writeHeadSpy).not.toHaveBeenCalled();
  });

  it('does not throw or reject when the handler succeeds normally', async () => {
    const res = fakeRes();
    await expect(
      withErrorBoundary(fakeReq(), res as unknown as ServerResponse, async () => {
        res.writeHead(200, {});
        res.end('ok');
      })
    ).resolves.toBeUndefined();
    expect(res.statusCode).toBe(200);
  });
});
