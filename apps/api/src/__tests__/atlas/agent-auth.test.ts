/**
 * Direct middleware tests for createAgentAuthMiddleware.
 * Tests are pure unit tests — no real HTTP server needed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RouteContext } from '../../http/router.js';
import { createAgentAuthMiddleware } from '../../middleware/agent-auth.js';
import {
  InMemoryAgentAccessTokenRepository,
  AgentAccessToken,
  hashAgentToken,
} from '@seltriva/agent-provisioning';

const FUTURE = new Date(Date.now() + 86_400_000);
const AGENT_ID = 'agent-auth-test-001';

// ─── Minimal ServerResponse mock ─────────────────────────────────────────────

function makeMockRes() {
  let status = 0;
  let body = '';
  return {
    _status: () => status,
    _body: () => JSON.parse(body || '{}'),
    writeHead: (s: number) => {
      status = s;
    },
    end: (b: string) => {
      body = b;
    },
    headersSent: false,
  } as unknown as ServerResponse & { _status(): number; _body(): unknown };
}

function makeCtx(pathname: string, authorization?: string): RouteContext {
  return {
    params: {},
    query: new URLSearchParams(),
    body: undefined,
    rawUrl: pathname,
    pathname,
    method: 'POST',
    headers: authorization ? { authorization } : {},
    requestId: 'test',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createAgentAuthMiddleware', () => {
  let repo: InMemoryAgentAccessTokenRepository;
  let rawToken: string;
  let middleware: ReturnType<typeof createAgentAuthMiddleware>;

  beforeEach(async () => {
    repo = new InMemoryAgentAccessTokenRepository();
    const result = AgentAccessToken.generate(AGENT_ID, FUTURE, () => 'aat-id');
    await repo.save(result.token);
    rawToken = result.rawToken;
    middleware = createAgentAuthMiddleware(repo);
  });

  it('passes through non-agent paths without checking the token', async () => {
    const ctx = makeCtx('/api/v1/provision');
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(res._status()).toBe(0); // writeHead never called
  });

  it('passes through health path', async () => {
    const ctx = makeCtx('/health');
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('returns 401 when Authorization header is absent on protected path', async () => {
    const ctx = makeCtx('/api/v1/heartbeat');
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res._status()).toBe(401);
  });

  it('returns 401 when token does not start with aat_', async () => {
    const ctx = makeCtx('/api/v1/heartbeat', 'Bearer slp_notanagenttoken');
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res._status()).toBe(401);
  });

  it('returns 401 for an unknown aat_ token', async () => {
    const ctx = makeCtx('/api/v1/heartbeat', 'Bearer aat_' + '0'.repeat(64));
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res._status()).toBe(401);
  });

  it('returns 401 for a revoked token', async () => {
    await repo.revoke('aat-id');
    const ctx = makeCtx('/api/v1/heartbeat', `Bearer ${rawToken}`);
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res._status()).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    repo.clear();
    const { token, rawToken: expRaw } = AgentAccessToken.generate(AGENT_ID, FUTURE);
    const expired = AgentAccessToken.fromSnapshot({
      ...token.toSnapshot(),
      expiresAt: new Date(Date.now() - 1),
    });
    await repo.save(expired);

    const ctx = makeCtx('/api/v1/heartbeat', `Bearer ${expRaw}`);
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res._status()).toBe(401);
  });

  it('sets ctx.agentId and calls next() for a valid token', async () => {
    const ctx = makeCtx('/api/v1/heartbeat', `Bearer ${rawToken}`);
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(ctx.agentId).toBe(AGENT_ID);
  });

  it('updates lastUsedAt on successful authentication', async () => {
    const ctx = makeCtx('/api/v1/me', `Bearer ${rawToken}`);
    const res = makeMockRes();
    await middleware(ctx, {} as IncomingMessage, res, async () => {});
    const hash = hashAgentToken(rawToken);
    const token = await repo.findByHash(hash);
    expect(token!.lastUsedAt).toBeInstanceOf(Date);
  });

  it('works for /api/v1/sync-status path too', async () => {
    const ctx = makeCtx('/api/v1/sync-status', `Bearer ${rawToken}`);
    const res = makeMockRes();
    let called = false;
    await middleware(ctx, {} as IncomingMessage, res, async () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});
